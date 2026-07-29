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

test('an unambiguous title overrides a miscategorised product', () => {
  // Real records from the catalog — the taxonomy is wrong in both directions.
  assert.ok(
    !isRingProduct({
      title: '10K 1.00CT Diamond Crowned Winged Dollar Sign Pendant in Yellow Gold',
      category: {name: 'Rings'},
      productType: '',
    }),
  );
  assert.ok(
    isRingProduct({
      title: '2.39 CT Cushion Diamond Engagement Ring in 14K Solid Gold',
      category: {name: 'Charms & Pendants'},
      productType: 'Rings',
    }),
  );
});

test('a title naming both falls back to the category', () => {
  // "Chain-Link Band" is a ring that names a chain: the two title signals
  // cancel, so the category decides.
  const bandTitle = '10K 1.00CT Diamond Pave Openwork Chain-Link Band in Yellow Gold';
  assert.ok(isRingProduct({title: bandTitle, category: {name: 'Rings'}}));
  assert.ok(!isRingProduct({title: bandTitle, category: {name: 'Chains'}}));
});
