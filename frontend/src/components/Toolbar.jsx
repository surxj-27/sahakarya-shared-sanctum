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
    <aside className="inline-flex max-h-[75vh] flex-col items-center gap-3 overflow-y-auto rounded-xl border border-white/10 bg-[#1c1d25] p-3">
      <button
        onClick={onZoomIn}
        className="rounded-lg p-3 text-gray-300 hover:bg-white/10"
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>
      <span className="text-xs text-gray-400" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomOut}
        className="rounded-lg p-3 text-gray-300 hover:bg-white/10"
        aria-label="Zoom out"
        title="Zoom out"
      >
        -
      </button>
      <button
  onClick={() => setActiveTool("select")}
  className={`rounded-lg p-3 ${
    activeTool === "select"
      ? "bg-violet-600 text-white"
      : "text-gray-300 hover:bg-white/10"
  }`}
>
  Select
</button>
<button
  onClick={() => setActiveTool("hand")}
  className={`rounded-lg p-3 ${
    activeTool === "hand"
      ? "bg-violet-600 text-white"
      : "text-gray-300 hover:bg-white/10"
  }`}
>
  Hand
</button>
      <button
  onClick={() => setActiveTool("pen")}
  className={`rounded-lg p-3 ${
    activeTool === "pen"
      ? "bg-violet-600 text-white"
      : "text-gray-300 hover:bg-white/10"
  }`}
>
  Pen
</button>
<button
  onClick={() => setActiveTool("eraser")}
  className={`rounded-lg p-3 ${
    activeTool === "eraser"
      ? "bg-violet-600 text-white"
      : "text-gray-300 hover:bg-white/10"
  }`}
>
  Eraser
</button>
       <button onClick={onNoteClick} className="rounded-lg p-3 text-gray-300 hover:bg-white/10">Note</button>
<button
  onClick={() => setActiveTool("text")}
  className={`rounded-lg p-3 ${
    activeTool === "text"
      ? "bg-violet-600 text-white"
      : "text-gray-300 hover:bg-white/10"
  }`}
>
  Text
</button>
<button
  onClick={() => setActiveTool("shape")}
  className={`rounded-lg p-3 ${
    activeTool === "shape"
      ? "bg-violet-600 text-white"
      : "text-gray-300 hover:bg-white/10"
  }`}
>
  Shape
</button>
{activeTool === "shape" && (
  <>
    <button
      onClick={() => setShapeType("rect")}
      className={`rounded-lg p-3 ${
        shapeType === "rect"
          ? "bg-violet-600 text-white"
          : "text-gray-300 hover:bg-white/10"
      }`}
    >
      Rectangle
    </button>

    <button
      onClick={() => setShapeType("circle")}
      className={`rounded-lg p-3 ${
        shapeType === "circle"
          ? "bg-violet-600 text-white"
          : "text-gray-300 hover:bg-white/10"
      }`}
    >
      Circle
    </button>
    <button
  onClick={() => setShapeType("arrow")}
  className={`rounded-lg p-3 ${
    shapeType === "arrow"
      ? "bg-violet-600 text-white"
      : "text-gray-300 hover:bg-white/10"
  }`}
>
  Arrow
</button>
  </>
)}

    </aside>
  )
}
export default Toolbar