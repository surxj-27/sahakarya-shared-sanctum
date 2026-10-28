function StickyNote({
  note,
  onBeginDrag,
  onTextMouseDown,
  onTextChange,
  onColorChange,
  onDelete,
}) {
  return (
    <div
      onMouseDown={onBeginDrag}
      className={`sticky-note absolute z-20 ${note.color}`}
      style={{
        left: `${note.x}px`,
        top: `${note.y}px`,
        width: note.width ? `${note.width}px` : undefined,
        height: note.height ? `${note.height}px` : undefined,
      }}
    >
      <textarea
        onMouseDown={(event) => {
          event.stopPropagation();
          onTextMouseDown(event);
        }}
        value={note.text}
        onChange={(event) => onTextChange(event.target.value)}
        className="sticky-note-text"
        placeholder="Write something..."
      />

      <div className="sticky-note-controls" aria-label="Sticky note color">
        {[
          "bg-yellow-200",
          "bg-pink-300",
          "bg-blue-200",
          "bg-green-200",
        ].map((color) => (
          <button
            key={color}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onColorChange(color)}
            className={`sticky-note-swatch ${color} ${note.color === color ? "is-selected" : ""}`}
            aria-label={`Set note color to ${color.replace("bg-", "").replace("-", " ")}`}
            title={`Set note color to ${color.replace("bg-", "").replace("-", " ")}`}
            aria-pressed={note.color === color}
          />
        ))}
      </div>

      <button
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onDelete}
        className="sticky-note-delete"
      >
        Delete
      </button>
    </div>
  );
}

export default StickyNote;
