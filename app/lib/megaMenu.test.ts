/**
 * Self-check for the parent-handle lookup that drives FAQ/cover inheritance on
 * child category pages. No test runner in this project, so: `npx tsx app/lib/megaMenu.test.ts`
 * ponytail: plain asserts; move to a runner if this file grows past a handful of cases.
 */
import assert from 'node:assert/strict';
import {
  collectionHandlesFromMenu,
  getMegaMenuParentHandle,
  MIAMI_CUBAN_HANDLE,
} from './megaMenu.ts';

// Curated children resolve to their department.
assert.equal(getMegaMenuParentHandle('men-rings'), 'rings');
assert.equal(getMegaMenuParentHandle('womens-diamond-ring'), 'rings');
assert.equal(getMegaMenuParentHandle(MIAMI_CUBAN_HANDLE), 'chains');

assert.equal(getMegaMenuParentHandle('Men-Rings'), 'rings', 'case-insensitive');

// Menu-sourced children: the majority of departments, and the case that was
// silently returning undefined before menuItemHandles was threaded through.
assert.equal(
  getMegaMenuParentHandle('tennis-bracelet'),
  undefined,
  'no parent without the menus',
);
assert.equal(
  getMegaMenuParentHandle('tennis-bracelet', {braceletsMenu: ['tennis-bracelet']}),
  'bracelets',
);
assert.equal(
  getMegaMenuParentHandle('rope-chain', {chainsGroup2: ['rope-chain']}),
  'chains',
);
assert.equal(
  getMegaMenuParentHandle('studs', {earringsMenu: ['studs'], diamondMenu: []}),
  'earrings',
);

// URL -> handle extraction, absolute and relative.
assert.deepEqual(
  collectionHandlesFromMenu({
    items: [
      {url: 'https://example.myshopify.com/collections/rope-chain'},
      {url: '/collections/box-chain?sort=price'},
      {url: 'https://example.com/pages/about'},
      {url: null},
    ],
  }),
  ['rope-chain', 'box-chain'],
);
assert.deepEqual(collectionHandlesFromMenu(null), []);

// A department must not inherit from itself, or it would re-query its own content.
assert.equal(getMegaMenuParentHandle('rings'), undefined);
assert.equal(getMegaMenuParentHandle('chains'), undefined);

assert.equal(getMegaMenuParentHandle('not-a-collection'), undefined);

console.log('megaMenu: all assertions passed');
