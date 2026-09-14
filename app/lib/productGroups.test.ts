/**
 * Self-check for product grouping.
 * No test runner in this project, so: `node app/lib/productGroups.test.ts`
 */
import assert from 'node:assert/strict';
import {groupProducts} from './productGroups.ts';

const p = (id: string, value?: string | null) => ({
  id,
  groupName: value === undefined ? null : {value},
});

const ids = (list: Array<{id: string}>) => list.map((product) => product.id);

// 1. Five of one group render once — the first.
assert.deepEqual(
  ids(groupProducts(['a', 'b', 'c', 'd', 'e'].map((id) => p(id, 'FB-03')))),
  ['a'],
);

// 2. Two groups, two cards.
assert.deepEqual(
  ids(
    groupProducts([
      p('a', 'FB-03'),
      p('b', 'FB-03'),
      p('c', 'FB-04'),
      p('d', 'FB-04'),
    ]),
  ),
  ['a', 'c'],
);

// 3. Blank / null / missing / whitespace group names never group together.
assert.deepEqual(
  ids(groupProducts([p('a'), p('b', null), p('c', ''), p('d', '   ')])),
  ['a', 'b', 'c', 'd'],
);

// 4. A group plus blanks: every blank stays.
assert.deepEqual(
  ids(groupProducts([p('a', 'FB-03'), p('b'), p('c', '')])),
  ['a', 'b', 'c'],
);

// 5. Case and spacing normalize; order of everything else is preserved.
assert.deepEqual(
  ids(
    groupProducts([
      p('a', 'FB-03'),
      p('x'),
      p('b', 'fb-03'),
      p('c', ' FB-03 '),
      p('y', 'FB-04'),
    ]),
  ),
  ['a', 'x', 'y'],
);

// 6. Load More: grouping the combined list never lets a later page repeat a
// group an earlier page already showed.
const page1 = [p('a', 'FB-03'), p('b')];
const page2 = [p('c', 'FB-03'), p('d')];
assert.deepEqual(ids(groupProducts([...page1, ...page2])), ['a', 'b', 'd']);

// 7. PDP: the current product's group is excluded from its recommendations,
// 10. while blank-group recommendations stay independent.
const current = p('current', 'FB-03');
assert.deepEqual(
  ids(
    groupProducts(
      [p('r1', 'fb-03'), p('r2'), p('r3'), p('r4', 'FB-04'), p('r5', 'FB-04')],
      [current],
    ),
  ),
  ['r2', 'r3', 'r4'],
);
// A current product with no group excludes nothing.
assert.deepEqual(ids(groupProducts([p('r1'), p('r2')], [p('current')])), [
  'r1',
  'r2',
]);

console.log('productGroups: ok');
