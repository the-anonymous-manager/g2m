/**
 * A perk that gives airport lounge access. Lounge visits "at fixed prices" (a pay-per-visit offer, e.g. Visa Airport
 * Companion on Visa Signature cards) are a discount, not access, so they don't count.
 */
export const isLoungePerk = (p: string) => /lounge/i.test(p) && !/fixed price/i.test(p);
