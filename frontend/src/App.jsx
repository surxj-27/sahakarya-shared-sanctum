import { useState , useEffect, useRef, useCallback} from 'react'
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

function App() {
  const [authPage, setAuthPage] = useState(() => {
  return localStorage.getItem("token") ? "board" : "login";
});
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
  const { notes, strokes, shapes, textItems } = boardHistory.state
  const updateCollection = useCallback((key, nextValue, record = true) => {
    const update = record ? boardHistory.set : boardHistory.update
    update((previous) => ({
      ...previous,
      [key]: typeof nextValue === "function"
        ? nextValue(previous[key])
        : nextValue,
    }))
  }, [boardHistory.set, boardHistory.update])
  const setNotes = useCallback((nextNotes) => updateCollection("notes", nextNotes), [updateCollection])
  const setTextItems = useCallback((nextTextItems) => updateCollection("textItems", nextTextItems), [updateCollection])
  const updateNotes = useCallback((nextNotes) => updateCollection("notes", nextNotes, false), [updateCollection])
  const updateStrokes = useCallback((nextStrokes) => updateCollection("strokes", nextStrokes, false), [updateCollection])
  const updateShapes = useCallback((nextShapes) => updateCollection("shapes", nextShapes, false), [updateCollection])
  const updateTextItems = useCallback((nextTextItems) => updateCollection("textItems", nextTextItems, false), [updateCollection])
  const undo=boardHistory.undo
  const redo=boardHistory.redo
  const canUndo=boardHistory.canUndo
  const canRedo=boardHistory.canRedo
  const setBoardHistory = boardHistory.set
  const [activeTool, setActiveTool] = useState("select");
  const [isDrawing, setIsDrawing] = useState(false);
const [pan, setPan] = useState({ x: 0, y: 0 });
const [isPanning, setIsPanning] = useState(false);
const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
const [zoom, setZoom] = useState(1);
const [draggingText, setDraggingText] = useState(null);
const [shapeType, setShapeType] = useState("rect");
const [selectedObject, setSelectedObject] = useState(null);

const [dragStart, setDragStart] = useState(null);
const canvasRef = useRef(null);
const [saveStatus, setSaveStatus] = useState("Saved");

function getCanvasPoint(event, canvas = event.currentTarget) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left - pan.x) / zoom,
    y: (event.clientY - rect.top - pan.y) / zoom,
  };
}


useEffect(() => {
  function handleKeyDown(e) {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (e.target instanceof HTMLElement &&
      (e.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(e.target.tagName))) return;
    if (!selectedObject) return;

    if (selectedObject.type === "note") {
      setNotes((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "shape") {
      setBoardHistory((prev) => ({
        ...prev,
        shapes: prev.shapes.filter((item) => item.id !== selectedObject.id),
      }));
    } else if (selectedObject.type === "text") {
      setTextItems((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "stroke") {
      setBoardHistory((prev) => ({
        ...prev,
        strokes: prev.strokes.filter((item) => item.id !== selectedObject.id),
      }));
    }

    setSelectedObject(null);
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [selectedObject, setNotes, setTextItems, setBoardHistory]);

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

    const nextZoom = Math.min(
      4,
      Math.max(0.2, zoom * Math.exp(-e.deltaY * 0.001))
    );
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const canvasX = (cursorX - pan.x) / zoom;
    const canvasY = (cursorY - pan.y) / zoom;

    setPan({
      x: cursorX - canvasX * nextZoom,
      y: cursorY - canvasY * nextZoom,
    });
    setZoom(nextZoom);
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
    const newNote={
      id:Date.now(),
      text:"",
      x:200+notes.length*25,y:150+notes.length*25,
      color:"bg-yellow-200",
    };
    setNotes([...notes,newNote])
    console.log("Notes",[...notes,newNote]);
  }
  function deleteNote(id){
    setNotes((prevnotes)=>
      prevnotes.filter((note)=> note.id!==id)
    )
  }
  function clearBoard() {
    if (!window.confirm("Clear all canvas content? This can be undone.")) return;

    boardHistory.commitTransaction();
    setBoardHistory({
      notes: [],
      strokes: [],
      shapes: [],
      textItems: [],
    });
    setSelectedObject(null);
    setDragStart(null);
    setDraggingNote(null);
    setDraggingText(null);
    setIsDrawing(false);
    setIsPanning(false);
  }
  if (authPage === "login") {
  return (
    <Login
      onSwitchToSignup={() => setAuthPage("signup")}
      onLoginSuccess={() => setAuthPage("board")}
    />
  );
}

if (authPage === "signup") {
  return (
    <Signup
      onSwitchToLogin={() => setAuthPage("login")}
    />
  );
}
return (
  <>
  <div className='min-h-screen bg-[#13141a] text-white'></div>
<Header
  undo={undo}
  redo={redo}
  canUndo={canUndo}
  canRedo={canRedo}
  onAllClear={clearBoard}
  saveStatus={saveStatus}
  onExport={exportBoardAsPng}
/>
  <main ref={canvasRef} className='relative h-[calc(100vh-70px)] bg-[#171820] overflow-hidden' style={{
    backgroundImage:"radial-gradient(#383945 1px,transparent 1px)",
    backgroundSize:"24px 24px",
   
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

  updateShapes((prev) => [
    ...prev,
    {
      id: Date.now(),
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
      id: Date.now(),
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
      boardHistory.beginTransaction();
      setIsDrawing(true);

      updateStrokes((prev) => [
    ...prev,
    {
      id: `${Date.now()}-${Math.random()}`,
      points: [point],
    },
  ]);
}}
  
onMouseMove={(e) => {
  
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
    const updated = [...prev];
    const lastShape = updated[updated.length - 1];

    if (!lastShape) return prev;

    if (lastShape.type === "arrow") {
      updated[updated.length - 1] = {
        ...lastShape,
        endX: currentX,
        endY: currentY,
      };
    } else {
      updated[updated.length - 1] = {
        ...lastShape,
        x: Math.min(lastShape.startX, currentX),
        y: Math.min(lastShape.startY, currentY),
        width: Math.abs(currentX - lastShape.startX),
        height: Math.abs(currentY - lastShape.startY),
      };
    }

    return updated;
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
}
  if(activeTool=="pen" && isDrawing){
    const point = getCanvasPoint(e);
    updateStrokes((prev)=>{
      const updated=[...prev]
      const lastStroke=updated[updated.length-1]

      updated[updated.length-1]={
        ...lastStroke,
        points:[
          ...lastStroke.points,
          point,
        ],
      }
      return updated
    })
    return
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

  setPan((prev) => ({
    x: prev.x + dx,
    y: prev.y + dy,
  }));

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
  }}
  >
    <div className='fixed left-5 top-32 z-10'>
<Toolbar
  onNoteClick={createNote}
  activeTool={activeTool}
  setActiveTool={setActiveTool}
  shapeType={shapeType}
  setShapeType={setShapeType}
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
  </main>

  </>
)
}

export default App
