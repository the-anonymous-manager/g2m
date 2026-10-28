import Script from 'next/script';

// Loads Plausible only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. No cookies, no consent banner needed.
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.outbound-links.js';
  return (
    <>
      {/*
        A custom/renamed script (NEXT_PUBLIC_PLAUSIBLE_SRC, e.g. an ad-block-resistant "pa-..." name from
        Plausible's own install screen) is Plausible's newer script format: it self-inits and starts counting
        visits as soon as it finds window.plausible.o set, so this just needs to exist before it loads. Safe for
        the classic default script too, which ignores window.plausible.o and auto-tracks regardless.
      */}
      <Script id="plausible-queue" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};window.plausible.o={autoCapturePageviews:true}`}
      </Script>
      <Script defer data-domain={domain} src={src} strategy="afterInteractive" />
    </>
  );
}
