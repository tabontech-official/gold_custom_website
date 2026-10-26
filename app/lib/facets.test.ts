/**
 * Self-check for the derived collection filters.
 * No test runner in this project, so: `node app/lib/facets.test.ts`
 * Every product shape here is a real one from the catalogue.
 */
import assert from 'node:assert/strict';
import {
  caratBandOf,
  facetGroups,
  indexProduct,
  karatsOf,
  matchesFacets,
  parseFacetFilter,
  type FacetSource,
} from './facets.ts';

const product = (
  title: string,
  options: [string, string[]][] = [],
  collections: string[] = [],
): FacetSource => ({
  id: title,
  handle: title,
  title,
  options: options.map(([name, values]) => ({
    name,
    optionValues: values.map((value) => ({name: value})),
  })),
  collections: {nodes: collections.map((handle) => ({handle}))},
});

// ── Karat ───────────────────────────────────────────────────────────────────
// The options are what can be bought: both karats, not just the title's.
assert.deepEqual(
  karatsOf(
    product('10K Bamboo Heart Ring', [
      ['metal', ['10K Yellow Gold', '14K Yellow Gold', '14K White Gold']],
    ]),
  ),
  ['10K', '14K'],
);
// `gold purity`, lower case — invisible to Shopify's Metal filter.
assert.deepEqual(
  karatsOf(product('Rope Chain', [['gold purity', ['10k', '14k']]])),
  ['10K', '14K'],
);
// The catalogue's " metal" option name with a leading space.
assert.deepEqual(
  karatsOf(product('Curb Chain', [[' metal', ['14K Yellow Gold']]])),
  ['14K'],
);
// Single-variant product: only the title knows.
assert.deepEqual(
  karatsOf(product('14K Oval Engagement Ring', [['Title', ['Default Title']]])),
  ['14K'],
);
// Options without a karat fall back to the title.
assert.deepEqual(
  karatsOf(product('10K Cuban Link', [['metal', ['Yellow Gold']]])),
  ['10K'],
);
// "10 10.79CT" is not 10K, and "Size 10 Kids" is not either.
assert.deepEqual(karatsOf(product('10 10.79CT Picture Pendant')), []);
assert.deepEqual(karatsOf(product('Size 10 Kids Ring')), []);

// ── Carat ───────────────────────────────────────────────────────────────────
const band = (title: string) => caratBandOf(product(title));
assert.equal(band('10K 0.24CT Diamond earrings - UN-0148'), 'Under 0.50 ct');
assert.equal(band('10K 0.57Ct Diamond earrings'), '0.50–0.99 ct');
assert.equal(band('10K 0.245ct Diamond earrings'), 'Under 0.50 ct');
assert.equal(band('2.39 CT Cushion Diamond Engagement Ring'), '2.00–2.99 ct');
assert.equal(band('10K 3CT Pavé Diamond Signet Ring'), '3.00 ct & up');
assert.equal(band("10K .040CT Diamond Initial 'F' Pendant"), 'Under 0.50 ct');
assert.equal(
  band('10 10.79CT Double Diamond Halo Picture Pendant'),
  '3.00 ct & up',
);
assert.equal(
  band('14K 1.2CT Oval Diamond Halo Engagement Ring'),
  '1.00–1.99 ct',
);
// Boundaries land in the upper band.
assert.equal(band('0.50CT Studs'), '0.50–0.99 ct');
assert.equal(band('1.00CT Studs'), '1.00–1.99 ct');
// "074Ct" is a typo, not 74 carats.
assert.equal(band('10K 074Ct Diamond earrings'), null);
assert.equal(band('10K Rope Chain 22 Inch'), null);

// ── Style ───────────────────────────────────────────────────────────────────
// From style collections only, once each; departments and gender collections
// are not styles.
assert.deepEqual(
  indexProduct(
    product(
      'Cuban',
      [],
      ['chains', 'cuban-chains', 'miami-cuban-links', 'mens'],
    ),
  ).style,
  ['Cuban'],
);

// ── URL param ───────────────────────────────────────────────────────────────
assert.deepEqual(parseFacetFilter({karat: '14K'}), {
  key: 'karat',
  value: '14K',
});
assert.equal(parseFacetFilter({variantOption: {name: 'metal'}}), null);
assert.equal(parseFacetFilter({available: true}), null);
assert.equal(parseFacetFilter('14K'), null);

// ── Matching and counts ─────────────────────────────────────────────────────
const index = [
  indexProduct(
    product(
      '10K 0.24CT Cuban',
      [['metal', ['10K Yellow Gold']]],
      ['cuban-chains'],
    ),
  ),
  indexProduct(
    product('14K Rope', [['metal', ['14K Yellow Gold']]], ['rope-chains']),
  ),
  indexProduct(
    product(
      'Both Rope',
      [['metal', ['10K Yellow Gold', '14K White Gold']]],
      ['rope-chains'],
    ),
  ),
];
const k14 = {key: 'karat', value: '14K'} as const;
const k10 = {key: 'karat', value: '10K'} as const;
const rope = {key: 'style', value: 'Rope'} as const;
// OR within a facet, AND across.
assert.equal(index.filter((p) => matchesFacets(p, [k14])).length, 2);
assert.equal(index.filter((p) => matchesFacets(p, [k14, k10])).length, 3);
assert.equal(index.filter((p) => matchesFacets(p, [k10, rope])).length, 1);

const groups = facetGroups(index, [k14]);
const karat = groups.find((g) => g.id === 'facet.karat')!;
// Ticking 14K does not zero 10K: a facet never counts against itself.
assert.deepEqual(
  karat.values.map((v) => [v.label, v.count]),
  [
    ['10K', 2],
    ['14K', 2],
  ],
);
// Other facets do narrow by it: under 14K, only rope pieces remain.
assert.deepEqual(
  groups
    .find((g) => g.id === 'facet.style')!
    .values.map((v) => [v.label, v.count]),
  [['Rope', 2]],
);
// No carat in any 14K piece → no Carat group at all, not an empty one.
assert.equal(
  groups.find((g) => g.id === 'facet.carat'),
  undefined,
);
// The input is exactly what parseFacetFilter reads back.
assert.deepEqual(parseFacetFilter(JSON.parse(karat.values[1].input)), k14);
// Carat bands list in weight order, not alphabetical ("Under" sorts last).
const carats = facetGroups(
  [
    indexProduct(product('3CT')),
    indexProduct(product('0.2CT')),
    indexProduct(product('1.5CT')),
  ],
  [],
).find((g) => g.id === 'facet.carat')!;
assert.deepEqual(
  carats.values.map((v) => v.label),
  ['Under 0.50 ct', '1.00–1.99 ct', '3.00 ct & up'],
);

console.log('facets.test.ts: ok');
