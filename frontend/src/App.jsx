import { useState , useEffect, useRef, useCallback} from 'react'
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import socket from "./socket";
import { toPng } from "html-to-image";
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'
import Header from "./components/Header"
import Toolbar from "./components/Toolbar"
import DrawingLayer from "./components/DrawingLayer"
import StickyNote from "./components/StickyNote"
import TextItem from "./components/TextItem"
import SelectionOverlay from "./components/SelectionOverlay"
import useHistory  from './hooks/useHistory'
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Landing from "./components/Landing";
const BOARD_COLLECTIONS = ["notes", "strokes", "shapes", "textItems"];
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

function createBoardId() {
  return `${socket.id || "local"}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emitCollectionChanges(collection, previous, next, includeStrokeChanges = false) {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));

  for (const item of next) {
    const previousItem = previousById.get(item.id);
    if (!previousItem) {
      if (collection !== "strokes" || includeStrokeChanges) {
        socket.emit("board:object:create", { collection, object: item });
      }
    } else if (
      (collection !== "strokes" || includeStrokeChanges) &&
      JSON.stringify(previousItem) !== JSON.stringify(item)
    ) {
      socket.emit("board:object:update", { collection, object: item });
    } else if (
      collection === "strokes" &&
      previousItem.points.length === item.points.length &&
      JSON.stringify(previousItem) !== JSON.stringify(item)
    ) {
      socket.emit("board:object:update", { collection, object: item });
    }
  }

  for (const item of previous) {
    if (!nextById.has(item.id)) {
      socket.emit("board:object:delete", { collection, id: item.id });
    }
  }
}

function App() {
  const navigate = useNavigate();
  const [authStatus, setAuthStatus] = useState(() =>
    localStorage.getItem("token") ? "checking" : "unauthenticated"
  );
const [currentUser, setCurrentUser] = useState(() =>
  JSON.parse(localStorage.getItem("user") || "null")
);
function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  setCurrentUser(null);
  setAuthStatus("unauthenticated");
  navigate("/", { replace: true });
}
useEffect(() => {
  const token = localStorage.getItem("token");

  if (!token) {
    setAuthStatus("unauthenticated");
    return;
  }

  async function verifyToken() {
    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/profile",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setCurrentUser(null);
        setAuthStatus("unauthenticated");
        return;
      }

      const data = await response.json();
      localStorage.setItem("user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      setAuthStatus("authenticated");
    } catch (error) {
      console.error("Profile verification failed:", error);
      setAuthStatus("unauthenticated");
    }
  }

  verifyToken();
}, []);

  function getInitialBoardState() {
  try {
    const saved = localStorage.getItem("sanctum-board");

    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to load saved board:", error);
  }

  return {
    notes: [],
    strokes: [],
    shapes: [],
    textItems: [],
  };
}
 
  const [draggingNote,setDraggingNote]=useState(null)
 const boardHistory = useHistory(getInitialBoardState());
  const boardStateRef = useRef(boardHistory.state);
  const updateHistory = boardHistory.update;
  const { notes, strokes, shapes, textItems } = boardHistory.state
  const updateCollection = useCallback((key, nextValue, record = true) => {
    const update = record ? boardHistory.set : boardHistory.update
    const previousState = boardStateRef.current
    const previousCollection = previousState[key]
    const nextCollection = typeof nextValue === "function"
      ? nextValue(previousCollection)
      : nextValue
    const nextState = { ...previousState, [key]: nextCollection }

    boardStateRef.current = nextState
    update(nextState)
    emitCollectionChanges(key, previousCollection, nextCollection)
  }, [boardHistory.set, boardHistory.update])
  const setNotes = useCallback((nextNotes) => updateCollection("notes", nextNotes), [updateCollection])
  const setShapes = useCallback((nextShapes) => updateCollection("shapes", nextShapes), [updateCollection])
  const setStrokes = useCallback((nextStrokes) => updateCollection("strokes", nextStrokes), [updateCollection])
  const setTextItems = useCallback((nextTextItems) => updateCollection("textItems", nextTextItems), [updateCollection])
  const updateNotes = useCallback((nextNotes) => updateCollection("notes", nextNotes, false), [updateCollection])
  const updateStrokes = useCallback((nextStrokes) => updateCollection("strokes", nextStrokes, false), [updateCollection])
  const updateShapes = useCallback((nextShapes) => updateCollection("shapes", nextShapes, false), [updateCollection])
  const updateTextItems = useCallback((nextTextItems) => updateCollection("textItems", nextTextItems, false), [updateCollection])
  const [remoteCursors, setRemoteCursors] = useState({});
  useEffect(() => {
    function applyRemoteChange(collection, updateItems) {
      const previousState = boardStateRef.current;
      const previousItems = previousState[collection];
      const nextItems = updateItems(previousItems);
      if (nextItems === previousItems) return;

      const nextState = { ...previousState, [collection]: nextItems };
      boardStateRef.current = nextState;
      updateHistory(nextState);
    }

    function handleRemoteCreate({ collection, object }) {
      if (!BOARD_COLLECTIONS.includes(collection) || !object) return;
      applyRemoteChange(collection, (items) =>
        items.some((item) => item.id === object.id) ? items : [...items, object]
      );
    }

    function handleRemoteUpdate({ collection, object }) {
      if (!BOARD_COLLECTIONS.includes(collection) || !object) return;
      applyRemoteChange(collection, (items) => {
        if (!items.some((item) => item.id === object.id)) return items;
        return items.map((item) => item.id === object.id ? object : item);
      });
    }

    function handleRemoteDelete({ collection, id }) {
      if (!BOARD_COLLECTIONS.includes(collection)) return;
      applyRemoteChange(collection, (items) => {
        const nextItems = items.filter((item) => item.id !== id);
        return nextItems.length === items.length ? items : nextItems;
      });
    }

    function handleRemoteStrokeStart({ stroke }) {
      if (!stroke) return;
      applyRemoteChange("strokes", (items) =>
        items.some((item) => item.id === stroke.id) ? items : [...items, stroke]
      );
    }

    function handleRemoteStrokePoint({ strokeId, point }) {
      if (!point) return;
      applyRemoteChange("strokes", (items) => {
        const stroke = items.find((item) => item.id === strokeId);
        if (!stroke) return items;
        return items.map((item) => item.id === strokeId
          ? { ...item, points: [...item.points, point] }
          : item
        );
      });
    }

    function handleLegacyDrawing(operation) {
      if (operation?.type === "start" && operation.stroke) {
        handleRemoteStrokeStart({ stroke: operation.stroke });
      } else if (operation?.type === "point") {
        handleRemoteStrokePoint(operation);
      }
    }

    function handleBoardState(snapshot) {
      if (
        !snapshot ||
        !BOARD_COLLECTIONS.every((collection) => Array.isArray(snapshot[collection]))
      ) {
        console.error("Received invalid board state from server");
        return;
      }

      boardStateRef.current = snapshot;
      updateHistory(snapshot);
    }

    function handleBoardClear() {
      const emptyBoard = {
        notes: [],
        strokes: [],
        shapes: [],
        textItems: [],
      };
      boardStateRef.current = emptyBoard;
      updateHistory(emptyBoard);
    }

    function handleConnect() {
      console.log("Connected to server:", socket.id);
      socket.emit("board:join", boardStateRef.current);
    }

    function handleDisconnect() {
      console.log("Disconnected from server");
      setRemoteCursors({});
    }

    function handleCursorUpdate(position) {
      if (
        !position ||
        typeof position.id !== "string" ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      ) {
        return;
      }

      setRemoteCursors((previous) => ({
        ...previous,
        [position.id]: {
          x: position.x,
          y: position.y,
          displayName: typeof position.displayName === "string" && position.displayName.trim()
            ? position.displayName.trim()
            : "Collaborator",
        },
      }));
    }

    function handleCursorRemove(socketId) {
      if (typeof socketId !== "string") return;

      setRemoteCursors((previous) => {
        if (!(socketId in previous)) return previous;
        const next = { ...previous };
        delete next[socketId];
        return next;
      });
    }

    socket.on("cursor:update", handleCursorUpdate);
    socket.on("cursor:remove", handleCursorRemove);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("board:state", handleBoardState);
    socket.on("board:object:create", handleRemoteCreate);
    socket.on("board:object:update", handleRemoteUpdate);
    socket.on("board:object:delete", handleRemoteDelete);
    socket.on("board:stroke:start", handleRemoteStrokeStart);
    socket.on("board:stroke:point", handleRemoteStrokePoint);
    socket.on("drawing", handleLegacyDrawing);
    socket.on("board:clear", handleBoardClear);
    socket.connect();

  return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("board:state", handleBoardState);
      socket.off("board:object:create", handleRemoteCreate);
      socket.off("board:object:update", handleRemoteUpdate);
      socket.off("board:object:delete", handleRemoteDelete);
      socket.off("board:stroke:start", handleRemoteStrokeStart);
      socket.off("board:stroke:point", handleRemoteStrokePoint);
      socket.off("drawing", handleLegacyDrawing);
      socket.off("board:clear", handleBoardClear);
      socket.off("cursor:update", handleCursorUpdate);
      socket.off("cursor:remove", handleCursorRemove);
      socket.disconnect();
  };
}, [updateHistory]);
  function applyHistoryAction(action) {
    const previousState = boardStateRef.current;
    action();
    const nextState = boardHistory.getState();
    boardStateRef.current = nextState;
    for (const collection of BOARD_COLLECTIONS) {
      emitCollectionChanges(collection, previousState[collection], nextState[collection], true);
    }
  }
  const undo = () => applyHistoryAction(boardHistory.undo)
  const redo = () => applyHistoryAction(boardHistory.redo)
  const canUndo=boardHistory.canUndo
  const canRedo=boardHistory.canRedo
  const setBoardHistory = boardHistory.set
  const [activeTool, setActiveTool] = useState("select");
  const [isDrawing, setIsDrawing] = useState(false);
const [pan, setPan] = useState({ x: 0, y: 0 });
const [isPanning, setIsPanning] = useState(false);
const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
const [zoom, setZoom] = useState(1);
const viewportRef = useRef({ pan, zoom });
const [draggingText, setDraggingText] = useState(null);
const [shapeType, setShapeType] = useState("rect");
const [selectedObject, setSelectedObject] = useState(null);

const [dragStart, setDragStart] = useState(null);
const canvasRef = useRef(null);
const [saveStatus, setSaveStatus] = useState("Saved");
const currentStrokeIdRef = useRef(null);
const currentShapeIdRef = useRef(null);

function applyViewport(nextPan, nextZoom, broadcast = true) {
  if (
    !nextPan ||
    !Number.isFinite(nextPan.x) ||
    !Number.isFinite(nextPan.y) ||
    !Number.isFinite(nextZoom)
  ) {
    return;
  }

  const viewport = {
    pan: { x: nextPan.x, y: nextPan.y },
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)),
  };
  viewportRef.current = viewport;
  setPan(viewport.pan);
  setZoom(viewport.zoom);

  if (broadcast) {
    socket.emit("board:viewport", viewport);
  }
}

function getCanvasPoint(event, canvas = event.currentTarget) {
  const targetCanvas = canvasRef.current || canvas;
  const rect = targetCanvas.getBoundingClientRect();
  const { pan: currentPan, zoom: currentZoom } = viewportRef.current;

  return {
    x: (event.clientX - rect.left - currentPan.x) / currentZoom,
    y: (event.clientY - rect.top - currentPan.y) / currentZoom,
  };
}

function zoomAtCanvasCenter(nextZoom) {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const { pan: currentPan, zoom: currentZoom } = viewportRef.current;
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const boardX = (centerX - currentPan.x) / currentZoom;
  const boardY = (centerY - currentPan.y) / currentZoom;

  applyViewport({
    x: centerX - boardX * nextZoom,
    y: centerY - boardY * nextZoom,
  }, nextZoom);
}

function zoomIn() {
  zoomAtCanvasCenter(viewportRef.current.zoom * 1.2);
}

function zoomOut() {
  zoomAtCanvasCenter(viewportRef.current.zoom / 1.2);
}

useEffect(() => {
  function handleRemoteViewport(viewport) {
    if (
      !viewport ||
      !viewport.pan ||
      !Number.isFinite(viewport.pan.x) ||
      !Number.isFinite(viewport.pan.y) ||
      !Number.isFinite(viewport.zoom)
    ) {
      return;
    }

    applyViewport(viewport.pan, viewport.zoom, false);
  }

  socket.on("board:viewport", handleRemoteViewport);
  return () => socket.off("board:viewport", handleRemoteViewport);
}, []);


useEffect(() => {
  function handleKeyDown(e) {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (e.target instanceof HTMLElement &&
      (e.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(e.target.tagName))) return;
    if (!selectedObject) return;

    if (selectedObject.type === "note") {
      setNotes((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "shape") {
      setShapes((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "text") {
      setTextItems((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "stroke") {
      setStrokes((prev) => prev.filter((item) => item.id !== selectedObject.id));
    }

    setSelectedObject(null);
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [selectedObject, setNotes, setShapes, setStrokes, setTextItems]);

function getObjectBounds(object) {
  if (object.type === "note") {
    const note = notes.find((item) => item.id === object.id);
    return note ? {
      x: note.x,
      y: note.y,
      width: note.width ?? 192,
      height: note.height ?? 204,
    } : null;
  }
  if (object.type === "text") {
    const item = textItems.find((entry) => entry.id === object.id);
    return item ? { x: item.x, y: item.y, width: item.width ?? 164, height: item.height ?? 48 } : null;
  }
  if (object.type === "shape") {
    const shape = shapes.find((item) => item.id === object.id);
    if (!shape) return null;
    if (shape.type === "arrow") {
      const startX = shape.startX ?? shape.x;
      const startY = shape.startY ?? shape.y;
      const endX = shape.endX ?? shape.x + shape.width;
      const endY = shape.endY ?? shape.y + shape.height;
      return {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.max(1, Math.abs(endX - startX)),
        height: Math.max(1, Math.abs(endY - startY)),
      };
    }
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  if (object.type === "stroke") {
    const stroke = strokes.find((item) => item.id === object.id);
    if (!stroke || stroke.points.length === 0) return null;
    const xs = stroke.points.map((point) => point.x);
    const ys = stroke.points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x: x - 6,
      y: y - 6,
      width: Math.max(12, Math.max(...xs) - x + 12),
      height: Math.max(12, Math.max(...ys) - y + 12),
    };
  }
  return null;
}


useEffect(() => {
  setSaveStatus("Saving...");

  try {
    localStorage.setItem(
      "sanctum-board",
      JSON.stringify(boardHistory.state)
    );

    setSaveStatus("Saved");
  } catch (error) {
    console.error("Autosave failed:", error);
    setSaveStatus("Save failed");
  }
}, [boardHistory.state]);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  function handleWheel(e) {
    e.preventDefault();

    const { pan: currentPan, zoom: currentZoom } = viewportRef.current;
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, currentZoom * Math.exp(-e.deltaY * 0.001))
    );
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const canvasX = (cursorX - currentPan.x) / currentZoom;
    const canvasY = (cursorY - currentPan.y) / currentZoom;

    applyViewport({
      x: cursorX - canvasX * nextZoom,
      y: cursorY - canvasY * nextZoom,
    }, nextZoom);
  }

  canvas.addEventListener("wheel", handleWheel, { passive: false });
  return () => canvas.removeEventListener("wheel", handleWheel);
}, [pan, zoom]);

async function exportBoardAsPng() {
  const board = canvasRef.current;
  if (!board) return;

  try {
    const dataUrl = await toPng(board, {
      cacheBust: true,
      pixelRatio: 2,
    });

    const link = document.createElement("a");
    link.download = "shared-sanctum.png";
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("PNG export failed:", error);
  }
}


  function createNote(){
    const id = createBoardId();
    setNotes((previous) => [
      ...previous,
      {
        id,
        text: "",
        x: 200 + previous.length * 25,
        y: 150 + previous.length * 25,
        color: "bg-yellow-200",
      },
    ]);
  }
  function deleteNote(id){
    setNotes((prevnotes)=>
      prevnotes.filter((note)=> note.id!==id)
    )
  }
  function clearBoard() {
    if (!window.confirm("Clear all canvas content? This can be undone.")) return;

    boardHistory.commitTransaction();
    const emptyBoard = {
      notes: [],
      strokes: [],
      shapes: [],
      textItems: [],
    };
    boardStateRef.current = emptyBoard;
    setBoardHistory(emptyBoard);
    socket.emit("board:clear");
    setSelectedObject(null);
    setDragStart(null);
    setDraggingNote(null);
    setDraggingText(null);
    setIsDrawing(false);
    setIsPanning(false);
  }
return (
  <Routes>
    <Route
      path="/"
      element={(
        <Landing
          onLogin={() => navigate("/login")}
          onSignup={() => navigate("/signup")}
        />
      )}
    />
    <Route
      path="/login"
      element={
        authStatus === "checking" ? null : authStatus === "authenticated" ? (
          <Navigate to="/board" replace />
        ) : (
          <Login
            onSwitchToSignup={() => navigate("/signup")}
            onLoginSuccess={() => {
              setCurrentUser(JSON.parse(localStorage.getItem("user") || "null"));
              setAuthStatus("authenticated");
              navigate("/board", { replace: true });
            }}
          />
        )
      }
    />
    <Route
      path="/signup"
      element={
        authStatus === "checking" ? null : authStatus === "authenticated" ? (
          <Navigate to="/board" replace />
        ) : (
          <Signup onSwitchToLogin={() => navigate("/login")} />
        )
      }
    />
    <Route
      path="/board"
      element={
        authStatus === "checking" ? null : authStatus !== "authenticated" ? (
          <Navigate to="/login" replace />
        ) : (
          <>
<Header
  undo={undo}
  redo={redo}
  canUndo={canUndo}
  canRedo={canRedo}
  onAllClear={clearBoard}
  saveStatus={saveStatus}
  onExport={exportBoardAsPng}
  onLogout={handleLogout}
  user={currentUser}
/>
  <main ref={canvasRef} className='relative h-[calc(100vh-70px)] bg-[#171820] overflow-hidden' style={{
    backgroundImage:`radial-gradient(#383945 ${zoom}px,transparent ${zoom}px)`,
    backgroundSize:`${24 * zoom}px ${24 * zoom}px`,
    backgroundPosition:`${pan.x}px ${pan.y}px`,
   
  }}
  onMouseDown={(e) => {
    const handle = e.target.closest("[data-resize-handle]");
    if (handle && selectedObject) {
      const bounds = getObjectBounds(selectedObject);
      if (bounds) {
        e.preventDefault();
        boardHistory.beginTransaction();
        const { x: mouseX, y: mouseY } = getCanvasPoint(e);
        setDragStart({
          mode: "resize",
          handle: handle.dataset.resizeHandle,
          bounds,
          mouseX,
          mouseY,
        });
      }
      return;
    }

if (activeTool === "select") {
  if (e.target instanceof HTMLElement &&
    !["INPUT", "TEXTAREA"].includes(e.target.tagName) &&
    document.activeElement instanceof HTMLElement &&
    ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    document.activeElement.blur();
  }

  const { x: mouseX, y: mouseY } = getCanvasPoint(e);

  const clickedNote = notes.find(
    (note) =>
      mouseX >= note.x &&
      mouseX <= note.x + (note.width ?? 192) &&
      mouseY >= note.y &&
      mouseY <= note.y + (note.height ?? 204)
  );

if (clickedNote) {
  boardHistory.beginTransaction();
  setSelectedObject({
    type: "note",
    id: clickedNote.id,
  });

  setDragStart({
    mode: "move",
    mouseX,
    mouseY,
    object: clickedNote,
  });
} else {
  const clickedShape = [...shapes].reverse().find((shape) => {
    if (shape.type === "arrow") {
      const startX = shape.startX ?? shape.x;
      const startY = shape.startY ?? shape.y;
      const endX = shape.endX ?? shape.x + shape.width;
      const endY = shape.endY ?? shape.y + shape.height;
      const lineX = endX - startX;
      const lineY = endY - startY;
      const lengthSquared = lineX * lineX + lineY * lineY;
      const projection = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((mouseX - startX) * lineX + (mouseY - startY) * lineY) / lengthSquared));
      const distanceX = mouseX - (startX + projection * lineX);
      const distanceY = mouseY - (startY + projection * lineY);

      return Math.hypot(distanceX, distanceY) <= 8 / zoom;
    }

    if (shape.type === "circle") {
      const radiusX = shape.width / 2;
      const radiusY = shape.height / 2;

      return radiusX > 0 && radiusY > 0 &&
        ((mouseX - (shape.x + radiusX)) / radiusX) ** 2 +
        ((mouseY - (shape.y + radiusY)) / radiusY) ** 2 <= 1;
    }

    return mouseX >= shape.x &&
      mouseX <= shape.x + shape.width &&
      mouseY >= shape.y &&
      mouseY <= shape.y + shape.height;
  });

  if (clickedShape) {
    boardHistory.beginTransaction();
    setSelectedObject({
      type: "shape",
      id: clickedShape.id,
    });
    setDragStart({
      mode: "move",
      mouseX,
      mouseY,
      object: clickedShape,
    });
  } else {
    const clickedStroke = [...strokes].reverse().find((stroke) =>
      stroke.points.some((point, index) => {
        const next = stroke.points[index + 1];
        if (!next) {
          return Math.hypot(mouseX - point.x, mouseY - point.y) <= 10 / zoom;
        }
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const lengthSquared = dx * dx + dy * dy;
        const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
          ((mouseX - point.x) * dx + (mouseY - point.y) * dy) / lengthSquared
        ));
        return Math.hypot(mouseX - (point.x + projection * dx), mouseY - (point.y + projection * dy)) <= 10 / zoom;
      })
    );

    if (clickedStroke) {
      boardHistory.beginTransaction();
      setSelectedObject({ type: "stroke", id: clickedStroke.id });
      setDragStart({ mode: "move", mouseX, mouseY, object: clickedStroke });
    } else {
      setSelectedObject(null);
      setDragStart(null);
    }
  }
}
  return;
}


    if (activeTool === "shape") {
  boardHistory.beginTransaction();
  const { x: startX, y: startY } = getCanvasPoint(e);
  const shapeId = createBoardId();
  currentShapeIdRef.current = shapeId;

  updateShapes((prev) => [
    ...prev,
    {
      id: shapeId,
      type: shapeType,
      startX,
      startY,
      endX: startX,
      endY: startY,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
    },
  ]);

  setIsDrawing(true);
  return;
}
    if (activeTool === "text") {
  const { x, y } = getCanvasPoint(e);
  setTextItems((prev) => [
    ...prev,
    {
      id: createBoardId(),
      x,
      y,
      text: "",
    },
  ]);
  return;
}
    if (activeTool === "eraser") {
  boardHistory.beginTransaction();
  setIsDrawing(true);
  return;
}
    if (activeTool === "hand") {
  setIsPanning(true);
  setLastMouse({
    x: e.clientX,
    y: e.clientY,
  });
  return;
}
  if (activeTool !== "pen") return;
  if (e.target.closest(".sticky-note")) return;
      if (e.target.closest("textarea, button")) return;
