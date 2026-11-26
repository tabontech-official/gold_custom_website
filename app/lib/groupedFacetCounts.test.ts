/**
 * Self-check for card-counted Shopify facets.
 * No test runner in this project, so: `node app/lib/groupedFacetCounts.test.ts`
 */
import assert from 'node:assert/strict';
import {
  cardCounts,
  countKey,
  filterGroupKey,
  matchesInput,
} from './groupedFacetCounts.ts';
import {facetGroups} from './facets.ts';
import {groupProducts} from './productGroups.ts';

const metal = (value: string) =>
  JSON.stringify({variantOption: {name: 'metal', value}});

function product(
  id: string,
  group: string | null,
  metals: string[],
  karat: string[] = [],
) {
  return {
    id,
    groupName: group === null ? null : {value: group},
    options: {metal: metals},
    metal: [...new Set(metals.map((value) => value.replace(/^\d+K\s+/i, '')))],
    karat,
    carat: [],
    length: [],
    width: [],
    style: [],
  };
}

// Group keys: every Metal value is one group; other kinds by their own key.
assert.equal(filterGroupKey(metal('10K Yellow Gold')), 'option:metal');
assert.equal(
  filterGroupKey({variantOption: {name: 'Metal', value: 'x'}}),
  'option:metal',
);
assert.equal(filterGroupKey({available: true}), 'available');
assert.equal(filterGroupKey({price: {min: 1}}), 'price');
assert.equal(
  filterGroupKey({productMetafield: {namespace: 'c', key: 'k', value: 'v'}}),
  'productMetafield:c.k',
);
assert.equal(filterGroupKey('not json'), null);

// Matching ignores case, as Shopify's filter does.
const p = product('a', null, ['10k yellow gold']);
assert.equal(matchesInput(p, metal('10K Yellow Gold')), true);
assert.equal(matchesInput(p, metal('14K Yellow Gold')), false);
assert.equal(matchesInput(p, {available: true}), null);
// …but not stray spaces: Shopify's Metal facet leaves out a " Metal" option
// (two live engagement rings), so this must too.
const spaced = {options: {' metal': ['14K White Gold']}};
assert.equal(matchesInput(spaced, metal('14K White Gold')), false);

// 19 products in 12 groups (the verified Nugget Earrings 10K Yellow Gold
// shape): 7 groups of two, 5 ungrouped → 12 cards.
const nugget = [
  ...Array.from({length: 14}, (_, i) =>
    product(`g${i}`, `NUG-${Math.floor(i / 2)}`, ['10K Yellow Gold']),
  ),
  ...Array.from({length: 5}, (_, i) =>
    product(`u${i}`, null, ['10K Yellow Gold']),
  ),
  product('w', 'NUG-W', ['10K White Gold']),
];
const facets = [
  {
    id: 'filter.v.option.metal',
    label: 'Metal',
    type: 'LIST',
    values: [
      {label: '10K Yellow Gold', input: metal('10K Yellow Gold')},
      {label: '10K White Gold', input: metal('10K White Gold')},
    ],
  },
  {
    id: 'filter.v.availability',
    label: 'Availability',
    type: 'LIST',
    values: [{label: 'In stock', input: JSON.stringify({available: true})}],
  },
];
const counts = cardCounts({
  facets,
  indexFor: () => nugget,
  group: (list) => groupProducts(list),
});
assert.equal(counts[countKey('filter.v.option.metal', '10K Yellow Gold')], 12);
assert.equal(counts[countKey('filter.v.option.metal', '10K White Gold')], 1);
// Availability is hidden in the sidebar and never counted.
assert.equal(countKey('filter.v.availability', 'In stock') in counts, false);
// Ungrouped (engagement rings): products, one each.
const flat = cardCounts({facets, indexFor: () => nugget, group: (l) => l});
assert.equal(flat[countKey('filter.v.option.metal', '10K Yellow Gold')], 19);
// A group whose index is unavailable gets no counts at all.
assert.deepEqual(
  cardCounts({facets, indexFor: () => null, group: (l) => l}),
  {},
);
// Karat/Carat/Style filters narrow the pool.
const narrowed = cardCounts({
  facets,
  indexFor: () => nugget,
  also: (item) => item.id.startsWith('u'),
  group: (l) => groupProducts(l),
});
assert.equal(narrowed[countKey('filter.v.option.metal', '10K Yellow Gold')], 5);
// Values sharing a label count a card once.
const dup = cardCounts({
  facets: [
    {
      id: 'f',
      label: 'Metal',
      type: 'LIST',
      values: [
        {label: '10K Yellow Gold', input: metal('10K Yellow Gold')},
        {label: '10k yellow gold', input: metal('10k yellow gold')},
      ],
    },
  ],
  indexFor: () => nugget,
  group: (l) => groupProducts(l),
});
assert.equal(dup[countKey('f', '10K Yellow Gold')], 12);

// Karat facet counts are card counts when given the grid's grouping.
const karatGroups = facetGroups(
  [
    product('k1', 'G', [], ['10K']),
    product('k2', 'G', [], ['10K']),
    product('k3', null, [], ['10K']),
  ],
  [],
  (list) => groupProducts(list),
);
assert.equal(karatGroups[0].values[0].count, 2);
// Without it, products as before.
assert.equal(
  facetGroups(
    [product('k1', 'G', [], ['10K']), product('k2', 'G', [], ['10K'])],
    [],
  )[0].values[0].count,
  2,
);

console.log('groupedFacetCounts: ok');
