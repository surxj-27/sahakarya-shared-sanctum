function SelectionOverlay({ bounds, canResize }) {
  if (!bounds) return null;

  return (
    <div
      className="board-selection pointer-events-none absolute z-30"
      style={{
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      }}
    >
      {canResize && ["nw", "ne", "sw", "se"].map((handle) => (
        <span
          key={handle}
          data-resize-handle={handle}
          className="board-selection-handle pointer-events-auto absolute cursor-nwse-resize"
          style={{
            left: handle.includes("w") ? "-5px" : undefined,
            right: handle.includes("e") ? "-5px" : undefined,
            top: handle.includes("n") ? "-5px" : undefined,
            bottom: handle.includes("s") ? "-5px" : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default SelectionOverlay;
