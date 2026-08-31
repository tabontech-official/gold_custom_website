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

/**
 * Whether this navigation should have its page replaced by a skeleton.
 *
 * Product → product is deliberately excluded. Picking a Length, Karat or
 * Center-Diamond value on a PDP navigates to a *sibling product* (those are
 * separate Shopify products until the catalog is consolidated into real
 * variants), which is a pathname change — so the skeleton used to tear the
 * whole PDP out, mount a PDP-shaped placeholder, and mount a fresh PDP after.
 * The gallery remounted, page state was lost, and the flash read as a full
 * page reload on a page whose shell, layout and most content are identical.
 *
 * Keeping the current page mounted is both cheaper and more honest: the option
 * links prefetch on hover, so the wait is short, and RouteProgressBar still
 * runs — the visitor gets movement under the header instead of a blank page.
 *
 * Every other cross-page navigation (collection → product, product → article)
 * still gets the skeleton, which is the case it was built for: those genuinely
 * replace the whole layout, and leaving the old page up would be the dead-tap
 * window the skeleton exists to close.
 */
export function shouldShowSkeleton(next: string, current: string) {
  if (!isPageChange(next, current)) return false;
  const from = routeSkeletonVariant(current);
  const to = routeSkeletonVariant(next);
  return !(from === 'product' && to === 'product');
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
