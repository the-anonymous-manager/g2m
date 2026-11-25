import { llmsFull } from '@/lib/llms';

// /llms-full.txt: every card's facts, the live offers and news, and the wording rules, in one plain-text page for AI
// assistants and research chats (see lib/llms.ts). Rendered per request so ended offers drop off by themselves.
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(llmsFull(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
