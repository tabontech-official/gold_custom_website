// Run with: node --test app/lib/zeroPriceGuard.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {unpricedVariants} from './zeroPriceGuard.ts';

const gid = (n: number) => `gid://shopify/ProductVariant/${n}`;
const sf = (nodes: any[]) => ({query: async () => ({nodes}), CacheNone: () => null});

test('refuses $0, blank, unpublished and malformed variants', async () => {
  const lines = [gid(1), gid(2), gid(3), gid(4), 'gid://shopify/ProductVariant/NaN'].map(
    (merchandiseId) => ({merchandiseId}),
  );
  const bad = await unpricedVariants(
    sf([
      {id: gid(1), price: {amount: '800.0'}},
      {id: gid(2), price: {amount: '0.0'}},
      {id: gid(3), price: null},
      null, // draft / unpublished: Storefront API returns null
    ]),
    lines,
  );
  assert.deepEqual(bad, [gid(2), gid(3), gid(4), 'gid://shopify/ProductVariant/NaN']);
});

test('quantity-only updates pass', async () => {
  assert.deepEqual(await unpricedVariants(sf([]), [{merchandiseId: null}]), []);
});
