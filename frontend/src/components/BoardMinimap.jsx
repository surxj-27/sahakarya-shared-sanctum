import { useRef } from "react";
import { getContentBounds } from "./boardGeometry";

const WIDTH = 220;
const HEIGHT = 150;
const PADDING = 12;

function noteColor(color) {
  if (color === "bg-pink-300") return "#e8955a";
  if (color === "bg-blue-200") return "#6aa7d8";
  if (color === "bg-green-200") return "#7fb77e";
  return "#d7b84f";
}

export default function BoardMinimap({
  notes,
  textItems,
  strokes,
  shapes,
  viewport,
  canvasSize,
  onNavigate,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const visibleWidth = canvasSize.width / viewport.zoom;
  const visibleHeight = canvasSize.height / viewport.zoom;
  const visibleX = -viewport.pan.x / viewport.zoom;
  const visibleY = -viewport.pan.y / viewport.zoom;
  const contentBounds = getContentBounds({ notes, textItems, strokes, shapes });
  const minX = Math.min(visibleX, contentBounds?.minX ?? visibleX);
  const minY = Math.min(visibleY, contentBounds?.minY ?? visibleY);
  const maxX = Math.max(visibleX + visibleWidth, contentBounds?.maxX ?? visibleX + visibleWidth);
  const maxY = Math.max(visibleY + visibleHeight, contentBounds?.maxY ?? visibleY + visibleHeight);
  const worldWidth = Math.max(1, maxX - minX);
  const worldHeight = Math.max(1, maxY - minY);
  const scale = Math.min((WIDTH - PADDING * 2) / worldWidth, (HEIGHT - PADDING * 2) / worldHeight);
  const offsetX = (WIDTH - worldWidth * scale) / 2;
  const offsetY = (HEIGHT - worldHeight * scale) / 2;
  const toMapX = (x) => offsetX + (x - minX) * scale;
  const toMapY = (y) => offsetY + (y - minY) * scale;
  const viewportRect = {
    x: toMapX(visibleX),
    y: toMapY(visibleY),
    width: visibleWidth * scale,
    height: visibleHeight * scale,
  };

  function getMapPoint(event) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * WIDTH / rect.width,
      y: (event.clientY - rect.top) * HEIGHT / rect.height,
    };
  }

  function navigateToMapPoint(point, dragOffset = null) {
    const centerX = dragOffset
      ? dragOffset.minX + (point.x - dragOffset.x + dragOffset.viewportWidth / 2 - dragOffset.offsetX) / dragOffset.scale
      : minX + (point.x - offsetX) / scale;
    const centerY = dragOffset
      ? dragOffset.minY + (point.y - dragOffset.y + dragOffset.viewportHeight / 2 - dragOffset.offsetY) / dragOffset.scale
      : minY + (point.y - offsetY) / scale;
    onNavigate(centerX, centerY);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getMapPoint(event);
    const onViewport = event.target.closest(".minimap-viewport");
    if (onViewport) {
      dragRef.current = {
        x: point.x - viewportRect.x,
        y: point.y - viewportRect.y,
        minX,
        minY,
        offsetX,
        offsetY,
        scale,
        viewportWidth: viewportRect.width,
        viewportHeight: viewportRect.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    navigateToMapPoint(point);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    navigateToMapPoint(getMapPoint(event), dragRef.current);
  }

  function handlePointerUp(event) {
    if (!dragRef.current) return;
    event.stopPropagation();
    dragRef.current = null;
  }

  return (
    <div className="board-minimap" aria-label="Board minimap">
      <div className="board-minimap-heading">Board overview</div>
      <svg
        ref={svgRef}
        className="board-minimap-map"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Board contents and current viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseMove={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
      >
        {strokes.map((stroke) => (
          <polyline
            key={stroke.id}
            points={stroke.points.map((point) => `${toMapX(point.x)},${toMapY(point.y)}`).join(" ")}
            fill="none"
            stroke="#5d574d"
            strokeWidth={Math.max(0.7, 2 * scale)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {shapes.map((shape) => {
          if (shape.type === "arrow") {
            return (
              <line
                key={shape.id}
                x1={toMapX(shape.startX ?? shape.x)}
                y1={toMapY(shape.startY ?? shape.y)}
                x2={toMapX(shape.endX ?? shape.x + shape.width)}
                y2={toMapY(shape.endY ?? shape.y + shape.height)}
                stroke="#5d574d"
                strokeWidth={Math.max(0.7, 2 * scale)}
              />
            );
          }
          return (
            <rect
              key={shape.id}
              x={toMapX(shape.x)}
              y={toMapY(shape.y)}
              width={Math.max(1, shape.width * scale)}
              height={Math.max(1, shape.height * scale)}
              rx="1"
              fill="none"
              stroke="#5d574d"
              strokeWidth={Math.max(0.7, 2 * scale)}
            />
          );
        })}
        {notes.map((note) => (
          <rect
            key={note.id}
            x={toMapX(note.x)}
            y={toMapY(note.y)}
            width={Math.max(2, (note.width ?? 192) * scale)}
            height={Math.max(2, (note.height ?? 204) * scale)}
            rx="1.5"
            fill={noteColor(note.color)}
            stroke="rgba(31, 29, 26, .4)"
            strokeWidth=".5"
          />
        ))}
        {textItems.map((item) => (
          <rect
            key={item.id}
            x={toMapX(item.x)}
            y={toMapY(item.y)}
            width={Math.max(2, (item.width ?? 160) * scale)}
            height={Math.max(1.5, (item.height ?? 40) * scale)}
            rx="1"
            fill="#6aa7d8"
            fillOpacity=".85"
          />
        ))}
        <rect
          className="minimap-viewport"
          x={viewportRect.x}
          y={viewportRect.y}
          width={Math.max(3, viewportRect.width)}
          height={Math.max(3, viewportRect.height)}
          rx="2"
        />
      </svg>
    </div>
  );
}
