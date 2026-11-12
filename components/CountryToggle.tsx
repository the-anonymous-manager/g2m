'use client';

import { useEffect, useState } from 'react';

// Opens and closes the card page's full country list (the section with id `target`), which starts closed.
// A link to #countries opens it straight away.
export function CountryToggle({ target, label, hideLabel = 'Hide the country list' }: { target: string; label: string; hideLabel?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === `#${target}`) setOpen(true);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [target]);

  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    el.hidden = !open;
  }, [open, target]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Wait for the section to show, then bring it into view.
      requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
    <button type="button" className="country-jump" aria-expanded={open} aria-controls={target} onClick={toggle}>
      {open ? hideLabel : label}{' '}
      <span aria-hidden="true" className="country-jump-arrow" data-open={open}>
        ↓
      </span>
    </button>
  );
}
