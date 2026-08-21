import {CacheCustom, type CachingStrategy} from '@shopify/hydrogen';

/**
 * Cache tiers for Storefront API sub-requests, by how fast the underlying data
 * actually changes.
 *
 * WHY THIS FILE EXISTS
 *
 * `storefront.query(QUERY)` with no `cache` option is NOT uncached, and it is
 * not CacheShort either. Hydrogen applies `CacheDefault()`:
 *
 *     {mode: 'public', maxAge: 1, staleWhileRevalidate: 86399}
 *
 * — a ONE DAY stale window. (Verified in
 * node_modules/@shopify/hydrogen/dist/production/index.js, and documented at
 * shopify.dev/docs/storefronts/headless/hydrogen/caching under "Default
 * caching strategy".) Leaving `cache` off to keep something fresh does the
 * exact opposite of what it looks like. Every query in this app now names its
 * tier explicitly so that trap cannot be re-entered by omission.
 *
 * HOW THE TWO NUMBERS BEHAVE
 *
 * - Inside `maxAge`: served from cache, no upstream call. Fast and fresh.
 * - Between `maxAge` and `maxAge + staleWhileRevalidate`: the STALE copy is
 *   served to this visitor and a refresh runs in the background. Fast, and
 *   this visitor may see old data — that is the actual cost of a wide SWR.
 * - Past both: full blocking round-trip to the Storefront API.
 *
 * So `maxAge` is "how fresh", `staleWhileRevalidate` is "how long we stay fast
 * while going stale". Worst-case staleness is the sum. Widening SWR buys TTFB
 * on low-traffic URLs and pays for it in one stale render per window.
 *
 * ponytail: five named tiers, no per-query tuning knobs. The point is that a
 * reviewer can see the freshness contract at the call site without doing
 * arithmetic, and that the numbers live in one file when they need tuning.
 */

/** `maxAge + staleWhileRevalidate`, as a human-readable worst case. */
const worst = (o: CachingStrategy) =>
  `${((o.maxAge ?? 0) + (o.staleWhileRevalidate ?? 0)) / 60} min`;

/**
 * Price and inventory a customer is about to act on: the product detail page,
 * the wishlist, the AJAX product endpoint.
 *
 * Worst case 3 minutes. Deliberately the tightest tier that still caches:
 * Shopify's own guidance names product price as the CacheShort example, but
 * CacheShort's 10-second window means every request to a long-tail SKU is a
 * blocking round-trip. 60s of freshness keeps any PDP with more than one view
 * a minute warm, and the checkout re-prices from Shopify regardless, so a
 * few minutes of drift is a display concern rather than a billing one.
 */
export const CachePrice = () =>
  CacheCustom({mode: 'public', maxAge: 60, staleWhileRevalidate: 120});

/**
 * Product LISTS — collection grids, homepage rails, search results,
 * recommendations. Browsing surfaces rather than decision surfaces.
 *
 * Worst case 20 minutes. These are the most expensive queries in the app (a
 * grid is 24 products with prices and images), so they are also where cache
 * hits save the most Storefront API quota. A merchant adding a product to a
 * collection sees it within 5 minutes, or on the second refresh after that.
 */
export const CacheCatalog = () =>
  CacheCustom({mode: 'public', maxAge: 300, staleWhileRevalidate: 900});

/**
 * Navigation: header and footer menus, category menus.
 *
 * Worst case 12 minutes. Tighter than CacheContent because merchants edit
 * menus and immediately check the storefront, and wider than CacheShort
 * because this runs in the ROOT loader on literally every page — a 10-second
 * window there means a blocking Storefront round-trip in front of most page
 * views on a quiet store.
 */
export const CacheNav = () =>
  CacheCustom({mode: 'public', maxAge: 120, staleWhileRevalidate: 600});

/**
 * Authored / CMS-driven content: hero slides, promotional banners, category
 * tiles, FAQs, blog articles, metaobject-backed sections.
 *
 * Worst case 65 minutes. This content changes a few times a year and carries
 * no prices, so it is the cheapest thing in the app to cache hard.
 */
export const CacheContent = () =>
  CacheCustom({mode: 'public', maxAge: 300, staleWhileRevalidate: 3600});

/**
 * Shop configuration and legal copy: policies, Shop Pay installment config,
 * robots/llms shop fields. Changes on the order of never.
 *
 * Worst case 24 hours — same as Hydrogen's CacheLong, which is what this is.
 */
export const CacheStatic = () =>
  CacheCustom({mode: 'public', maxAge: 3600, staleWhileRevalidate: 82800});

/**
 * Self-check: the tiers must stay ordered, and none may silently inherit the
 * 24h default window that this module exists to prevent.
 *
 * ponytail: one assert block, no test framework. Run with
 * `npx tsx app/lib/cache.ts`.
 */
export function demo() {
  const tiers = [
    ['CachePrice', CachePrice()],
    ['CacheCatalog', CacheCatalog()],
    ['CacheNav', CacheNav()],
    ['CacheContent', CacheContent()],
    ['CacheStatic', CacheStatic()],
  ] as const;

  for (const [name, o] of tiers) {
    if (o.mode !== 'public') throw new Error(`${name}: expected public mode`);
    if (!o.maxAge || o.maxAge < 1) throw new Error(`${name}: maxAge unset`);
    // The bug this module prevents: CacheDefault's 86399s SWR.
    if (o.staleWhileRevalidate === 86399)
      throw new Error(`${name}: that is the 24h default window`);
  }

  // Price must be the freshest tier; static the stalest.
  const total = (o: CachingStrategy) =>
    (o.maxAge ?? 0) + (o.staleWhileRevalidate ?? 0);
  const totals = tiers.map(([, o]) => total(o));
  if (Math.min(...totals) !== total(CachePrice()))
    throw new Error('CachePrice must be the freshest tier');
  if (Math.max(...totals) !== total(CacheStatic()))
    throw new Error('CacheStatic must be the stalest tier');

  for (const [name, o] of tiers) console.log(`${name}: worst case ${worst(o)}`);
  console.log('cache tiers ok');
}

// Run demo() only when this file IS the entry point. Checks argv, not
// import.meta.url, because import.meta.url always ends in /cache.ts and would
// fire the self-check on every import — including in the worker. `typeof
// process` because the Oxygen runtime has no `process` global at all.
if (
  typeof process !== 'undefined' &&
  process.argv?.[1]?.replace(/\\/g, '/').endsWith('app/lib/cache.ts')
) {
  demo();
}
