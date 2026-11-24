/**
 * Self-check for the PDP spec helpers.
 * No test runner in this project, so: `node app/lib/productSpecs.test.ts`
 *
 * The merchant "Size & Weight" copy holds dimensions and diamond specs that
 * the page shows nowhere else; only a plain gold-weight line may ever go, and
 * only while the structured Weight row is rendering it.
 */
import assert from 'node:assert/strict';
import {
  merchantProductSpecRows,
  stripDuplicatedSpecLines,
  variantWeightLabel,
} from './productSpecs.ts';

// Verbatim from 2-39-ct-cushion-diamond-engagement-ring-in-14k-solid-gold-edr1-2
const DIAMOND =
  '<h5>Details</h5><p>Intro.</p><h3>Size &amp; Weight</h3>\n<p><strong>Approx Center Stone Weight: </strong>2.00ct</p>\n<p><strong>Approx Weight of Side Stones : </strong>0.39ct</p>\n<p><strong>Approx Total Diamond Weight: </strong>2.39ct</p>\n<p><strong>Side Diamonds:</strong> 22 total</p>\n<p><strong>Total Diamond Count: </strong>23</p>';
// Verbatim from 10k-yellow-gold-last-supper-pendant-un-1201 (variant weight 0)
const DIMENSIONS =
  '<h3>Size &amp; Weight</h3>\n<strong>Length: </strong> Approx  1.14"<br>\n<strong>Width: </strong> Approx  1.16"\n';

// 1. Diamond and dimension copy survives untouched, weight shown or not.
for (const weightShown of [true, false]) {
  assert.equal(stripDuplicatedSpecLines(DIAMOND, {weightShown}), DIAMOND);
  assert.equal(stripDuplicatedSpecLines(DIMENSIONS, {weightShown}), DIMENSIONS);
}

// 2. A plain gold-weight line goes only when the structured row shows it.
const WITH_GOLD =
  '<h3>Size &amp; Weight</h3><p><strong>Length:</strong> 18 inches</p><p><strong>Approx Gold Weight:</strong> 4.2g</p><p><strong>Total Diamond Weight:</strong> 0.5ct</p>';
assert.equal(
  stripDuplicatedSpecLines(WITH_GOLD, {weightShown: true}),
  '<h3>Size &amp; Weight</h3><p><strong>Length:</strong> 18 inches</p><p><strong>Total Diamond Weight:</strong> 0.5ct</p>',
);
assert.equal(stripDuplicatedSpecLines(WITH_GOLD, {weightShown: false}), WITH_GOLD);

// 3. <br>-separated "Weight:" line.
assert.equal(
  stripDuplicatedSpecLines(
    '<h3>Size &amp; Weight</h3><strong>Weight:</strong> 3g<br><strong>Width:</strong> 2mm',
    {weightShown: true},
  ),
  '<h3>Size &amp; Weight</h3><strong>Width:</strong> 2mm',
);

// 4. Section left empty → heading goes too; rest of description intact.
assert.equal(
  stripDuplicatedSpecLines(
    '<p>Intro</p><h3>Size &amp; Weight</h3><p>Weight: 3g</p><h5>Care</h5><p>x</p>',
    {weightShown: true},
  ),
  '<p>Intro</p><h5>Care</h5><p>x</p>',
);

// 5. Weight lines OUTSIDE the section are never touched.
const OUTSIDE = '<h5>Details</h5><p>Weight: 3g</p>';
assert.equal(stripDuplicatedSpecLines(OUTSIDE, {weightShown: true}), OUTSIDE);

// 6. Heading with an empty body (434 live products) never renders bare.
for (const weightShown of [true, false]) {
  assert.equal(
    stripDuplicatedSpecLines('<p>Intro</p><h3>Size &amp; Weight</h3> \n', {weightShown}),
    '<p>Intro</p>',
  );
}

// 7. Empty input.
assert.equal(stripDuplicatedSpecLines(null, {weightShown: true}), '');

// 8. Zero / missing weight is never a valid gold weight.
assert.equal(variantWeightLabel(0, 'POUNDS'), null);
assert.equal(variantWeightLabel(null, 'GRAMS'), null);
assert.equal(variantWeightLabel(undefined, undefined), null);
assert.equal(variantWeightLabel(-1, 'GRAMS'), null);
assert.equal(variantWeightLabel(Number.NaN, 'GRAMS'), null);
assert.equal(variantWeightLabel(1.75, 'GRAMS'), 'Approx. 1.75g');
assert.equal(variantWeightLabel(0.2, 'OUNCES'), 'Approx. 0.2oz');

// Merchant specs are explicit only. Variant values override product defaults,
// whitespace-only values disappear, and no field is generated from context.
assert.deepEqual(
  merchantProductSpecRows(
    {
      stoneOriginType: {value: 'Lab-grown diamond'},
      centerStoneWeight: {value: '2.00 ct'},
      totalStoneWeight: {value: '2.49 ct'},
      certificateReport: {value: 'IGI report included'},
      soldAs: {value: '   '},
    },
    {centerStoneWeight: {value: '2.10 ct'}},
  ),
  [
    {label: 'Stone', value: 'Lab-grown diamond'},
    {label: 'Center weight', value: '2.10 ct'},
    {label: 'Total weight', value: '2.49 ct'},
    {label: 'Certificate / report', value: 'IGI report included'},
  ],
);
assert.deepEqual(merchantProductSpecRows({}, null), []);

console.log('productSpecs: all checks passed');
