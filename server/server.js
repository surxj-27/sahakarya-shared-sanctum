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

const app = express();
const PORT = 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
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
const legacyBoardSocketRoom = "board:legacy";
const createEmptyBoard = () => ({
  notes: [],
  strokes: [],
  shapes: [],
  textItems: [],
});
let boardState = null;
const roomBoardStates = new Map();
const roomBoardSaveQueues = new Map();
const createDefaultViewport = () => ({
  pan: { x: 0, y: 0 },
  zoom: 1,
});
let viewportState = createDefaultViewport();
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
  return socket.data.boardRoomId
    ? roomBoardStates.get(socket.data.boardRoomId) || null
    : boardState;
}

function getSocketBoardRoom(socket) {
  const roomId = socket.data.boardRoomId;
  const socketRoom = roomId ? `board:${roomId}` : null;
  if (socketRoom) {
    return socket.rooms.has(socketRoom) ? socketRoom : null;
  }
  return socket.rooms.has(legacyBoardSocketRoom) ? legacyBoardSocketRoom : null;
}

function broadcastToSocketBoardRoom(socket, eventName, ...args) {
  const room = getSocketBoardRoom(socket);
  if (room) socket.to(room).emit(eventName, ...args);
}

function getSocketViewportState(socket) {
  const roomId = socket.data.boardRoomId;
  return roomId
    ? roomViewportStates.get(roomId) || createDefaultViewport()
    : viewportState;
}

function persistSocketBoardState(socket) {
  const roomId = socket.data.boardRoomId;
  const state = roomId ? roomBoardStates.get(roomId) : null;
  if (!roomId || !state) return;

  const snapshot = JSON.parse(JSON.stringify(normalizeBoardState(state)));
  const previousSave = roomBoardSaveQueues.get(roomId) || Promise.resolve();
  const nextSave = previousSave
    .catch(() => {})
    .then(() => Room.updateOne({ _id: roomId }, { $set: { boardState: snapshot } }));

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
        if (socket.rooms.has(legacyBoardSocketRoom)) {
          await socket.leave(legacyBoardSocketRoom);
          if (socket.data.boardJoinSequence !== joinSequence) return;
        }

        let roomBoardState = roomBoardStates.get(roomId);
        if (!roomBoardState) {
          roomBoardState = normalizeBoardState(room.boardState);
          roomBoardStates.set(roomId, roomBoardState);
        }
        socket.data.boardRoomId = roomId;
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
    await socket.join(legacyBoardSocketRoom);
    if (socket.data.boardJoinSequence !== joinSequence) {
      if (socket.data.boardRoomId) {
        await socket.leave(legacyBoardSocketRoom);
      }
      return;
    }

    if (boardState === null) {
      boardState = normalizeBoardState(snapshot);
    }

    socket.emit("board:state", normalizeBoardState(boardState));
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
      viewportState = nextViewportState;
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

  socket.on("board:clear", () => {
    const currentBoardState = getSocketBoardState(socket);
    if (!currentBoardState) return;
    if (socket.data.boardRoomId) {
      roomBoardStates.set(socket.data.boardRoomId, createEmptyBoard());
    } else {
      boardState = createEmptyBoard();
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
app.use(cors());
app.use(express.json());
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
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
;
