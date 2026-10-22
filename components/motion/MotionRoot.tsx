'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Runs in <head> before the first paint: opts the page into motion (scroll reveals, entrances)
// unless the visitor asked their system for reduced motion. Without it, everything simply shows.
export const motionInitScript = `(function(){try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('motion');}}catch(e){}})();`;

// Blocks that fade and rise into view as they scroll in. Grids reveal child by child.
const REVEAL = 'main .section > *, main .section-tight > *, [data-reveal]';
const STAGGER = '.grid-2, .grid-3, .market-grid';

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

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

/**
 * One controller for page motion: scroll reveals, counters, the Featured card tilt and magnetic buttons.
 *
 * Reveals fail open: a block is only hidden (data-rv="wait") once the script has seen it below the fold and
 * is watching it, so nothing can stay invisible if React re-renders it or the page changes. The state lives in a
 * data attribute because React rewrites className on re-render but leaves attributes it does not own alone.
 */
export function MotionRoot() {
  const pathname = usePathname();

  // Reveals and counters: one observer for the whole visit, so a page change can never strand a block.
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('motion')) return;

    const show = (el: HTMLElement) => {
      el.dataset.rv = 'in';
      el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          show(e.target as HTMLElement);
        }
      },
      { rootMargin: '0px 0px -6% 0px' }
    );

    let queued = 0;
    const scan = () => {
      queued = 0;
      const fold = window.innerHeight * 0.94;
      document.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
        if (el.dataset.rv) return;
        // Already on screen or scrolled past: leave it visible, no fade.
        if (el.getBoundingClientRect().top < fold) return show(el);
        el.querySelectorAll<HTMLElement>(STAGGER).forEach((grid) =>
          Array.from(grid.children).forEach((child, i) => (child as HTMLElement).style.setProperty('--i', String(i)))
        );
        el.dataset.rv = 'wait';
        io.observe(el);
      });
    };
    const queue = () => {
      if (!queued) queued = requestAnimationFrame(scan);
    };
    scan();
    // Client components (rankings, home lists) render after this runs; catch what they add.
    const mo = new MutationObserver(queue);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(queued);
      io.disconnect();
      mo.disconnect();
      // Anything still waiting is shown, never left hidden.
      document.querySelectorAll<HTMLElement>('[data-rv="wait"]').forEach((el) => (el.dataset.rv = 'in'));
    };
  }, []);

  // The Featured card tilt and magnetic buttons, for mouse and trackpad only. Re-bound on every page change.
  useEffect(() => {
    if (!document.documentElement.classList.contains('motion')) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cleanups: (() => void)[] = [];

    // The hero card leans toward the cursor and light runs across the metal.
    document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((area) => {
      const card = area.querySelector<HTMLElement>('.card-art');
      if (!card) return;
      let raf = 0, px = 0, py = 0;
      const paint = () => {
        raf = 0;
        card.style.setProperty('--ry', `${px * 16}deg`);
        card.style.setProperty('--rx', `${-py * 12}deg`);
        card.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
        card.style.setProperty('--my', `${(py + 0.5) * 100}%`);
      };
      const move = (e: PointerEvent) => {
        const r = area.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width - 0.5;
        py = (e.clientY - r.top) / r.height - 0.5;
        card.dataset.lit = 'true';
        if (!raf) raf = requestAnimationFrame(paint);
      };
      const leave = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
        card.dataset.lit = 'false';
      };
      area.addEventListener('pointermove', move);
      area.addEventListener('pointerleave', leave);
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        area.removeEventListener('pointermove', move);
        area.removeEventListener('pointerleave', leave);
      });
    });

    // Metal buttons drift a few pixels toward the cursor while it is over them.
    const move = (e: PointerEvent) => {
      const b = e.currentTarget as HTMLElement;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--tx', `${((e.clientX - r.left) / r.width - 0.5) * 8}px`);
      b.style.setProperty('--ty', `${((e.clientY - r.top) / r.height - 0.5) * 6}px`);
    };
    const leave = (e: PointerEvent) => {
      const b = e.currentTarget as HTMLElement;
      b.style.removeProperty('--tx');
      b.style.removeProperty('--ty');
    };
    document.querySelectorAll<HTMLElement>('.btn-metal').forEach((b) => {
      b.addEventListener('pointermove', move);
      b.addEventListener('pointerleave', leave);
      cleanups.push(() => {
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerleave', leave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [pathname]);

  return null;
}
