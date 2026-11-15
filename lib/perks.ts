/**
 * A perk that gives airport lounge access. Lounge visits "at fixed prices" (a pay-per-visit offer, e.g. Visa Airport
 * Companion on Visa Signature cards) are a discount, not access, so they don't count. Neither does a lounge perk marked
 * "coming soon" (not live yet, e.g. Tangem Pay's lounge visits).
 */
export const isLoungePerk = (p: string) => /lounge/i.test(p) && !/fixed price|coming soon/i.test(p);