const point = getCanvasPoint(e);

const newStroke = {
  id: createBoardId(),
  points: [point],
};

currentStrokeIdRef.current = newStroke.id;

boardHistory.beginTransaction();
setIsDrawing(true);

updateStrokes((prev) => [...prev, newStroke]);
console.log("Sending drawing:", newStroke);
socket.emit("board:stroke:start", {
  stroke: newStroke,
});
}}
  
onMouseMove={(e) => {
const { x, y } = getCanvasPoint(e);
socket.emit("cursor:move", {
  x,
  y,
  displayName: currentUser?.name || "Collaborator",
});
  
if (
  activeTool === "select" &&
  selectedObject &&
  dragStart &&
  e.buttons === 1
) {
 const { x: mouseX, y: mouseY } = getCanvasPoint(e);
  const deltaX = mouseX - dragStart.mouseX;
  const deltaY = mouseY - dragStart.mouseY;

  if (dragStart.mode === "resize") {
    const bounds = dragStart.bounds;
    const right = dragStart.handle.includes("e");
    const bottom = dragStart.handle.includes("s");
    const minSize = selectedObject.type === "note" ? 204 : 24;
    const width = Math.max(minSize, bounds.width + (right ? deltaX : -deltaX));
    const height = Math.max(minSize, bounds.height + (bottom ? deltaY : -deltaY));
    const x = right ? bounds.x : bounds.x + bounds.width - width;
    const y = bottom ? bounds.y : bounds.y + bounds.height - height;

    if (selectedObject.type === "shape") {
      updateShapes((prev) => prev.map((shape) =>
        shape.id === selectedObject.id
          ? { ...shape, x, y, width, height }
          : shape
      ));
    } else if (selectedObject.type === "note") {
      updateNotes((prev) => prev.map((note) =>
        note.id === selectedObject.id ? { ...note, x, y, width, height } : note
      ));
    } else if (selectedObject.type === "text") {
      updateTextItems((prev) => prev.map((item) =>
        item.id === selectedObject.id ? { ...item, x, y, width, height } : item
      ));
    }
  } else if (selectedObject.type === "note") {
    updateNotes((prev) =>
      prev.map((note) =>
        note.id === selectedObject.id
          ? {
              ...note,
              x: dragStart.object.x + deltaX,
              y: dragStart.object.y + deltaY,
            }
          : note
      )
    );
  } else if (selectedObject.type === "shape") {
    updateShapes((prev) =>
      prev.map((shape) => {
        if (shape.id !== selectedObject.id) return shape;

        if (shape.type === "arrow") {
          const originalShape = dragStart.object;

          return {
            ...shape,
            startX: (originalShape.startX ?? originalShape.x) + deltaX,
            startY: (originalShape.startY ?? originalShape.y) + deltaY,
            endX: (originalShape.endX ?? originalShape.x + originalShape.width) + deltaX,
            endY: (originalShape.endY ?? originalShape.y + originalShape.height) + deltaY,
          };
        }

        return {
          ...shape,
          x: dragStart.object.x + deltaX,
          y: dragStart.object.y + deltaY,
        };
      })
    );
  } else if (selectedObject.type === "stroke") {
    updateStrokes((prev) => prev.map((stroke) =>
      stroke.id === selectedObject.id
        ? {
            ...stroke,
            points: dragStart.object.points.map((point) => ({
              x: point.x + deltaX,
              y: point.y + deltaY,
            })),
          }
        : stroke
    ));
  } else if (selectedObject.type === "text") {
    updateTextItems((prev) => prev.map((item) =>
      item.id === selectedObject.id
        ? {
            ...item,
            x: dragStart.object.x + deltaX,
            y: dragStart.object.y + deltaY,
          }
        : item
    ));
  }

  return;
}

  if (activeTool === "shape" && isDrawing) {
  const { x: currentX, y: currentY } = getCanvasPoint(e);

  updateShapes((prev) => {
    const activeShape = prev.find((shape) => shape.id === currentShapeIdRef.current);
    if (!activeShape) return prev;

    return prev.map((shape) => {
      if (shape.id !== currentShapeIdRef.current) return shape;

      if (shape.type === "arrow") {
        return {
          ...shape,
          endX: currentX,
          endY: currentY,
        };
      }

      return {
        ...shape,
        x: Math.min(activeShape.startX, currentX),
        y: Math.min(activeShape.startY, currentY),
        width: Math.abs(currentX - activeShape.startX),
        height: Math.abs(currentY - activeShape.startY),
      };
    });
  });

  return;
}
  if (activeTool === "eraser" && isDrawing) {
  const { x, y } = getCanvasPoint(e);
  updateStrokes((prev) =>
    prev.filter((stroke) => {
      const isNear = stroke.points.some((point) => {
        const dx = point.x - x;
        const dy = point.y - y;

        return Math.sqrt(dx * dx + dy * dy) < 15 / zoom;
      });

      return !isNear;
    })
  );
  return;
}if (activeTool === "pen" && isDrawing) {
const point = getCanvasPoint(e);

updateStrokes((prev) => {
  if (!currentStrokeIdRef.current) return prev;
  return prev.map((stroke) => stroke.id === currentStrokeIdRef.current
    ? { ...stroke, points: [...stroke.points, point] }
    : stroke
  );
  });
console.log("Sending point");
  socket.emit("board:stroke:point", {
    strokeId: currentStrokeIdRef.current,
    point,
  });

  return;
}
  if (draggingText !== null) {
  updateTextItems((prev) =>
    prev.map((item) =>
      item.id === draggingText
        ? {
            ...item,
            x: item.x + e.movementX / zoom,
            y: item.y + e.movementY / zoom,
          }
        : item
    )
  );
  return;
}
  if (isPanning) {
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  const currentViewport = viewportRef.current;

  applyViewport({
    x: currentViewport.pan.x + dx,
    y: currentViewport.pan.y + dy,
  }, currentViewport.zoom);

  setLastMouse({
    x: e.clientX,
    y: e.clientY,
  });

  return;
}
  if (draggingNote === null) return;

  updateNotes((prevNotes) =>
    prevNotes.map((note) =>
      note.id === draggingNote
        ? {
            ...note,
            x: note.x + e.movementX / zoom,
            y: note.y + e.movementY / zoom,
          }
        : note
    )
  );
}}

  onMouseUp={()=>{
    boardHistory.commitTransaction();
    setIsPanning(false);
    setDraggingText(null);
    setIsDrawing(false)
    setDraggingNote(null)
    currentStrokeIdRef.current = null;
    currentShapeIdRef.current = null;
  }}
  >
    <div className='fixed left-5 top-32 z-10'>
