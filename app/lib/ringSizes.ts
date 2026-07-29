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

/** Item nouns that mean "not sized like a ring" when they head the title. */
const NON_RING_NOUN = /\b(pendant|necklace|bracelet|earring|charm|anklet|chain)s?\b/i;

/**
 * "Band" counts as a ring word: wedding bands and styles like "Chain-Link
 * Band" are rings. `\b` keeps "Earrings" from matching "ring".
 */
const RING_NOUN = /\b(ring|band)s?\b/i;

/**
 * Whether a product is sized as a ring.
 *
 * The catalog's taxonomy is unreliable in BOTH directions — there are pendants
 * filed under the "Rings" category with an empty productType, and at least one
 * engagement ring filed under "Charms & Pendants". Trusting `category` alone
 * put a ring-size dropdown on ~17 pendants.
 *
 * So an unambiguous title wins: it's merchandiser-written and describes the
 * physical object, whereas the category is a bulk-assigned field nobody
 * re-checks. Taxonomy is still the fallback when the title says nothing
 * either way, or says both (e.g. "Chain-Link Band" — a ring that names a
 * chain, which is exactly why the two signals have to disagree before the
 * category gets a vote).
 */
export function isRingProduct(product: {
  title?: string | null;
  category?: {name?: string | null} | null;
  productType?: string | null;
}): boolean {
  const title = product.title ?? '';
  const saysRing = RING_NOUN.test(title);
  const saysOther = NON_RING_NOUN.test(title);

  if (saysOther && !saysRing) return false;
  if (saysRing && !saysOther) return true;

  // Title is silent or self-contradictory — defer to the taxonomy category,
  // compared exactly because the category for earrings also ends in "rings".
  const category = product.category?.name?.trim().toLowerCase();
  if (category) return category === 'rings';

  // No category assigned: fall back to the free-text type, where
  // "Engagement Rings" counts but "Stud Earrings" must not.
  return /\brings?\b/i.test(product.productType ?? '');
}
