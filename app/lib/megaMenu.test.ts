/**
 * Self-check for department ownership of a SHARED sub-category.
 * Run: `npx vite-node app/lib/megaMenu.test.ts`
 * ponytail: plain asserts, no runner.
 *
 * `tennis-chains` is listed by both Chains and Diamond. Without a hint,
 * Diamond owns it (Chains yieldsTo Diamond); clicking it from the Chains nav
 * must keep the shopper in Chains.
 */
import assert from 'node:assert/strict';
import {getDepartmentForCollectionHandle} from './megaMenu.ts';

const item = (handle: string) => ({
  id: handle,
  title: handle,
  url: `https://shop.example.com/collections/${handle}`,
  resource: {__typename: 'Collection', handle, products: {nodes: [{id: '1'}]}},
});

const header = {
  shop: {primaryDomain: {url: 'https://shop.example.com'}},
  chainsGroup1: {items: [item('tennis-chains'), item('rope-chains')]},
  diamondMenu: {items: [item('tennis-chains')]},
} as any;

const args = {handle: 'tennis-chains', header, publicStoreDomain: 'shop.example.com'};

assert.equal(getDepartmentForCollectionHandle(args)?.id, 'diamond');
assert.equal(
  getDepartmentForCollectionHandle({...args, preferDepartmentId: 'chains'})?.id,
  'chains',
);
// A department that doesn't list it can't claim it.
assert.equal(
  getDepartmentForCollectionHandle({...args, preferDepartmentId: 'pendants'})?.id,
  'diamond',
);

console.log('megaMenu: all assertions passed');
