function DrawingLayer({ strokes, shapes }) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
      {strokes.map((stroke, index) => (
        <polyline
          key={stroke.id ?? index}
          points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="var(--board-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {shapes.map((shape) => {
        const startX = shape.startX ?? shape.x;
        const startY = shape.startY ?? shape.y;
        const endX = shape.endX ?? shape.x + shape.width;
        const endY = shape.endY ?? shape.y + shape.height;

        if (shape.type === "arrow") {
          const angle = Math.atan2(endY - startY, endX - startX);
          const headLength = 14;
          const headAngle = Math.PI / 6;
          const x1 = endX - headLength * Math.cos(angle - headAngle);
          const y1 = endY - headLength * Math.sin(angle - headAngle);
          const x2 = endX - headLength * Math.cos(angle + headAngle);
          const y2 = endY - headLength * Math.sin(angle + headAngle);

          return (
            <g key={shape.id}>
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="var(--board-ink)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <polygon
                points={`${endX},${endY} ${x1},${y1} ${x2},${y2}`}
                fill="var(--board-ink)"
                stroke="var(--board-ink)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </g>
          );
        }

        if (shape.type === "circle") {
          return (
            <ellipse
              key={shape.id}
              cx={shape.x + shape.width / 2}
              cy={shape.y + shape.height / 2}
              rx={shape.width / 2}
              ry={shape.height / 2}
              fill="transparent"
              stroke="var(--board-ink)"
              strokeWidth="2"
            />
          );
        }

        return (
          <rect
            key={shape.id}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            fill="transparent"
            stroke="var(--board-ink)"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}

export default DrawingLayer;
