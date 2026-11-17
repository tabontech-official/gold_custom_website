/**
 * Self-check for urlWithTrackingParams.
 * No test runner in this project, so: `node app/lib/search.test.ts`
 *
 * The predictive dropdown's product links carry the shopper's term as `q`.
 * It must be encoded exactly once — "cuban chain" used to arrive as
 * q=cuban%2520chain — and Shopify's trackingParameters must ride along intact.
 */
import assert from 'node:assert/strict';
import {urlWithTrackingParams} from './search.ts';

const TRACKING = '_pos=1&_psq=cuban&_ss=e&_v=1.0';
const url = (term: string, trackingParams: string | null = TRACKING) =>
  urlWithTrackingParams({baseUrl: '/products/x', trackingParams, term});

// The reported case.
assert.equal(url('cuban chain'), `/products/x?q=cuban%20chain&${TRACKING}`);
assert.ok(!url('cuban chain').includes('%25'));

// Round-trip: whatever was typed is exactly what the page reads back.
for (const term of [
  'cuban chain',
  '14k gold & diamond',
  'rope+chain',
  '50% off',
  'ring #5 / size 7?',
  'ear=rings',
  'café “oval”',
  '  padded  ',
  '',
]) {
  const query = new URL(url(term, null), 'https://x.test').searchParams;
  assert.equal(query.get('q'), term, `round-trip ${JSON.stringify(term)}`);
}

// Tracking params are appended verbatim and still parse.
const parsed = new URL(url('cuban chain'), 'https://x.test').searchParams;
assert.equal(parsed.get('_pos'), '1');
assert.equal(parsed.get('_psq'), 'cuban');
assert.equal(parsed.get('q'), 'cuban chain');

// No tracking params → no trailing '&'.
assert.equal(url('cuban chain', null), '/products/x?q=cuban%20chain');

// Extra params still come first.
assert.equal(
  urlWithTrackingParams({baseUrl: '/search', params: {type: 'product'}, term: 'a b'}),
  '/search?type=product&q=a%20b',
);

console.log('search: all checks passed');
