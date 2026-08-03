/**
 * Self-check for route-transition decisions.
 * No test runner in this project, so: `node app/lib/routeTransition.test.ts`
 *
 * The skeleton replaces the whole page body, so showing it at the wrong moment
 * is a visible regression rather than a silent one. These pin the two rules
 * that decide when it appears and what shape it takes.
 */
import assert from 'node:assert/strict';
import {isPageChange, routeSkeletonVariant} from './routeTransition.ts';

// --- when to show it -------------------------------------------------------

// Real page changes: the whole point.
assert.equal(isPageChange('/collections/rings', '/'), true);
assert.equal(isPageChange('/products/rings/x', '/collections/rings'), true);

// Same pathname is NOT a page change. Collection filters, sort and pagination
// all land here — they keep the pathname and vary only search params, and they
// have their own inline loading UI. Blanking the grid for a filter toggle
// would be a downgrade.
assert.equal(isPageChange('/collections/rings', '/collections/rings'), false);

// --- which shape to show ---------------------------------------------------

assert.equal(routeSkeletonVariant('/products/earrings/gold-hoop'), 'product');
assert.equal(routeSkeletonVariant('/products/chains/cuban'), 'product');

assert.equal(routeSkeletonVariant('/collections'), 'collection');
assert.equal(routeSkeletonVariant('/collections/earrings'), 'collection');

// A single article is prose; the blog index is a card grid, so it takes the
// grid shape instead. Getting this backwards produces a layout jump at commit,
// which is exactly what the skeleton exists to prevent.
assert.equal(routeSkeletonVariant('/blogs/cuban-link-guide'), 'article');
assert.equal(routeSkeletonVariant('/blogs'), 'collection');

// Anything unrecognised still gets a placeholder rather than a blank screen.
assert.equal(routeSkeletonVariant('/contact'), 'generic');
assert.equal(routeSkeletonVariant('/policies/finance'), 'generic');
assert.equal(routeSkeletonVariant('/'), 'generic');

console.log('routeTransition: all assertions passed');
