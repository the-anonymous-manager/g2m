import Script from 'next/script';

// Loads Plausible only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. No cookies, no consent banner needed.
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.outbound-links.js';
  return (
    <>
      <Script id="plausible-queue" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
      </Script>
      <Script defer data-domain={domain} src={src} strategy="afterInteractive" />
    </>
  );
}
