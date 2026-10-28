export function getContentBounds({ notes, textItems, strokes, shapes }) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y, width = 0, height = 0) => {
    if (![x, y, width, height].every(Number.isFinite)) return;
    bounds.minX = Math.min(bounds.minX, x, x + width);
    bounds.minY = Math.min(bounds.minY, y, y + height);
    bounds.maxX = Math.max(bounds.maxX, x, x + width);
    bounds.maxY = Math.max(bounds.maxY, y, y + height);
  };

  notes.forEach((note) => include(note.x, note.y, note.width ?? 192, note.height ?? 204));
  textItems.forEach((item) => include(item.x, item.y, item.width ?? 160, item.height ?? 40));
  strokes.forEach((stroke) => stroke.points?.forEach((point) => include(point.x, point.y)));
  shapes.forEach((shape) => {
    if (shape.type === "arrow") {
      const startX = shape.startX ?? shape.x;
      const startY = shape.startY ?? shape.y;
      const endX = shape.endX ?? shape.x + shape.width;
      const endY = shape.endY ?? shape.y + shape.height;
      include(Math.min(startX, endX), Math.min(startY, endY), Math.abs(endX - startX), Math.abs(endY - startY));
    } else {
      include(shape.x, shape.y, shape.width, shape.height);
    }
  });

  return Number.isFinite(bounds.minX) ? bounds : null;
}
