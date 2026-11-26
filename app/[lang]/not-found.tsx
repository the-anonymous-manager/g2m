import type { Metadata } from 'next';
import { NotFoundBody } from '@/components/NotFoundBody';

// A missing page names no main address: it inherited the home page's canonical, which Search Console can read as
// a duplicate of the home page (26 Nov 2026 coverage check). It is never indexed.
export const metadata: Metadata = { robots: { index: false, follow: true }, alternates: { canonical: null } };

export default function NotFound() {
  return <NotFoundBody />;
}
