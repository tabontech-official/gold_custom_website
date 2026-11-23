/**
 * Savings we are willing to show. The compare-at price must sit above the
 * selling price, and the cut must be at most MAX_DISCOUNT_PERCENT. Anything
 * else is treated as bad data (a compare-at typed 10,000x too big, a compare-at
 * below the price) and the product shows its plain price instead.
 */
import {promotionPricing} from './promotionPricing.ts';

export const MAX_DISCOUNT_PERCENT = 60;

export type Savings = {percent: number; amount: number};

export function savingsFor(
  price: number | string | null | undefined,
  compareAt: number | string | null | undefined,
): Savings | null {
  const p = Number(price);
  const c = Number(compareAt);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c <= p)
    return null;
  const percent = Math.round((1 - p / c) * 100);
  if (percent < 1 || percent > MAX_DISCOUNT_PERCENT) return null;
  return {percent, amount: Math.round((c - p) * 100) / 100};
}

/** Shared campaign/backend savings for cards and the collection sale filter. */
export function productSavings(product: any): Savings | null {
  const pricing = promotionPricing(product);
  return savingsFor(pricing?.price.amount, pricing?.compareAtPrice?.amount);
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}
