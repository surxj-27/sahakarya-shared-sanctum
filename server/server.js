require("dotenv").config();
const connectDB = require("./config/db");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const Room = require("./models/Room");
const RoomRevision = require("./models/RoomRevision");
const User = require("./models/User");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const isValidJwtSecret = (secret) =>
  typeof secret === "string" &&
  secret.trim().length >= 32 &&
  !/^(replace|change[-_]?me|your[-_]?secret)/i.test(secret.trim());
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}
const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string" || !token) {
    return next(new Error("Authentication required. Please sign in."));
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("Server authentication is not configured."));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (
      !decoded ||
      typeof decoded.userId !== "string" ||
      !mongoose.Types.ObjectId.isValid(decoded.userId)
    ) {
      return next(new Error("Invalid authentication token."));
    }

    socket.data.userId = decoded.userId;
    return next();
  } catch (error) {
    return next(new Error("Invalid or expired authentication token."));
  }
});

const boardCollections = new Set(["notes", "shapes", "textItems", "strokes"]);
const getPersonalSocketRoom = (userId) => `board:personal:${userId}`;
const createEmptyBoard = () => ({
  notes: [],
  strokes: [],
  shapes: [],
  textItems: [],
});
const personalBoardStates = new Map();
const roomBoardStates = new Map();
const roomBoardSaveQueues = new Map();
const createDefaultViewport = () => ({
  pan: { x: 0, y: 0 },
  zoom: 1,
});
const personalViewportStates = new Map();
const roomViewportStates = new Map();

function normalizeBoardState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createEmptyBoard();
  }

  return Object.fromEntries(
    [...boardCollections].map((collection) => [
      collection,
      Array.isArray(candidate[collection]) ? candidate[collection] : [],
    ])
  );
}

function getSocketBoardState(socket) {
  if (socket.data.boardRoomId) {
    return roomBoardStates.get(socket.data.boardRoomId) || null;
  }
  if (socket.data.boardPersonalUserId !== socket.data.userId) return null;
  return personalBoardStates.get(socket.data.userId) || null;
}

function getSocketBoardRoom(socket) {
  const roomId = socket.data.boardRoomId;
  const socketRoom = roomId ? `board:${roomId}` : null;
  if (socketRoom) {
    return socket.rooms.has(socketRoom) ? socketRoom : null;
  }
  if (socket.data.boardPersonalUserId !== socket.data.userId) return null;
  const personalRoom = getPersonalSocketRoom(socket.data.userId);
  return socket.rooms.has(personalRoom) ? personalRoom : null;
}

function broadcastToSocketBoardRoom(socket, eventName, ...args) {
  const room = getSocketBoardRoom(socket);
  if (room) socket.to(room).emit(eventName, ...args);
}

function getSocketViewportState(socket) {
  const roomId = socket.data.boardRoomId;
  if (roomId) return roomViewportStates.get(roomId) || createDefaultViewport();
  return personalViewportStates.get(socket.data.userId) || createDefaultViewport();
}

function persistRoomBoardState(roomId, state) {
  if (!roomId || !state) return Promise.resolve();
  const snapshot = JSON.parse(JSON.stringify(normalizeBoardState(state)));
  const previousSave = roomBoardSaveQueues.get(roomId) || Promise.resolve();
  const nextSave = previousSave
    .catch(() => {})
    .then(async () => {
      const result = await Room.updateOne({ _id: roomId }, { $set: { boardState: snapshot } });
      if (result.matchedCount === 0) {
        throw new Error("The room no longer exists.");
      }
      return result;
    });

  roomBoardSaveQueues.set(roomId, nextSave);
  nextSave
    .catch((error) => {
      console.error(`Failed to persist board state for room ${roomId}:`, error);
    })
    .finally(() => {
      if (roomBoardSaveQueues.get(roomId) === nextSave) {
        roomBoardSaveQueues.delete(roomId);
      }
    });
  return nextSave;
}

function persistSocketBoardState(socket) {
  const roomId = socket.data.boardRoomId;
  const state = roomId ? roomBoardStates.get(roomId) : null;
  return persistRoomBoardState(roomId, state);
}

