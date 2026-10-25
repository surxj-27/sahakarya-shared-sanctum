require("dotenv").config();
const connectDB = require("./config/db");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const boardCollections = new Set(["notes", "shapes", "textItems", "strokes"]);
const createEmptyBoard = () => ({
  notes: [],
  strokes: [],
  shapes: [],
  textItems: [],
});
let boardState = null;
let viewportState = {
  pan: { x: 0, y: 0 },
  zoom: 1,
};

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

function hasValidId(id) {
  return (typeof id === "string" && id.length > 0) ||
    (typeof id === "number" && Number.isFinite(id));
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("board:join", (snapshot) => {
    if (boardState === null) {
      boardState = normalizeBoardState(snapshot);
    }

    socket.emit("board:state", boardState);
    socket.emit("board:viewport", viewportState);
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

    viewportState = {
      pan: { x: viewport.pan.x, y: viewport.pan.y },
      zoom: Math.min(4, Math.max(0.2, viewport.zoom)),
    };
    socket.broadcast.emit("board:viewport", viewportState);
  });

  for (const eventName of ["board:object:create", "board:object:update"]) {
    socket.on(eventName, (operation) => {
      if (
        !operation ||
        !boardCollections.has(operation.collection) ||
        !operation.object ||
        typeof operation.object !== "object" ||
        Array.isArray(operation.object) ||
        !hasValidId(operation.object.id) ||
        !boardState
      ) {
        return;
      }

      const objects = boardState[operation.collection];
      const existingIndex = objects.findIndex((item) => item.id === operation.object.id);

      if (eventName === "board:object:create") {
        if (existingIndex !== -1) return;
        objects.push(operation.object);
      } else {
        if (existingIndex === -1) return;
        objects[existingIndex] = operation.object;
      }

      socket.broadcast.emit(eventName, operation);
    });
  }

  socket.on("board:object:delete", (operation) => {
    if (
      !operation ||
      !boardCollections.has(operation.collection) ||
      !hasValidId(operation.id) ||
      !boardState
    ) {
      return;
    }

    const objects = boardState[operation.collection];
    const nextObjects = objects.filter((item) => item.id !== operation.id);
    if (nextObjects.length === objects.length) return;

    boardState[operation.collection] = nextObjects;
    socket.broadcast.emit("board:object:delete", operation);
  });

  socket.on("board:stroke:start", (operation) => {
    const stroke = operation?.stroke;
    if (
      !stroke ||
      !hasValidId(stroke.id) ||
      !Array.isArray(stroke.points) ||
      !boardState ||
      boardState.strokes.some((item) => item.id === stroke.id)
    ) {
      return;
    }

    boardState.strokes.push(stroke);
    socket.broadcast.emit("board:stroke:start", operation);
  });

  socket.on("board:stroke:point", (operation) => {
    const point = operation?.point;
    if (
      !hasValidId(operation?.strokeId) ||
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !boardState
    ) {
      return;
    }

    const stroke = boardState.strokes.find((item) => item.id === operation.strokeId);
    if (!stroke) return;

    stroke.points.push(point);
    socket.broadcast.emit("board:stroke:point", operation);
  });

  socket.on("board:clear", () => {
    if (!boardState) return;
    boardState = createEmptyBoard();
    socket.broadcast.emit("board:clear");
  });

  // Continue relaying the legacy drawing event for existing clients.
  socket.on("drawing", (operation) => {
    if (!operation || typeof operation !== "object") return;

    if (
      boardState &&
      operation.type === "start" &&
      operation.stroke &&
      hasValidId(operation.stroke.id) &&
      Array.isArray(operation.stroke.points) &&
      !boardState.strokes.some((item) => item.id === operation.stroke.id)
    ) {
      boardState.strokes.push(operation.stroke);
    } else if (
      boardState &&
      operation.type === "point" &&
      hasValidId(operation.strokeId) &&
      operation.point &&
      Number.isFinite(operation.point.x) &&
      Number.isFinite(operation.point.y)
    ) {
      const stroke = boardState.strokes.find((item) => item.id === operation.strokeId);
      if (stroke) stroke.points.push(operation.point);
    }

    console.log("Drawing event received:", operation.type);
    socket.broadcast.emit("drawing", operation);
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

    socket.broadcast.emit("cursor:update", {
      id: socket.id,
      x: position.x,
      y: position.y,
      displayName,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    socket.broadcast.emit("cursor:remove", socket.id);
  });
});
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
console.log("sahi chl rha hai")
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});
app.get("/", (req, res) => {
  res.send("The Shared Sanctum backend is running!");
});

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
;
