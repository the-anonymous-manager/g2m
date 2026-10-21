'use client';

// Privacy-friendly analytics. Works with Plausible out of the box
// (set NEXT_PUBLIC_PLAUSIBLE_DOMAIN). Every event also fires a DOM event
// "g2m:track" so you can wire any other tool without touching components.
type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Props }) => void;
  }
}

export function track(event: string, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  try {
    window.plausible?.(event, { props });
    window.dispatchEvent(new CustomEvent('g2m:track', { detail: { event, props } }));
  } catch {
    // Analytics must never break the UI.
  }
}