function hasValidId(id) {
  return (typeof id === "string" && id.length > 0) ||
    (typeof id === "number" && Number.isFinite(id));
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("board:join", async (payload) => {
    const joinSequence = (socket.data.boardJoinSequence || 0) + 1;
    socket.data.boardJoinSequence = joinSequence;
    const isRoomJoin =
      payload &&
      typeof payload === "object" &&
      Object.prototype.hasOwnProperty.call(payload, "roomId");
    const roomId = isRoomJoin ? payload.roomId : null;
    const snapshot = isRoomJoin ? null : payload;

    if (isRoomJoin) {
      if (typeof roomId !== "string" || !mongoose.Types.ObjectId.isValid(roomId)) {
        socket.emit("board:join:error", { message: "Invalid room ID." });
        return;
      }

      try {
        const room = await Room.findById(roomId)
          .select("owner members boardState")
          .lean();
        const isMember =
          String(room?.owner) === socket.data.userId ||
          (Array.isArray(room?.members) && room.members.some(
            (memberId) => String(memberId) === socket.data.userId
          ));

        if (!room || !isMember) {
          socket.emit("board:join:error", {
            message: "Room not found or you are not authorized to access it.",
          });
          return;
        }

        if (socket.data.boardJoinSequence !== joinSequence) return;
        const previousRoomId = socket.data.boardRoomId;
        if (previousRoomId && previousRoomId !== roomId) {
          await socket.leave(`board:${previousRoomId}`);
          if (socket.data.boardJoinSequence !== joinSequence) return;
        }
        const previousPersonalUserId = socket.data.boardPersonalUserId;
        if (previousPersonalUserId) {
          await socket.leave(getPersonalSocketRoom(previousPersonalUserId));
          if (socket.data.boardJoinSequence !== joinSequence) return;
        }

        let roomBoardState = roomBoardStates.get(roomId);
        if (!roomBoardState) {
          roomBoardState = normalizeBoardState(room.boardState);
          roomBoardStates.set(roomId, roomBoardState);
        }
        socket.data.boardRoomId = roomId;
        socket.data.boardPersonalUserId = null;
        await socket.join(`board:${roomId}`);
        if (socket.data.boardJoinSequence !== joinSequence) {
          if (socket.data.boardRoomId !== roomId) {
            await socket.leave(`board:${roomId}`);
          }
          return;
        }

        socket.emit("board:state", {
          roomId,
          requestId: payload.requestId,
          boardState: roomBoardState,
        });
        socket.emit("board:viewport", getSocketViewportState(socket));
        return;
      } catch (error) {
        console.error("Board room authorization failed:", error);
        socket.emit("board:join:error", {
          message: "Unable to authorize access to this room.",
        });
        return;
      }
    }

    const previousRoomId = socket.data.boardRoomId;
    if (previousRoomId) {
      await socket.leave(`board:${previousRoomId}`);
      if (socket.data.boardJoinSequence !== joinSequence) return;
      socket.data.boardRoomId = null;
    }
    const previousPersonalUserId = socket.data.boardPersonalUserId;
    if (previousPersonalUserId && previousPersonalUserId !== socket.data.userId) {
      await socket.leave(getPersonalSocketRoom(previousPersonalUserId));
      if (socket.data.boardJoinSequence !== joinSequence) return;
    }

    const personalRoom = getPersonalSocketRoom(socket.data.userId);
    await socket.join(personalRoom);
    if (socket.data.boardJoinSequence !== joinSequence) {
      if (socket.data.boardPersonalUserId !== socket.data.userId) {
        await socket.leave(personalRoom);
      }
      return;
    }

    socket.data.boardPersonalUserId = socket.data.userId;
    if (!personalBoardStates.has(socket.data.userId)) {
      personalBoardStates.set(socket.data.userId, normalizeBoardState(snapshot));
    }

    socket.emit("board:state", normalizeBoardState(personalBoardStates.get(socket.data.userId)));
    socket.emit("board:viewport", getSocketViewportState(socket));
  });

  socket.on("board:viewport", (viewport) => {
    if (
      !viewport ||
      !viewport.pan ||
      !Number.isFinite(viewport.pan.x) ||
      !Number.isFinite(viewport.pan.y) ||
      !Number.isFinite(viewport.zoom)
    ) {
      return;
    }

    const nextViewportState = {
      pan: { x: viewport.pan.x, y: viewport.pan.y },
      zoom: Math.min(4, Math.max(0.2, viewport.zoom)),
    };
    if (socket.data.boardRoomId) {
      if (!getSocketBoardRoom(socket)) return;
      roomViewportStates.set(socket.data.boardRoomId, nextViewportState);
    } else {
      if (!getSocketBoardRoom(socket)) return;
      personalViewportStates.set(socket.data.userId, nextViewportState);
    }
    broadcastToSocketBoardRoom(socket, "board:viewport", nextViewportState);
  });

  for (const eventName of ["board:object:create", "board:object:update"]) {
    socket.on(eventName, (operation) => {
      const currentBoardState = getSocketBoardState(socket);
      if (
        !operation ||
        !boardCollections.has(operation.collection) ||
        !operation.object ||
        typeof operation.object !== "object" ||
        Array.isArray(operation.object) ||
        !hasValidId(operation.object.id) ||
        !currentBoardState
      ) {
        return;
      }

      const objects = currentBoardState[operation.collection];
      const existingIndex = objects.findIndex((item) => item.id === operation.object.id);

      if (eventName === "board:object:create") {
        if (existingIndex !== -1) return;
        objects.push(operation.object);
      } else {
        if (existingIndex === -1) return;
        objects[existingIndex] = operation.object;
      }

      persistSocketBoardState(socket);
      broadcastToSocketBoardRoom(socket, eventName, operation);
    });
  }

  socket.on("board:object:delete", (operation) => {
    const currentBoardState = getSocketBoardState(socket);
    if (
      !operation ||
      !boardCollections.has(operation.collection) ||
      !hasValidId(operation.id) ||
      !currentBoardState
    ) {
      return;
    }

    const objects = currentBoardState[operation.collection];
    const nextObjects = objects.filter((item) => item.id !== operation.id);
    if (nextObjects.length === objects.length) return;

    currentBoardState[operation.collection] = nextObjects;
    persistSocketBoardState(socket);
    broadcastToSocketBoardRoom(socket, "board:object:delete", operation);
  });

  socket.on("board:stroke:start", (operation) => {
    const stroke = operation?.stroke;
    const currentBoardState = getSocketBoardState(socket);
    if (
      !stroke ||
      !hasValidId(stroke.id) ||
      !Array.isArray(stroke.points) ||
      !currentBoardState ||
      currentBoardState.strokes.some((item) => item.id === stroke.id)
    ) {
      return;
    }

    currentBoardState.strokes.push(stroke);
    persistSocketBoardState(socket);
    broadcastToSocketBoardRoom(socket, "board:stroke:start", operation);
  });

  socket.on("board:stroke:point", (operation) => {
    const point = operation?.point;
    const currentBoardState = getSocketBoardState(socket);
    if (
      !hasValidId(operation?.strokeId) ||
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !currentBoardState
    ) {
      return;
    }

    const stroke = currentBoardState.strokes.find((item) => item.id === operation.strokeId);
    if (!stroke) return;

    stroke.points.push(point);
    persistSocketBoardState(socket);
    broadcastToSocketBoardRoom(socket, "board:stroke:point", operation);
  });

  socket.on("board:restore", async (operation, acknowledge) => {
    const respond = typeof acknowledge === "function" ? acknowledge : () => {};
    const roomId = socket.data.boardRoomId;
    const socketRoom = getSocketBoardRoom(socket);
    const revisionInput = operation?.revision;
    const revisionId = revisionInput?.revisionId;
    const boardCandidate = operation?.boardState;
    console.info("Room restore received", {
      roomId,
      revisionId,
      isJoinedToRoom: Boolean(socketRoom),
      collectionCounts: boardCandidate && typeof boardCandidate === "object"
        ? Object.fromEntries(
          [...boardCollections].map((collection) => [
            collection,
            Array.isArray(boardCandidate[collection]) ? boardCandidate[collection].length : null,
          ])
        )
        : null,
    });
    const rejectRestore = (code, message, status = 400) => {
      respond({ success: false, code, message, status });
    };
    if (!roomId || !socketRoom) {
      console.warn("Room restore rejected: socket is not joined to an authorized room.");
      rejectRestore("ROOM_NOT_JOINED", "Join an authorized room before restoring its board.", 403);
      return;
    }

    if (
      !revisionInput ||
      typeof revisionId !== "string" ||
      !revisionId ||
      (revisionInput.parentRevisionId !== null &&
        typeof revisionInput.parentRevisionId !== "string") ||
      typeof revisionInput.timestamp !== "string" ||
      !Number.isFinite(Date.parse(revisionInput.timestamp)) ||
      typeof revisionInput.changeDescription !== "string" ||
      !revisionInput.changeDescription.trim() ||
      !boardCandidate ||
      typeof boardCandidate !== "object" ||
      Array.isArray(boardCandidate) ||
      ![...boardCollections].every((collection) =>
        Array.isArray(boardCandidate[collection]) &&
        Array.isArray(revisionInput.snapshot?.[collection])
      )
    ) {
      console.warn("Room restore rejected: revision or snapshot payload is invalid.", {
        roomId,
        revisionId,
      });
      rejectRestore("INVALID_RESTORE_PAYLOAD", "The restored revision or snapshot payload is invalid.");
      return;
    }
    if (
      JSON.stringify(normalizeBoardState(revisionInput.snapshot)) !==
      JSON.stringify(normalizeBoardState(boardCandidate))
    ) {
      console.warn("Room restore rejected: revision and board snapshots differ.", {
        roomId,
        revisionId,
      });
      rejectRestore("SNAPSHOT_MISMATCH", "The revision snapshot does not match the restored board.");
      return;
    }

    let stage = "room-membership-check";
    let revision;
    try {
      const isMember = await Room.exists({
        _id: roomId,
        $or: [{ owner: socket.data.userId }, { members: socket.data.userId }],
      });
      if (!isMember) {
        console.warn("Room restore rejected: room membership is no longer valid.", {
          roomId,
          revisionId,
        });
        rejectRestore("ROOM_ACCESS_REVOKED", "Room access was revoked before the restore.", 403);
        return;
      }

      if (revisionInput.parentRevisionId !== null) {
        stage = "parent-revision-check";
        const parentExists = await RoomRevision.exists({
          roomId,
          revisionId: revisionInput.parentRevisionId,
        });
        if (!parentExists) {
          console.warn("Room restore rejected: parent revision does not exist.", {
            roomId,
            revisionId,
          });
          rejectRestore("PARENT_REVISION_NOT_FOUND", "The parent revision no longer exists.", 409);
          return;
        }
      }

      stage = "revision-author-check";
      const author = await User.findById(socket.data.userId).select("name").lean();
      if (!author) {
        console.warn("Room restore rejected: authenticated author no longer exists.", {
          roomId,
          revisionId,
        });
        rejectRestore("REVISION_AUTHOR_NOT_FOUND", "The revision author could not be verified.", 401);
        return;
      }
      stage = "revision-create";
      revision = await RoomRevision.create({
        roomId,
        revisionId,
        parentRevisionId: revisionInput.parentRevisionId,
        timestamp: new Date(revisionInput.timestamp),
        authorId: socket.data.userId,
        authorName: author.name,
        changeDescription: revisionInput.changeDescription.trim().slice(0, 120),
        snapshot: normalizeBoardState(boardCandidate),
      });
    } catch (error) {
      console.error(`Room restore failed during ${stage} for room ${roomId}, revision ${revisionId}:`, {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
      rejectRestore(
        error?.code === 11000 ? "REVISION_ALREADY_EXISTS" : "REVISION_PERSISTENCE_FAILED",
        error?.code === 11000
          ? "This revision already exists."
          : `Revision persistence failed during ${stage}.`,
        error?.code === 11000 ? 409 : 500
      );
      return;
    }

    if (
      socket.data.boardRoomId !== roomId ||
      !socket.rooms.has(socketRoom)
    ) {
      try {
        await RoomRevision.deleteOne({ roomId, revisionId });
      } catch (error) {
        console.error(`Failed to remove cancelled restore revision ${revisionId}:`, {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
        });
      }
      rejectRestore("ROOM_CHANGED", "The active room changed before the restore.", 409);
      return;
    }

    const previousState = roomBoardStates.get(roomId);
    const restoredState = normalizeBoardState(boardCandidate);
    const restoredSnapshot = JSON.stringify(restoredState);
    const previousSnapshot = previousState
      ? JSON.parse(JSON.stringify(normalizeBoardState(previousState)))
      : createEmptyBoard();
    roomBoardStates.set(roomId, restoredState);
    try {
      await persistRoomBoardState(roomId, restoredState);
    } catch (error) {
      console.error(`Room restore failed during board persistence for room ${roomId}, revision ${revisionId}:`, {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
      if (
        roomBoardStates.get(roomId) === restoredState &&
        JSON.stringify(restoredState) === restoredSnapshot
      ) {
        roomBoardStates.set(roomId, previousSnapshot);
      }
      let rollbackFailed = false;
      try {
        await persistRoomBoardState(roomId, previousSnapshot);
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error(`Failed to restore prior board state for room ${roomId}:`, {
          name: rollbackError?.name,
          message: rollbackError?.message,
          code: rollbackError?.code,
          stack: rollbackError?.stack,
        });
      }
      try {
        const deletion = await RoomRevision.deleteOne({ roomId, revisionId });
        if (deletion.deletedCount !== 1) {
          throw new Error("The uncommitted restore revision could not be removed.");
        }
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error(`Failed to remove unsuccessful restore revision ${revisionId}:`, {
          name: rollbackError?.name,
          message: rollbackError?.message,
          code: rollbackError?.code,
          stack: rollbackError?.stack,
        });
      }
      rejectRestore(
        rollbackFailed ? "RESTORE_ROLLBACK_INCOMPLETE" : "BOARD_PERSISTENCE_FAILED",
        rollbackFailed
          ? "Board persistence failed and rollback was incomplete. Room state may need administrator repair."
          : "Board persistence failed; the prior board and revision history were restored.",
        500
      );
      return;
    }

    const persistedRevision = {
      revisionId: revision.revisionId,
      parentRevisionId: revision.parentRevisionId,
      timestamp: revision.timestamp.toISOString(),
      authorId: String(revision.authorId),
      authorName: revision.authorName,
      changeDescription: revision.changeDescription,
      snapshot: restoredState,
    };
    socket.to(socketRoom).emit("board:restore", {
      roomId,
      boardState: restoredState,
      revision: persistedRevision,
    });
    console.info("Room restore persisted and broadcast", {
      roomId,
      revisionId,
    });
    respond({ success: true, revision: persistedRevision });
  });

  socket.on("board:clear", () => {
    const currentBoardState = getSocketBoardState(socket);
    if (!currentBoardState) return;
    if (socket.data.boardRoomId) {
      roomBoardStates.set(socket.data.boardRoomId, createEmptyBoard());
    } else {
      if (socket.data.boardPersonalUserId !== socket.data.userId) return;
      personalBoardStates.set(socket.data.userId, createEmptyBoard());
    }
    persistSocketBoardState(socket);
    broadcastToSocketBoardRoom(socket, "board:clear");
  });

  // Continue relaying the legacy drawing event for existing clients.
  socket.on("drawing", (operation) => {
    if (!operation || typeof operation !== "object") return;

    const currentBoardState = getSocketBoardState(socket);
    let changed = false;
    if (
      currentBoardState &&
      operation.type === "start" &&
      operation.stroke &&
      hasValidId(operation.stroke.id) &&
      Array.isArray(operation.stroke.points) &&
      !currentBoardState.strokes.some((item) => item.id === operation.stroke.id)
    ) {
      currentBoardState.strokes.push(operation.stroke);
      changed = true;
    } else if (
      currentBoardState &&
      operation.type === "point" &&
      hasValidId(operation.strokeId) &&
      operation.point &&
      Number.isFinite(operation.point.x) &&
      Number.isFinite(operation.point.y)
    ) {
      const stroke = currentBoardState.strokes.find((item) => item.id === operation.strokeId);
      if (stroke) {
        stroke.points.push(operation.point);
        changed = true;
      }
    }

    if (changed) persistSocketBoardState(socket);
    console.log("Drawing event received:", operation.type);
    broadcastToSocketBoardRoom(socket, "drawing", operation);
  });

  socket.on("cursor:move", (position) => {
    if (
      !position ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return;
    }

    const displayName = typeof position.displayName === "string"
      ? position.displayName.trim().slice(0, 50) || "Collaborator"
      : "Collaborator";

    broadcastToSocketBoardRoom(socket, "cursor:update", {
      id: socket.id,
      userId: socket.data.userId,
      x: position.x,
      y: position.y,
      displayName,
    });
  });

  socket.on("disconnecting", () => {
    broadcastToSocketBoardRoom(socket, "cursor:remove", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
console.log("sahi chl rha hai")
app.get("/", (req, res) => {
  res.send("The Shared Sanctum backend is running!");
});

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

const startServer = async () => {
  if (!isValidJwtSecret(process.env.JWT_SECRET)) {
    throw new Error("JWT_SECRET must be a non-placeholder value of at least 32 characters.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.CLIENT_ORIGINS?.split(",").some((origin) => origin.trim())
  ) {
    throw new Error("CLIENT_ORIGINS must be configured in production.");
  }
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
;
