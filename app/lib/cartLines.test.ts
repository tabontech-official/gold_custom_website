// Run with: node --test app/lib/cartLines.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {cartLineAttribute, isInCart, linesNotInCart} from './cartLines.ts';

const line = (id: string, attributes?: Array<{key: string; value: string}>) => ({
  merchandise: {id},
  attributes: attributes ?? [],
});

await test('matches on the variant id', () => {
  const cart = {lines: {nodes: [line('gid://Variant/1')]}};
  assert.ok(isInCart(cart, [{merchandiseId: 'gid://Variant/1'}]));
  assert.ok(!isInCart(cart, [{merchandiseId: 'gid://Variant/2'}]));
});

await test('an empty or missing cart holds nothing', () => {
  assert.ok(!isInCart(null, [{merchandiseId: 'gid://Variant/1'}]));
  assert.ok(!isInCart({lines: {nodes: []}}, [{merchandiseId: 'gid://Variant/1'}]));
  // No lines requested — nothing to lock the button for.
  assert.ok(!isInCart({lines: {nodes: [line('gid://Variant/1')]}}, []));
});

await test('the same ring in another size is a different line', () => {
  const cart = {
    lines: {nodes: [line('gid://Variant/1', [{key: 'Ring size', value: '7'}])]},
  };
  assert.ok(
    isInCart(cart, [
      {merchandiseId: 'gid://Variant/1', attributes: [{key: 'Ring size', value: '7'}]},
    ]),
  );
  assert.ok(
    !isInCart(cart, [
      {merchandiseId: 'gid://Variant/1', attributes: [{key: 'Ring size', value: '8'}]},
    ]),
  );
});

await test('reads back the size a variant sits in the bag with', () => {
  const cart = {
    lines: {
      nodes: [
        line('gid://Variant/9'),
        line('gid://Variant/1', [{key: 'Ring size', value: '8.5'}]),
      ],
    },
  };
  assert.equal(
    cartLineAttribute(cart, 'gid://Variant/1', 'Ring size'),
    '8.5',
  );
  // Variant not in the bag, no such attribute, or nothing selected yet.
  assert.equal(cartLineAttribute(cart, 'gid://Variant/2', 'Ring size'), undefined);
  assert.equal(cartLineAttribute(cart, 'gid://Variant/9', 'Ring size'), undefined);
  assert.equal(cartLineAttribute(cart, undefined, 'Ring size'), undefined);
});

await test('extra attributes on the cart line are ignored', () => {
  const cart = {
    lines: {
      nodes: [
        line('gid://Variant/1', [
          {key: 'Ring size', value: '7'},
          {key: 'Gift note', value: 'Happy birthday'},
        ]),
      ],
    },
  };
  assert.ok(isInCart(cart, [{merchandiseId: 'gid://Variant/1'}]));
});

await test('bundle add omits items that are already in the cart', () => {
  const cart = {
    lines: {
      nodes: [
        line('gid://Variant/1', [{key: 'Ring Size', value: '7'}]),
      ],
    },
  };
  const bundle = [
    {
      merchandiseId: 'gid://Variant/1',
      attributes: [{key: 'Ring Size', value: '7'}],
    },
    {merchandiseId: 'gid://Variant/2'},
  ];

  assert.deepEqual(linesNotInCart(cart, bundle), [bundle[1]]);
});

await test('bundle still adds a ring configured to a different size', () => {
  const cart = {
    lines: {
      nodes: [
        line('gid://Variant/1', [{key: 'Ring Size', value: '7'}]),
      ],
    },
  };

  assert.deepEqual(
    linesNotInCart(cart, [
      {
        merchandiseId: 'gid://Variant/1',
        attributes: [{key: 'Ring Size', value: '8'}],
      },
    ]),
    [
      {
        merchandiseId: 'gid://Variant/1',
        attributes: [{key: 'Ring Size', value: '8'}],
      },
    ],
  );
});
