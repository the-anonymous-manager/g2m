'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Runs in <head> before the first paint: opts the page into motion (scroll reveals, entrances)
// unless the visitor asked their system for reduced motion. Without it, everything simply shows.
export const motionInitScript = `(function(){try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('motion');}}catch(e){}})();`;

// Blocks that fade, rise and un-blur into view as they scroll in. Grids reveal child by child.
const REVEAL = 'main .section > *, main .section-tight > *, [data-reveal]';
const STAGGER = '.grid-2, .grid-3, .market-grid';
const INTERACTIVE = 'a, button, [role="button"], label.check, select, summary, .chip';

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** One controller for all page motion: cursor, reveals, card tilt, magnetic buttons and counters. */
export function MotionRoot() {
  const pathname = usePathname();
  const cursor = useRef<HTMLDivElement>(null);

  // Custom cursor: a small metal square that becomes a card outline over anything clickable.
  useEffect(() => {
    const el = cursor.current;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || !fine || calm) return;
    const root = document.documentElement;
    root.classList.add('has-cursor');
    let x = -100, y = -100, cx = x, cy = y, raf = 0, shown = false;
    const tick = () => {
      cx += (x - cx) * 0.24;
      cy += (y - cy) * 0.24;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.1 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        cx = x;
        cy = y;
        shown = true;
        el.dataset.on = 'true';
      }
      const t = e.target as Element | null;
      el.dataset.mode = t?.closest('input, textarea, [contenteditable="true"]') ? 'text' : t?.closest(INTERACTIVE) ? 'link' : 'dot';
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const leave = () => {
      shown = false;
      el.dataset.on = 'false';
    };
    const down = () => (el.dataset.down = 'true');
    const up = () => (el.dataset.down = 'false');
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove('has-cursor');
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  // Reveals, counters, tilt and magnetic buttons. Re-scanned on every page change.
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('motion')) return;
    root.classList.add('motion-ready');
    const cleanups: (() => void)[] = [];

    const countUp = (el: HTMLElement) => {
      const target = Number(el.dataset.count ?? el.textContent);
      if (!Number.isFinite(target) || target <= 0) return;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / 900, 1);
        el.textContent = String(Math.round(target * ease(t)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.add('in');
          el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
          io.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    const scan = () => {
      document.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
        if (el.dataset.revealSeen) return;
        el.dataset.revealSeen = '1';
        el.classList.add('reveal');
        el.querySelectorAll<HTMLElement>(STAGGER).forEach((grid) =>
          Array.from(grid.children).forEach((child, i) => (child as HTMLElement).style.setProperty('--i', String(i)))
        );
        io.observe(el);
      });
    };
    scan();
    // Client components (rankings, home lists) render after this runs; catch what they add.
    const mo = new MutationObserver(() => scan());
    mo.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });
    cleanups.push(() => {
      io.disconnect();
      mo.disconnect();
    });

    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      // The hero card leans toward the cursor and light runs across the metal.
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((area) => {
        const card = area.querySelector<HTMLElement>('.card-art');
        if (!card) return;
        const move = (e: PointerEvent) => {
          const r = area.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.setProperty('--ry', `${px * 16}deg`);
          card.style.setProperty('--rx', `${-py * 12}deg`);
          card.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
          card.style.setProperty('--my', `${(py + 0.5) * 100}%`);
          card.dataset.lit = 'true';
        };
        const leave = () => {
          card.style.setProperty('--ry', '0deg');
          card.style.setProperty('--rx', '0deg');
          card.dataset.lit = 'false';
        };
        area.addEventListener('pointermove', move);
        area.addEventListener('pointerleave', leave);
        cleanups.push(() => {
          area.removeEventListener('pointermove', move);
          area.removeEventListener('pointerleave', leave);
        });
      });

      // Metal buttons drift a few pixels toward the cursor.
      const magnet = (e: PointerEvent) => {
        const b = (e.target as Element | null)?.closest<HTMLElement>('.btn-metal');
        document.querySelectorAll<HTMLElement>('.btn-metal[data-pull]').forEach((o) => {
          if (o !== b) {
            o.style.removeProperty('--tx');
            o.style.removeProperty('--ty');
            delete o.dataset.pull;
          }
        });
        if (!b) return;
        const r = b.getBoundingClientRect();
        b.dataset.pull = '1';
        b.style.setProperty('--tx', `${((e.clientX - r.left) / r.width - 0.5) * 8}px`);
        b.style.setProperty('--ty', `${((e.clientY - r.top) / r.height - 0.5) * 6}px`);
      };
      window.addEventListener('pointermove', magnet, { passive: true });
      cleanups.push(() => window.removeEventListener('pointermove', magnet));
    }

    return () => cleanups.forEach((fn) => fn());
  }, [pathname]);

  return <div ref={cursor} className="cursor" aria-hidden="true" data-on="false" data-mode="dot" />;
}
