// Run with: node --test app/lib/ringSizes.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_RING_SIZE,
  RING_SIZES,
  isRingProduct,
} from './ringSizes.ts';

test('sizes span US 4-12 in quarter steps', () => {
  assert.equal(RING_SIZES.length, 33);
  assert.deepEqual(RING_SIZES.slice(0, 5), ['4', '4.25', '4.5', '4.75', '5']);
  assert.equal(RING_SIZES.at(-1), '12');
  assert.ok(RING_SIZES.includes(DEFAULT_RING_SIZE));
});

test('rings are sized, other jewelry is not', () => {
  assert.ok(isRingProduct({category: {name: 'Rings'}}));
  assert.ok(isRingProduct({category: null, productType: 'Engagement Rings'}));
  // Earrings end in "rings" — the trap this function exists to avoid.
  assert.ok(!isRingProduct({category: {name: 'Earrings'}}));
  assert.ok(!isRingProduct({category: null, productType: 'Stud Earrings'}));
  assert.ok(!isRingProduct({category: {name: 'Chains'}, productType: 'Rings'}));
  assert.ok(!isRingProduct({}));
});
