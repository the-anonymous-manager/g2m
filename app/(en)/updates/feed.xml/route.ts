import { getUpdates, updatePath } from '@/lib/updates';
import { absoluteUrl, site } from '@/lib/site';
import { en } from '@/lib/i18n/dict/en';

// RSS feed of the Updates page (/updates/feed.xml), for feed readers and channels that repost new posts.
// Built ahead of time at every deploy.
export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  const posts = getUpdates().slice(0, 50);
  const items = posts
    .map((u) => {
      const url = absoluteUrl(updatePath(u.slug));
      return `<item><title>${esc(u.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(`${u.date}T00:00:00Z`).toUTCString()}</pubDate><description>${esc(u.sponsored ? `Sponsored. ${u.summary}` : u.summary)}</description></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(`${site.name}: ${en.updTitle}`)}</title><link>${absoluteUrl('/updates')}</link><description>${esc(en.updDesc)}</description><language>en</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
