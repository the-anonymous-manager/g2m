import { llmsShort } from '@/lib/llms';

// /llms.txt: a short guide to G2M for AI assistants (see lib/llms.ts). Rendered per request so live offers stay current.
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(llmsShort(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
