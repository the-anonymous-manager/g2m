import Link from 'next/link';
import { Eyebrow } from '@/components/bits';

export default function NotFound() {
  return (
    <div className="wrap section stack" style={{ gap: 16, alignItems: 'flex-start', minHeight: '50vh' }}>
      <Eyebrow>404</Eyebrow>
      <h1 className="h2">This page isn&apos;t in the directory</h1>
      <p className="lead">The card or page may have moved. The full rankings are a good place to start.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/cards" className="btn btn-metal">
          See all cards
        </Link>
        <Link href="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  );
}
