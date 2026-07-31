/**
 * Self-check for the CDN resize helper behind the category carousel's srcset.
 * No test runner in this project, so: `npx tsx app/components/CoverflowCarousel.test.ts`
 * ponytail: plain asserts; move to a runner if this grows past a handful of cases.
 */
import assert from 'node:assert/strict';
import {cdnWidth} from './CoverflowCarousel';

const BASE = 'https://cdn.shopify.com/s/files/1/0806/files/chain.webp';

// No existing query string → the param has to start one with `?`.
assert.equal(cdnWidth(BASE, 700), `${BASE}?width=700`);

// Already has a query (Shopify always appends ?v=…) → must append with `&`,
// or the URL breaks and every card falls back to a broken image.
assert.equal(
  cdnWidth(`${BASE}?v=123`, 420),
  `${BASE}?v=123&width=420`,
);

// Local /public files can't be resized by the CDN — pass through untouched.
assert.equal(cdnWidth('/chain.webp', 700), '/chain.webp');
assert.equal(cdnWidth('/gold%20ring.webp', 420), '/gold%20ring.webp');

console.log('CoverflowCarousel: all assertions passed');
