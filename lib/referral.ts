import type { CardData } from '@/lib/types';

// "X referral code" pages (/cards/[slug]/referral-code): only for cards with G2M's referral link in the sheet and
// either a code to type or a sign-up bonus to explain. Everything on the page comes from the card data.

export const hasReferralPage = (c: Pick<CardData, 'links' | 'referralCode' | 'signupBonus'>) =>
  Boolean(c.links.affiliate && (c.referralCode || c.signupBonus));

export const referralPath = (slug: string) => `/cards/${slug}/referral-code`;
