/**
 * Decisions behind the route-transition skeleton, kept separate from the JSX
 * in components/RouteTransition.tsx so they can be asserted directly — Node
 * strips types from `.ts` but cannot transform `.tsx`.
 */

/**
 * Whether `next` is a different page from `current`, and therefore worth
 * replacing with a skeleton.
 *
 * The filters/pagination case is the one that matters and the one most likely
 * to regress: those navigate to the same pathname with different search
 * params, and they already render their own inline loading state. Blanking the
 * whole grid for a filter toggle would be worse than doing nothing.
 */
export function isPageChange(next: string, current: string) {
  return next !== current;
}

export type SkeletonVariant = 'product' | 'collection' | 'article' | 'generic';

/**
 * Maps a destination pathname to the placeholder shape to show for it, so the
 * layout that appears during loading is the layout that stays once the real
 * content commits. A single generic placeholder everywhere would reflow the
 * page at commit — the exact layout shift the skeleton exists to prevent.
 */
export function routeSkeletonVariant(pathname: string): SkeletonVariant {
  // Must be tested before the /collections prefix below: a product URL is
  // /collections/<collection>/products/<handle>, so the collection check would
  // otherwise swallow every product page and show a grid where a product is
  // about to land — the exact layout jump this function exists to prevent.
  if (/\/products\/[^/]+$/.test(pathname)) return 'product';
  if (pathname.startsWith('/collections')) return 'collection';
  // A single article is prose; the blog INDEX is a grid of cards, so it takes
  // the grid shape instead.
  if (/^\/blogs\/.+/.test(pathname)) return 'article';
  if (pathname.startsWith('/blogs')) return 'collection';
  return 'generic';
}
