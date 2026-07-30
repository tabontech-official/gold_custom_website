// Run with: node --test app/lib/cartLines.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {isInCart} from './cartLines.ts';

const line = (id: string, attributes?: Array<{key: string; value: string}>) => ({
  merchandise: {id},
  attributes: attributes ?? [],
});

test('matches on the variant id', () => {
  const cart = {lines: {nodes: [line('gid://Variant/1')]}};
  assert.ok(isInCart(cart, [{merchandiseId: 'gid://Variant/1'}]));
  assert.ok(!isInCart(cart, [{merchandiseId: 'gid://Variant/2'}]));
});

test('an empty or missing cart holds nothing', () => {
  assert.ok(!isInCart(null, [{merchandiseId: 'gid://Variant/1'}]));
  assert.ok(!isInCart({lines: {nodes: []}}, [{merchandiseId: 'gid://Variant/1'}]));
  // No lines requested — nothing to lock the button for.
  assert.ok(!isInCart({lines: {nodes: [line('gid://Variant/1')]}}, []));
});

test('the same ring in another size is a different line', () => {
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

test('extra attributes on the cart line are ignored', () => {
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
