import {CATEGORIES} from './categories.ts';

/**
 * Where a URL that no longer resolves should go when nothing more specific has
 * been set for it. server.ts asks this only after Shopify's own URL redirects
 * have passed through, so a redirect a merchant set always wins.
 *
 * Every target is a live category, or `/collections/all` as the last resort, so
 * a deleted URL lands in the catalogue rather than on an error page. Returns
 * null for paths with no shape covered here, and the 404 stands.
 */

// A deleted handle containing one of these words goes to the religious pendants.
const RELIGIOUS = /^(cross|saint|virgin|mary|jude|religious)/;

// Longest first, so "engagement-rings" is tried before "rings".
const CATEGORY_HANDLES = CATEGORIES.map((c) => c.handle).sort(
  (a, b) => b.length - a.length,
);

/** The live category a slug names: "gold-chain" → chains, "rings" → rings. */
function categoryFor(slug: string): string | null {
  for (const handle of CATEGORY_HANDLES) {
    const singular = handle.replace(/s$/, '');
    if (
      slug === handle ||
      slug === singular ||
      slug.endsWith(`-${handle}`) ||
      slug.endsWith(`-${singular}`)
    ) {
      return handle;
    }
  }
  return null;
}

/** Collection handle → a live collection handle. */
function collectionFor(handle: string): string {
  const slug = handle.toLowerCase();
  const category = categoryFor(slug);
  if (category) return category;
  if (slug.split('-').some((word) => RELIGIOUS.test(word))) {
    return 'religious-pendants';
  }
  return 'all';
}

/**
 * Product handle → the category its name ends on. Read from the end, so
 * "...cuban-link-chain-necklace" lands on necklaces. "diamond" is skipped
 * because it names the stone, not the piece.
 */
function productCategoryFor(handle: string): string {
  const words = handle
    .toLowerCase()
    .split('-')
    .filter((word) => word !== 'diamond')
    .reverse();
  for (const word of words) {
    const category = categoryFor(word);
    if (category) return category;
  }
  return 'all';
}

export function generalRedirectTarget(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '');
  let target: string | null = null;

  let match = /^\/collections\/([^/]+)$/.exec(path);
  if (match) target = `/collections/${collectionFor(match[1])}`;

  // The collection page itself applies the rule above if that collection is gone.
  match = /^\/collections\/([^/]+)\/products\/[^/]+$/.exec(path);
  if (match) target = `/collections/${match[1]}`;

  match = /^\/products\/([^/]+)$/.exec(path);
  if (match) target = `/collections/${productCategoryFor(match[1])}`;

  // A flat slug that names a category, e.g. /diamond-pendants or /rings.
  match = /^\/([^/]+)$/.exec(path);
  if (match) {
    const category = categoryFor(match[1].toLowerCase());
    if (category) target = `/collections/${category}`;
  }

  // Never send a path back to itself: a live /collections/chains 404ing for some
  // other reason would otherwise loop.
  return target && target !== path ? target : null;
}
