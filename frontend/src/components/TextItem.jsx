function TextItem({ item, onMouseDown, onChange, onCommit }) {
  return (
    <textarea
      value={item.text}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onMouseDown={(event) => {
        event.stopPropagation();
        onMouseDown(event);
      }}
      placeholder="Type here..."
      className="text-item absolute z-20 min-w-40 resize bg-transparent outline-none"
      style={{
        left: `${item.x}px`,
        top: `${item.y}px`,
        width: item.width ? `${item.width}px` : undefined,
        height: item.height ? `${item.height}px` : undefined,
      }}
    />
  );
}

export default TextItem;
