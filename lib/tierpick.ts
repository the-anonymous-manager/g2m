import type { CardRow, Tier } from '@/lib/types';
import { tierOffered } from '@/lib/regions';

// Picking one tier per card, shared by the calculator's "Compare tiers" and the Compare page. In links a pick is
// `slug` (every tier, or the card overview) or `slug:tier`, with the tier's real name as a slug: `kast:premium`.

export type TierPreset = 'all' | 'entry' | 'next' | 'top';
export type TierChoice = { slug: string; tier: string | null };

export const PICK = /^[a-z0-9-]{1,60}(:[a-z0-9-]{1,40})?$/;

/** "Premium+" -> "premium-plus", "VIP 1 to 2" -> "vip-1-to-2". */
export const tierSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'tier';

export function parsePick(entry: string): TierChoice {
  const [slug, tier] = entry.split(':');
  return { slug, tier: tier || null };
}

export const pickText = (p: TierChoice) => (p.tier ? `${p.slug}:${p.tier}` : p.slug);

/** Index of a picked tier on this card, or null for "every tier" / a tier the card no longer has. */
export function tierIndex(card: CardRow, tier: string | null): number | null {
  if (!tier) return null;
  const i = card.tiers.findIndex((t) => tierSlug(t.name) === tier);
  return i >= 0 ? i : null;
}

const usable = (card: CardRow, country?: string | null) =>
  card.tiers.map((t, i) => ({ t, i })).filter(({ t }) => !t.comingSoon && (!country || tierOffered(t, country)));

/**
 * The tier a preset picks on this card: its entry tier, the next tier up from it (the entry tier again when the
 * card has only one), or its top tier, among the tiers offered where the visitor lives. null for "all".
 */
export function presetIndex(card: CardRow, preset: TierPreset, country?: string | null): number | null {
  if (preset === 'all') return null;
  const list = usable(card, country).length ? usable(card, country) : usable(card);
  if (!list.length) return 0;
  if (preset === 'entry') return list[0].i;
  if (preset === 'top') return list[list.length - 1].i;
  return (list[1] ?? list[0]).i;
}

/** The preset every pick currently matches, if any. */
export function currentPreset(picks: { card: CardRow; tier: number | null }[], country?: string | null): TierPreset | null {
  if (!picks.length) return null;
  for (const preset of ['all', 'entry', 'next', 'top'] as TierPreset[]) {
    if (picks.every((p) => p.tier === presetIndex(p.card, preset, country))) return preset;
  }
  return null;
}

export const PRESET_LABEL: Record<TierPreset, string> = {
  all: 'All tiers',
  entry: 'Entry tier',
  next: 'Next tier up',
  top: 'Top tier'
};

/** The real tier names a preset would pick, e.g. "Premium · Pro · Luxe". */
export const presetNames = (cards: CardRow[], preset: TierPreset, country?: string | null) =>
  preset === 'all' ? '' : cards.map((c) => c.tiers[presetIndex(c, preset, country) ?? 0]?.name ?? '').join(' · ');

/** "Free", "$199 a year" or "Price not published". */
export const tierPrice = (t: Tier) =>
  t.feeUsdYear == null ? 'Price not published' : t.feeUsdYear ? `$${t.feeUsdYear.toLocaleString('en-US')} a year` : 'Free';
