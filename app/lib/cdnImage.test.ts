/**
 * Self-check for the CDN resize helpers behind the category carousel's srcset
 * and Hydrogen's `<Image>`.
 * No test runner in this project, so: `npx tsx app/lib/cdnImage.test.ts`
 * ponytail: plain asserts; move to a runner if this grows past a handful of cases.
 */
import assert from 'node:assert/strict';
import {cdnWidth, cdnLoader} from './cdnImage';

const BASE = 'https://cdn.shopify.com/s/files/1/0806/files/chain.webp';

// No existing query string → the param has to start one with `?`.
assert.equal(cdnWidth(BASE, 700), `${BASE}?width=700&quality=70`);

// Already has a query (Shopify always appends ?v=…) → must append with `&`,
// or the URL breaks and every card falls back to a broken image.
assert.equal(
  cdnWidth(`${BASE}?v=123`, 420),
  `${BASE}?v=123&width=420&quality=70`,
);

// Local /public files can't be resized by the CDN — pass through untouched.
assert.equal(cdnWidth('/chain.webp', 700), '/chain.webp');
assert.equal(cdnWidth('/gold%20ring.webp', 420), '/gold%20ring.webp');

// cdnLoader must reproduce Hydrogen's shopifyLoader exactly, plus quality —
// same param names, same order, fractional widths rounded. Drift here means a
// srcset entry the CDN answers with the wrong crop.
assert.equal(
  cdnLoader({src: BASE, width: 600, height: 600, crop: 'center'}),
  `${BASE}?width=600&height=600&crop=center&quality=70`,
);

// Width only (no aspectRatio) — height and crop must not be invented.
assert.equal(
  cdnLoader({src: BASE, width: 800}),
  `${BASE}?width=800&quality=70`,
);

// Fractional widths come out of generateSizes; the CDN wants integers.
assert.equal(
  cdnLoader({src: BASE, width: 399.6}),
  `${BASE}?width=400&quality=70`,
);

// Existing ?v= must survive, same as cdnWidth.
assert.equal(
  cdnLoader({src: `${BASE}?v=123`, width: 400}),
  `${BASE}?v=123&width=400&quality=70`,
);

// Relative src (dev-server assets) must stay relative — this is what the
// placeholder-origin round trip is for.
assert.equal(
  cdnLoader({src: '/chain.webp', width: 400}),
  '/chain.webp?width=400&quality=70',
);

// No src → empty string, so <Image> renders nothing rather than throwing.
assert.equal(cdnLoader({}), '');

console.log('cdnImage: all assertions passed');
