/**
 * The standard month of spending every card is scored on: $1,000 in five $200 buckets, 35 purchases.
 * The calculator's "balanced mix" spends any amount in the same proportions (20% in each purchase size).
 */
export const BASKET = [
  { usd: 200, count: 1 },
  { usd: 100, count: 2 },
  { usd: 50, count: 4 },
  { usd: 25, count: 8 },
  { usd: 10, count: 20 }
] as const;
export const BASKET_USD = BASKET.reduce((s, b) => s + b.usd * b.count, 0); // 1,000
export const BASKET_PURCHASES = BASKET.reduce((s, b) => s + b.count, 0); // 35
