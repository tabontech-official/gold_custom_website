/**
 * Self-check for generalRedirectTarget. No test runner in this project, so:
 * `node app/lib/legacyRedirects.test.ts`
 */
import assert from 'node:assert/strict';
import {generalRedirectTarget} from './legacyRedirects.ts';

// Deleted collections land on a live category, never an error.
assert.equal(
  generalRedirectTarget('/collections/radiant-engagement-rings'),
  '/collections/engagement-rings',
);
assert.equal(
  generalRedirectTarget('/collections/aztec-calendar-pendants'),
  '/collections/pendants',
);
assert.equal(
  generalRedirectTarget('/collections/crosses'),
  '/collections/religious-pendants',
);
assert.equal(
  generalRedirectTarget('/collections/birthstone-jewelry'),
  '/collections/all',
);

// A product under a gone collection goes to that collection page.
assert.equal(
  generalRedirectTarget('/collections/chains/products/some-product'),
  '/collections/chains',
);

// A deleted product goes to the category its name ends on, else the catalogue.
assert.equal(
  generalRedirectTarget(
    '/products/14k-diamond-pave-yellow-gold-cuban-link-chain-necklace-un-1908',
  ),
  '/collections/necklaces',
);
assert.equal(
  generalRedirectTarget('/products/some-deleted-thing'),
  '/collections/all',
);

// A flat slug that names a category.
assert.equal(
  generalRedirectTarget('/diamond-pendants'),
  '/collections/pendants',
);

// Never redirects a path to itself, and leaves unrelated 404s alone.
assert.equal(generalRedirectTarget('/collections/all'), null);
assert.equal(generalRedirectTarget('/collections/chains'), null);
assert.equal(generalRedirectTarget('/wp-login.php'), null);
assert.equal(generalRedirectTarget('/favicon.ico'), null);

console.log('legacyRedirects: all checks passed');
