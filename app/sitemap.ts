import type { MetadataRoute } from 'next';
import { getCards, lastUpdated } from '@/lib/cards';
import { absoluteUrl } from '@/lib/site';
import { allPairs, versusPath } from '@/lib/versus';
import { FEES_GUIDE, TOPICS, countryGuidePath, countryGuides, countrySlug } from '@/lib/guides';
import { LOCALES, intlRankings, intlCompare, intlCalculator, intlFinder, intlAlternatives, intlCard, intlCountry, intlGuide, intlGuides, intlHome, intlMethodology, intlReferral, intlVersus } from '@/lib/i18n/locales';
import { intlTopics } from '@/lib/i18n/guides';
import { alternativesPath } from '@/lib/alternatives';
import { hasReferralPage, referralPath } from '@/lib/referral';

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(`${lastUpdated()}T00:00:00Z`);
  const pages = ['/', '/cards', '/finder', '/calculator', '/wallet', '/receipt', '/corridors', '/compare', '/methodology', '/submit'].map((p) => ({
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
  // "Best X alternatives", one per card.
  const alternatives = getCards().map((c) => ({
    url: absoluteUrl(alternativesPath(c.slug)),
    lastModified: updated,
    changeFrequency: 'weekly' as const,
    priority: 0.7
  }));
  // "X referral code", for cards with G2M's referral link and a code or bonus.
  const referrals = getCards()
    .filter(hasReferralPage)
    .map((c) => ({ url: absoluteUrl(referralPath(c.slug)), lastModified: new Date(`${c.lastChecked}T00:00:00Z`), changeFrequency: 'weekly' as const, priority: 0.7 }));
  // Every "X vs Y" page, dated by the older of the two cards' checks.
  const pairs = allPairs(getCards()).map(([a, b]) => ({
    url: absoluteUrl(versusPath(a.slug, b.slug)),
    lastModified: new Date(`${[a.lastChecked, b.lastChecked].sort()[0]}T00:00:00Z`),
    changeFrequency: 'weekly' as const,
    priority: 0.5
  }));
  // Guides: the hub, the topic guides and one per country with a guide.
  const guides = ['/guides', `/guides/${FEES_GUIDE.slug}`, ...TOPICS.map((t) => `/guides/${t.slug}`), ...countryGuides().map((g) => countryGuidePath(g.cc))].map(
    (p) => ({ url: absoluteUrl(p), lastModified: updated, changeFrequency: 'weekly' as const, priority: 0.7 })
  );
  // The other languages: home, every card, its alternatives and referral page, the guides, the methodology, the
  // country guides, and the "X vs Y" pages between the top-ranked cards (the rest are linked from those pages).
  const top = getCards().slice(0, 10);
  const topPairs = top.flatMap((a, i) => top.slice(i + 1).map((b) => versusPath(a.slug, b.slug).split('/').pop()!));
  const intl = LOCALES.flatMap((l) => [
    ...[intlRankings(l), intlCompare(l), intlCalculator(l), intlFinder(l), intlGuides(l), intlMethodology(l), ...intlTopics(l).map((t) => intlGuide(l, t.slug))].map((p) => ({
      url: absoluteUrl(p),
      lastModified: updated,
      changeFrequency: 'weekly' as const,
      priority: 0.5
    })),
    ...getCards().map((c) => ({ url: absoluteUrl(intlAlternatives(l, c.slug)), lastModified: updated, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...getCards()
      .filter(hasReferralPage)
      .map((c) => ({ url: absoluteUrl(intlReferral(l, c.slug)), lastModified: new Date(`${c.lastChecked}T00:00:00Z`), changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...topPairs.map((pair) => ({ url: absoluteUrl(intlVersus(l, pair)), lastModified: updated, changeFrequency: 'weekly' as const, priority: 0.4 })),
    { url: absoluteUrl(intlHome(l)), lastModified: updated, changeFrequency: 'weekly' as const, priority: 0.8 },
    ...getCards().map((c) => ({
      url: absoluteUrl(intlCard(l, c.slug)),
      lastModified: new Date(`${c.lastChecked}T00:00:00Z`),
      changeFrequency: 'weekly' as const,
      priority: 0.6
    })),
    ...countryGuides().map((g) => ({ url: absoluteUrl(intlCountry(l, countrySlug(g.cc))), lastModified: updated, changeFrequency: 'weekly' as const, priority: 0.5 }))
  ]);
  return [...pages, ...cards, ...alternatives, ...referrals, ...guides, ...intl, ...pairs];
}
