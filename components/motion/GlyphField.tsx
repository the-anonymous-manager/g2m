'use client';

import { useEffect, useRef } from 'react';

// Shades from empty to dense, drawn in Roboto Mono.
const RAMP = '  ..··::--==++**xx%%#';
const CELL_W = 12;
const CELL_H = 20;
const GLOW = 150; // px around the cursor that light up in rose gold
const FPS = 24; // the waves drift slowly, so a lower frame rate looks the same and costs far less

/**
 * A drifting field of mono glyphs behind the hero, like contour lines on a map, lit up around
 * the cursor. Paused off-screen and in background tabs; a single still frame on touch screens or
 * when the visitor prefers reduced motion.
 */
export function GlyphField() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const still =
      matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches;

    let w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, visible = true, frame = 0;
    let ink = '#6f695d', glow = '#9a5340';
    const pointer = { x: -1e4, y: -1e4 };
    const client = { x: -1e4, y: -1e4 };

    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      ink = s.getPropertyValue('--faint').trim() || ink;
      glow = s.getPropertyValue('--accent').trim() || glow;
    };
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `500 11px 'Roboto Mono', ui-monospace, monospace`;
      ctx.textBaseline = 'top';
      cols = Math.ceil(w / CELL_W);
      rows = Math.ceil(h / CELL_H);
    };

    const draw = (t: number) => {
      if (frame++ % 90 === 0) readColors();
      ctx.clearRect(0, 0, w, h);
      const s = t / 1000;
      let pen = '';
      for (let r = 0; r < rows; r++) {
        const y = r * CELL_H;
        for (let c = 0; c < cols; c++) {
          const x = c * CELL_W;
          // Two slow waves folded into each other read as drifting contour bands.
          const v =
            Math.sin(c * 0.052 + 1.9 * Math.sin(r * 0.11 + s * 0.35) + s * 0.22) * 0.65 +
            Math.sin(r * 0.19 - c * 0.021 + s * 0.4) * 0.35;
          let n = (v + 1) / 2;
          n = n * n * n;
          const d = Math.hypot(pointer.x - x, pointer.y - y);
          const lit = d < GLOW ? 1 - d / GLOW : 0;
          const level = Math.min(RAMP.length - 1, Math.floor((n + lit * 0.55) * RAMP.length));
          const ch = RAMP[level];
          if (ch === ' ') continue;
          const color = lit > 0.05 ? glow : ink;
          if (color !== pen) ctx.fillStyle = pen = color;
          ctx.globalAlpha = lit > 0.05 ? 0.25 + lit * 0.75 : 0.12 + n * 0.5;
          ctx.fillText(ch, x, y);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || t - last < 1000 / FPS) return;
      last = t;
      const r = cv.getBoundingClientRect();
      pointer.x = client.x - r.left;
      pointer.y = client.y - r.top;
      draw(t);
    };

    readColors();
    resize();
    draw(performance.now());
    if (still) {
      const ro = new ResizeObserver(() => {
        resize();
        draw(performance.now());
      });
      ro.observe(cv);
      return () => ro.disconnect();
    }

    // Keep the raw position; it is turned into canvas space once per frame, not on every mouse event.
    const move = (e: PointerEvent) => {
      client.x = e.clientX;
      client.y = e.clientY;
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    const ro = new ResizeObserver(resize);
    io.observe(cv);
    ro.observe(cv);
    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return <canvas ref={canvas} className="glyph-field" aria-hidden="true" />;
}
