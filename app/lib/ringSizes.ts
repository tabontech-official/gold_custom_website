/**
 * Ring sizing for product pages. Rings carry no Size variant in Shopify, so
 * the chosen size travels as a cart line attribute — Shopify surfaces those as
 * line item properties on the order, which is what the workshop reads.
 */

/** Printable US chart in Shopify Files (Content > Files). Opens in a new tab. */
export const RING_SIZE_GUIDE_URL =
  'https://cdn.shopify.com/s/files/1/0806/9568/9464/files/gold_custom_la_us_ring_size_chart_actual_size-1.pdf?v=1783657762';

/** Line item property name shown in the cart and on the Shopify order. */
export const RING_SIZE_ATTRIBUTE_KEY = 'Ring Size';

export const DEFAULT_RING_SIZE = '7';

/**
 * US 4–12 in quarter steps. The printable chart lists half sizes only; quarter
 * sizes are offered because the chart's own note says wide bands, comfort-fit
 * rings, and swollen fingers run about 1/4 to 1/2 size small.
 */
export const RING_SIZES: string[] = Array.from(
  {length: (12 - 4) * 4 + 1},
  (_, index) => String(4 + index * 0.25),
);

/**
 * Whether a product is sized as a ring. Matches Shopify's taxonomy category so
 * new ring products are covered automatically, and compares it exactly — the
 * category for earrings also ends in "rings".
 */
export function isRingProduct(product: {
  category?: {name?: string | null} | null;
  productType?: string | null;
}): boolean {
  const category = product.category?.name?.trim().toLowerCase();
  if (category) return category === 'rings';
  // No taxonomy category assigned yet: fall back to the free-text type, where
  // "Engagement Rings" counts but "Stud Earrings" must not.
  return /\brings?\b/i.test(product.productType ?? '');
}
