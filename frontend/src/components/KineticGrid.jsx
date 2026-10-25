import { useEffect, useRef } from "react";

// Full-screen interactive grid: points warp toward the cursor, clicks emit ripples.
export default function KineticGrid({ spacing = 38, color = "rgba(60,55,45,0.10)" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    const ripples = [];

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; };
    const leave = () => { mouse.tx = -9999; mouse.ty = -9999; };
    const click = (e) => ripples.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });

    const displace = (x, y) => {
      let dx = 0, dy = 0;
      const mx = mouse.x - x, my = mouse.y - y;
      const d = Math.hypot(mx, my);
      if (d < 220) { const f = (1 - d / 220) ** 2 * 26; dx += (mx / (d || 1)) * f; dy += (my / (d || 1)) * f; }
      for (const r of ripples) {
        const rx = x - r.x, ry = y - r.y, rd = Math.hypot(rx, ry);
        const band = Math.abs(rd - r.r);
        if (band < 60) { const f = (1 - band / 60) * 18 * r.life; dx += (rx / (rd || 1)) * f; dy += (ry / (rd || 1)) * f; }
      }
      return [x + dx, y + dy];
    };

    const draw = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.15;
      mouse.y += (mouse.ty - mouse.y) * 0.15;
      if (mouse.tx < -9000) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].r += 7; ripples[i].life -= 0.012;
        if (ripples[i].life <= 0) ripples.splice(i, 1);
      }
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      const step = 12;
      for (let x = 0; x <= w + spacing; x += spacing) {
        ctx.beginPath();
        for (let y = 0; y <= h + step; y += step) { const [px, py] = displace(x, y); y === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
      }
      for (let y = 0; y <= h + spacing; y += spacing) {
        ctx.beginPath();
        for (let x = 0; x <= w + step; x += step) { const [px, py] = displace(x, y); x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };

    resize(); draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", click);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", click);
    };
  }, [spacing, color]);

  return <canvas ref={ref} className="kinetic-grid" aria-hidden="true" />;
}