<Toolbar
  onNoteClick={createNote}
  activeTool={activeTool}
  setActiveTool={setActiveTool}
  shapeType={shapeType}
  setShapeType={setShapeType}
  onZoomIn={zoomIn}
  onZoomOut={zoomOut}
  zoom={zoom}
/>
    </div>
    <div
  className="absolute inset-0"
  style={{
     transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "0 0",
  }}
>  
    <DrawingLayer strokes={strokes} shapes={shapes} />
    {notes.map((note) => (
      <StickyNote
        key={note.id}
        note={note}
        onBeginDrag={() => {
          boardHistory.beginTransaction();
          setDraggingNote(note.id);
        }}
        onTextMouseDown={(event) => {
          if (activeTool === "select") {
            event.preventDefault();
            event.currentTarget.blur();
            boardHistory.beginTransaction();
            const { x: mouseX, y: mouseY } = getCanvasPoint(
              event,
              event.currentTarget.closest("main")
            );
            setSelectedObject({ type: "note", id: note.id });
            setDragStart({ mode: "move", mouseX, mouseY, object: note });
          } else {
            boardHistory.beginTransaction();
            setDraggingNote(note.id);
          }
        }}
        onTextChange={(text) => setNotes((previous) =>
          previous.map((item) =>
            item.id === note.id ? { ...item, text } : item
          )
        )}
        onColorChange={(color) => setNotes((previous) =>
          previous.map((item) =>
            item.id === note.id ? { ...item, color } : item
          )
        )}
        onDelete={() => deleteNote(note.id)}
      />
    ))}
    {textItems.map((item) => (
      <TextItem
        key={item.id}
        item={item}
        onChange={(text) => setTextItems((previous) =>
          previous.map((entry) =>
            entry.id === item.id ? { ...entry, text } : entry
          )
        )}
        onMouseDown={(event) => {
          boardHistory.beginTransaction();
          setDraggingText(item.id);
          if (activeTool === "select") {
            event.preventDefault();
            event.currentTarget.blur();
            const { x: mouseX, y: mouseY } = getCanvasPoint(
              event,
              event.currentTarget.closest("main")
            );
            setSelectedObject({ type: "text", id: item.id });
            setDragStart({ mode: "move", mouseX, mouseY, object: item });
          } else {
            setSelectedObject(null);
            setDragStart(null);
          }
        }}
      />
    ))}
    <SelectionOverlay
      bounds={selectedObject ? getObjectBounds(selectedObject) : null}
      canResize={
        selectedObject?.type === "note" ||
        selectedObject?.type === "text" ||
        (selectedObject?.type === "shape" &&
          shapes.find((shape) => shape.id === selectedObject.id)?.type !== "arrow")
      }
    />
    </div>
    {Object.entries(remoteCursors).map(([id, position]) => (
  <div
    key={id}
    className="pointer-events-none absolute z-50"
    style={{
      left: pan.x + position.x * zoom,
      top: pan.y + position.y * zoom,
      transition: "left 50ms linear, top 50ms linear",
    }}
  >
    <div className="h-3 w-3 rounded-full bg-pink-500" />
    <span className="ml-2 rounded bg-pink-500 px-2 py-1 text-xs text-white">
      {position.displayName || "Collaborator"}
    </span>
  </div>
))}
  </main>

  </>
        )
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
}

export default App
