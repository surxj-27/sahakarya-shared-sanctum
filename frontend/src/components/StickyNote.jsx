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
      className={`sticky-note absolute z-20 w-48 rounded-lg ${note.color} p-4 text-gray-900 shadow-lg`}
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
        className="h-28 w-full resize-none bg-transparent text-gray-900 outline-none"
        placeholder="Write something...."
      />

      <div className="mb-2 flex gap-2">
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
            className={`h-5 w-5 rounded-full ${color}`}
          />
        ))}
      </div>

      <button
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onDelete}
        className="mt-2 rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
      >
        Delete
      </button>
    </div>
  );
}

export default StickyNote;
