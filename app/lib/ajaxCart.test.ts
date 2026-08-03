// Run with: node --test app/lib/ajaxCart.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {toAjaxCart, toCents, gidToNumber} from './ajaxCart.ts';

const usd = (amount: string) => ({amount, currencyCode: 'USD'});

const line = (over = {}) => ({
  id: 'gid://shopify/CartLine/abc',
  quantity: 1,
  attributes: [{key: 'Ring size', value: '9'}],
  cost: {totalAmount: usd('440.0'), amountPerQuantity: usd('440.0')},
  merchandise: {
    id: 'gid://shopify/ProductVariant/48525937934584',
    title: '10K Yellow Gold',
    requiresShipping: true,
    image: {url: 'https://cdn.shopify.com/x.jpg'},
    price: usd('440.0'),
    product: {
      id: 'gid://shopify/Product/9616294576376',
      handle: '10k-rope-chain',
      title: '10K Rope Chain',
      vendor: 'Gold Custom',
    },
    selectedOptions: [{name: 'Metal', value: '10K Yellow Gold'}],
  },
  ...over,
});

const cart = (over = {}) => ({
  id: 'gid://shopify/Cart/c1-abc?key=xyz',
  totalQuantity: 1,
  note: null,
  attributes: [],
  cost: {totalAmount: usd('440.0'), subtotalAmount: usd('440.0')},
  lines: {nodes: [line()]},
  discountCodes: [],
  ...over,
});

test('money is integer minor units, not decimal strings', () => {
  // The whole point: "$440.00" must be 44000, not 440 and not 4.4.
  assert.equal(toCents(usd('440.0')), 44000);
  assert.equal(toCents(usd('39.71')), 3971);
  assert.equal(toCents(usd('0.1')), 10);
  // Float noise: 19.99 * 100 is 1998.9999... in binary floating point.
  assert.equal(toCents(usd('19.99')), 1999);
  assert.equal(toCents(usd('1234.56')), 123456);
  assert.equal(toCents(null), 0);
  assert.equal(toCents(usd('not money')), 0);
});

test('a real line maps to the shape a cart-reading script expects', () => {
  const out = toAjaxCart(cart());
  const item = out.items[0];

  assert.equal(out.item_count, 1);
  assert.equal(out.total_price, 44000);
  assert.equal(out.items_subtotal_price, 44000);
  assert.equal(out.currency, 'USD');
  assert.equal(out.requires_shipping, true);

  // Shopify keys an item by variant id; the line id goes in `key`.
  assert.equal(item.id, 48525937934584);
  assert.equal(item.variant_id, 48525937934584);
  assert.equal(item.product_id, 9616294576376);
  assert.equal(item.key, 'gid://shopify/CartLine/abc');
  assert.equal(item.title, '10K Rope Chain - 10K Yellow Gold');
  assert.equal(item.price, 44000);
  assert.equal(item.line_price, 44000);
  assert.equal(item.url, '/products/10k-rope-chain?variant=48525937934584');
  assert.deepEqual(item.properties, {'Ring size': '9'});
  assert.deepEqual(item.variant_options, ['10K Yellow Gold']);
});

test('quantity multiplies the line, not the unit price', () => {
  const out = toAjaxCart(
    cart({
      totalQuantity: 3,
      cost: {totalAmount: usd('1320.0'), subtotalAmount: usd('1320.0')},
      lines: {
        nodes: [
          line({
            quantity: 3,
            cost: {
              totalAmount: usd('1320.0'),
              amountPerQuantity: usd('440.0'),
            },
          }),
        ],
      },
    }),
  );
  assert.equal(out.items[0].price, 44000);
  assert.equal(out.items[0].line_price, 132000);
  assert.equal(out.total_price, 132000);
});

test('a product with no real options drops the Default Title placeholder', () => {
  const out = toAjaxCart(
    cart({
      lines: {
        nodes: [
          line({
            merchandise: {
              ...line().merchandise,
              title: 'Default Title',
              selectedOptions: [],
            },
          }),
        ],
      },
    }),
  );
  assert.equal(out.items[0].title, '10K Rope Chain');
  assert.equal(out.items[0].product_has_only_default_variant, true);
});

test('an empty or missing cart returns a valid empty cart, never throws', () => {
  for (const empty of [null, undefined, {}, {lines: {nodes: []}}]) {
    const out = toAjaxCart(empty as never);
    assert.deepEqual(out.items, []);
    assert.equal(out.item_count, 0);
    assert.equal(out.total_price, 0);
    assert.equal(out.currency, 'USD');
    assert.equal(out.requires_shipping, false);
  }
});

test('gids reduce to bare numeric ids', () => {
  assert.equal(gidToNumber('gid://shopify/Product/123'), 123);
  assert.equal(gidToNumber(undefined), 0);
  assert.equal(gidToNumber('gid://shopify/Product/'), 0);
});
