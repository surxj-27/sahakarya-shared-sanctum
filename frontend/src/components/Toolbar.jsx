function Toolbar({
  onNoteClick,
  activeTool,
  setActiveTool,
  shapeType,
  setShapeType,
  onZoomIn,
  onZoomOut,
  zoom,
}) {  return (
    <aside className="board-toolbar" aria-label="Whiteboard tools">
      <div className="board-zoom-controls" aria-label="Canvas zoom">
      <button
        onClick={onZoomIn}
        className="board-tool-button board-zoom-button"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <span aria-hidden="true">+</span>
      </button>
      <span className="board-zoom-level" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomOut}
        className="board-tool-button board-zoom-button"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <span aria-hidden="true">−</span>
      </button>
      </div>
      <div className="board-tool-list" role="group" aria-label="Select a tool">
      <button
  onClick={() => setActiveTool("select")}
  className={`board-tool-button ${activeTool === "select" ? "is-active" : ""}`}
  aria-pressed={activeTool === "select"}
>
  Select
</button>
<button
  onClick={() => setActiveTool("hand")}
  className={`board-tool-button ${activeTool === "hand" ? "is-active" : ""}`}
  aria-pressed={activeTool === "hand"}
>
  Hand
</button>
      <button
  onClick={() => setActiveTool("pen")}
  className={`board-tool-button ${activeTool === "pen" ? "is-active" : ""}`}
  aria-pressed={activeTool === "pen"}
>
  Pen
</button>
<button
  onClick={() => setActiveTool("eraser")}
  className={`board-tool-button ${activeTool === "eraser" ? "is-active" : ""}`}
  aria-pressed={activeTool === "eraser"}
>
  Eraser
</button>
       <button onClick={onNoteClick} className="board-tool-button">Note</button>
<button
  onClick={() => setActiveTool("text")}
  className={`board-tool-button ${activeTool === "text" ? "is-active" : ""}`}
  aria-pressed={activeTool === "text"}
>
  Text
</button>
<button
  onClick={() => setActiveTool("shape")}
  className={`board-tool-button ${activeTool === "shape" ? "is-active" : ""}`}
  aria-pressed={activeTool === "shape"}
>
  Shape
</button>
      </div>
{activeTool === "shape" && (
  <div className="board-shape-tools" role="group" aria-label="Shape type">
    <button
      onClick={() => setShapeType("rect")}
      className={`board-tool-button ${shapeType === "rect" ? "is-active" : ""}`}
      aria-pressed={shapeType === "rect"}
    >
      Rectangle
    </button>

    <button
      onClick={() => setShapeType("circle")}
      className={`board-tool-button ${shapeType === "circle" ? "is-active" : ""}`}
      aria-pressed={shapeType === "circle"}
    >
      Circle
    </button>
    <button
  onClick={() => setShapeType("arrow")}
  className={`board-tool-button ${shapeType === "arrow" ? "is-active" : ""}`}
  aria-pressed={shapeType === "arrow"}
>
  Arrow
</button>
  </div>
)}
    </aside>
  )
}
export default Toolbar