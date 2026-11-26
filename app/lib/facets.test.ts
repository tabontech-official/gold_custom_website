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
  lengthBandOf,
  matchesFacets,
  metalsOf,
  parseFacetFilter,
  widthBandOf,
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
// Shopify combines color and purity in one option. The storefront presents
// them as independent Metal and Karat controls.
assert.deepEqual(
  metalsOf(
    product('Gold Ring', [
      ['metal', ['10K Yellow Gold', '14K Yellow Gold', '14K White Gold']],
    ]),
  ),
  ['White Gold', 'Yellow Gold'],
);
assert.deepEqual(
  metalsOf(product('14K Rose Gold Ring', [['Title', ['Default Title']]])),
  ['Rose Gold'],
);
assert.deepEqual(
  metalsOf(product('10K Diamond Stud Earrings', [['Title', ['Default Title']]])),
  ['Gold'],
);
assert.deepEqual(
  metalsOf(product('10K Tri-Color Gold Virgin Mary Stud Earrings')),
  ['Tri-Color Gold'],
);
assert.deepEqual(metalsOf(product('10K Solid Gold Rope Chain')), ['Solid Gold']);
assert.deepEqual(metalsOf(product('10K Semi-Solid Rope Chain')), [
  'Semi-Solid Gold',
]);
assert.deepEqual(metalsOf(product('10K Hollow Gold Figaro Chain')), [
  'Hollow Gold',
]);

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
assert.deepEqual(parseFacetFilter({metal: 'White Gold'}), {
  key: 'metal',
  value: 'White Gold',
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
const white = {key: 'metal', value: 'White Gold'} as const;
const rope = {key: 'style', value: 'Rope'} as const;
// OR within a facet, AND across.
assert.equal(index.filter((p) => matchesFacets(p, [k14])).length, 2);
assert.equal(index.filter((p) => matchesFacets(p, [k14, k10])).length, 3);
assert.equal(index.filter((p) => matchesFacets(p, [k10, rope])).length, 1);
assert.equal(index.filter((p) => matchesFacets(p, [white, k14])).length, 1);

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

// ── Length / Width ──────────────────────────────────────────────────────────
// Every way the catalogue writes them, from real titles: [title, length, width].
const SIZES: [string, string | null, string | null][] = [
  ['10K Yellow Gold 5mm Square Miami Cuban Chain 22 Inch', '21–24 in', '5–6.9 mm'],
  ['10K 1.8mm 24-Inch Miami Cuban Chain', '21–24 in', 'Under 3 mm'],
  ['10K Ice Gold Chain 4.4MM 22 Inches', '21–24 in', '3–4.9 mm'],
  ['10K Gold 3.4mm Diamond Curb Chain - 24 Inch - Semi-Solid', '21–24 in', '3–4.9 mm'],
  ['10K Yellow Gold 5mm Classic Link Chain 20 Inchhain', '17–20 in', '5–6.9 mm'],
  ['10K Semi-Solid 4.4MM 40 Inch Franco Chain', '29 in & up', '3–4.9 mm'],
  ['10K 1.5MM Solid Diamond Cut 14-Inch Rope Chain', '10–16 in', 'Under 3 mm'],
  ['10K/14K 7MM Solid Gold 9.5-Inch Miami Cuban Bracelet', '9–9.5 in', '7–9.9 mm'],
  ['10K Solid Gold 2.5mm Miami Cuban Bracelet - 7.5 Inch', 'Under 8 in', 'Under 3 mm'],
  ['10K 36MM 8-Inch Classic Link Bracelet | Gold Bracelet', '8–8.5 in', '15 mm & up'],
  ['10K Monaco Nameplate Bracelet 13.5MM - 9 Inch', '9–9.5 in', '10–14.9 mm'],
  // Length without width: "18in", after a carat weight.
  ['10K Yellow Gold Diamond Cuban Link Chain 6.15CT | 18in', '17–20 in', null],
  // Neither stated: no guess, the piece drops out under these two filters.
  ['14K 2.76CT Diamond Tennis Bracelet - Yellow Gold', null, null],
  // "in" as a word is not inches; a pendant's mm is not a link width.
  ['10K Round Diamond Tennis Necklace in White Gold', null, null],
  ['10K/14K 32.51MM Solid Gold Star CZ Accent Pendant', null, null],
];
for (const [title, length, width] of SIZES) {
  assert.deepEqual(
    [lengthBandOf(product(title)), widthBandOf(product(title))],
    [length, width],
    title,
  );
}
// Bands list shortest first, and a band filter narrows like any other facet.
const sized = [
  '10K 3.2mm 22-Inch Flat Mariner Chain',
  '10K 6MM 8-Inch Franco Bracelet | Gold Bracelet',
  '10K Chino Link 7mm 18-Inch Chain',
].map((title) => indexProduct(product(title)));
const sizeGroups = facetGroups(sized, []);
assert.deepEqual(
  sizeGroups.find((g) => g.id === 'facet.length')!.values.map((v) => v.label),
  ['8–8.5 in', '17–20 in', '21–24 in'],
);
assert.deepEqual(
  sizeGroups.find((g) => g.id === 'facet.width')!.values.map((v) => v.label),
  ['3–4.9 mm', '5–6.9 mm', '7–9.9 mm'],
);
assert.deepEqual(
  sized
    .filter((p) => matchesFacets(p, [{key: 'length', value: '17–20 in'}]))
    .map((p) => p.id),
  ['10K Chino Link 7mm 18-Inch Chain'],
);

console.log('facets.test.ts: ok');
