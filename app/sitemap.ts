import type { MetadataRoute } from 'next';
import { getCards, lastUpdated } from '@/lib/cards';
import { absoluteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(`${lastUpdated()}T00:00:00Z`);
  const pages = ['/', '/cards', '/finder', '/calculator', '/compare', '/methodology', '/submit'].map((p) => ({
    url: absoluteUrl(p),
    lastModified: updated,
    changeFrequency: 'weekly' as const,
    priority: p === '/' ? 1 : p === '/cards' ? 0.9 : 0.6
  }));
  const cards = getCards().map((c) => ({
    url: absoluteUrl(`/cards/${c.slug}`),
    lastModified: new Date(`${c.lastChecked}T00:00:00Z`),
    changeFrequency: 'weekly' as const,
    priority: 0.8
  }));
  return [...pages, ...cards];
}
