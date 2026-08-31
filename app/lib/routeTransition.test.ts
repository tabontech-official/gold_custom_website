/**
 * Self-check for route-transition decisions.
 * No test runner in this project, so: `node app/lib/routeTransition.test.ts`
 *
 * The skeleton replaces the whole page body, so showing it at the wrong moment
 * is a visible regression rather than a silent one. These pin the two rules
 * that decide when it appears and what shape it takes.
 */
import assert from 'node:assert/strict';
import {
  isPageChange,
  routeSkeletonVariant,
  shouldShowSkeleton,
} from './routeTransition.ts';

// --- when to show it -------------------------------------------------------

// Real page changes: the whole point.
assert.equal(isPageChange('/collections/rings', '/'), true);
assert.equal(
  isPageChange('/collections/rings/products/x', '/collections/rings'),
  true,
);

// Same pathname is NOT a page change. Collection filters, sort and pagination
// all land here — they keep the pathname and vary only search params, and they
// have their own inline loading UI. Blanking the grid for a filter toggle
// would be a downgrade.
assert.equal(isPageChange('/collections/rings', '/collections/rings'), false);

// --- which shape to show ---------------------------------------------------

// Product URLs live under /collections/<collection>/products/<handle>, so the
// product check has to win over the /collections prefix. Getting this backwards
// flashes a collection grid on every product open.
assert.equal(
  routeSkeletonVariant('/collections/earrings/products/gold-hoop'),
  'product',
);
assert.equal(
  routeSkeletonVariant('/collections/chains/products/cuban'),
  'product',
);
// Flat form, for products whose category doesn't resolve.
assert.equal(routeSkeletonVariant('/products/gold-hoop'), 'product');

assert.equal(routeSkeletonVariant('/collections'), 'collection');
assert.equal(routeSkeletonVariant('/collections/earrings'), 'collection');
// A collection page, not a product — nothing follows the collection handle.
assert.equal(routeSkeletonVariant('/collections/all'), 'collection');

// A single article is prose; the blog index is a card grid, so it takes the
// grid shape instead. Getting this backwards produces a layout jump at commit,
// which is exactly what the skeleton exists to prevent.
assert.equal(routeSkeletonVariant('/blogs/cuban-link-guide'), 'article');
assert.equal(routeSkeletonVariant('/blogs'), 'collection');

// Anything unrecognised still gets a placeholder rather than a blank screen.
assert.equal(routeSkeletonVariant('/contact'), 'generic');
assert.equal(routeSkeletonVariant('/policies/finance'), 'generic');
assert.equal(routeSkeletonVariant('/'), 'generic');

// --- whether the skeleton should replace the page at all -------------------
//
// The regression this guards is specific and was expensive. Picking a Length,
// Karat or Center-Diamond value on a PDP navigates to a sibling *product*
// (those are separate Shopify products until the catalog is consolidated into
// real variants). That is a pathname change, so the skeleton tore the whole
// PDP out, mounted a PDP-shaped placeholder and mounted a fresh PDP after —
// remounting the gallery and flashing. Measured in Chrome, Android Chrome and
// Mobile Safari: it was the single thing that made variant switching read as a
// full page reload.
const PDP_A = '/collections/engagement-rings/products/edr29-2';
const PDP_B = '/collections/engagement-rings/products/edr29-3';
const PDP_FLAT = '/products/edr29-3';
const COLLECTION = '/collections/engagement-rings';
const ARTICLE = '/blogs/how-to-measure';

// Sibling-product navigation keeps the current PDP mounted.
assert.equal(shouldShowSkeleton(PDP_B, PDP_A), false);
assert.equal(shouldShowSkeleton(PDP_FLAT, PDP_A), false);
assert.equal(shouldShowSkeleton(PDP_A, PDP_FLAT), false);

// Same pathname never blanked and still must not.
assert.equal(shouldShowSkeleton(PDP_A, PDP_A), false);
assert.equal(shouldShowSkeleton(COLLECTION, COLLECTION), false);

// Every other cross-page navigation still gets the skeleton — that is the
// dead-tap window it was built to close, and dropping it would be a
// regression in the opposite direction.
assert.equal(shouldShowSkeleton(PDP_A, COLLECTION), true);
assert.equal(shouldShowSkeleton(COLLECTION, PDP_A), true);
assert.equal(shouldShowSkeleton(ARTICLE, PDP_A), true);
assert.equal(shouldShowSkeleton(COLLECTION, ARTICLE), true);
assert.equal(shouldShowSkeleton('/pages/about', PDP_A), true);

console.log('routeTransition: all assertions passed');
