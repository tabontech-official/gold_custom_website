/**
 * Self-check for the custom-design step sheets.
 * No test runner in this project, so: `npx tsx app/lib/customDesignOptions.test.ts`
 */
import assert from 'node:assert/strict';
import {
  CATEGORY_SPECS,
  PRODUCT_TYPES,
  readSpecSelections,
  specSummary,
} from './customDesignOptions.ts';

// Every pickable piece has a step sheet, and every sheet belongs to a
// pickable piece — a rename on either side would silently orphan the other.
for (const type of PRODUCT_TYPES) {
  assert.ok(CATEGORY_SPECS[type]?.length, `no spec for "${type}"`);
}
for (const type of Object.keys(CATEGORY_SPECS)) {
  assert.ok(PRODUCT_TYPES.includes(type), `spec for unknown type "${type}"`);
}

// No sheet uses the same form field twice within one branch, every `when`
// points at an earlier field's real option, and no step repeats a value.
for (const [type, fields] of Object.entries(CATEGORY_SPECS)) {
  const keys = fields.map((f) => `${f.key}|${f.when?.value ?? ''}`);
  assert.equal(new Set(keys).size, keys.length, `duplicate key in "${type}"`);
  for (const field of fields) {
    if (field.when) {
      const parent = fields.find((f) => f.key === field.when!.key);
      assert.ok(
        parent &&
          fields.indexOf(parent) < fields.indexOf(field) &&
          parent.options.some((o) => o.value === field.when!.value),
        `bad when-reference in "${type}" ${field.key}`,
      );
    }
    const values = field.options.map((o) => o.value);
    assert.equal(
      new Set(values).size,
      values.length,
      `duplicate option in "${type}" ${field.key}`,
    );
  }
}

// Valid selections come back labeled; the summary reads as one line.
const ring = (values: Record<string, string>) =>
  readSpecSelections('Ring', (name) => values[name] ?? '');

const good = ring({
  spec_kind: 'Engagement',
  spec_style: 'Solitaire',
  spec_metal: 'Yellow Gold',
  spec_karat: '14K',
  spec_stones: 'Sapphire',
  spec_size: '7',
  spec_budget: '$1,000 – $1,500',
});
assert.deepEqual(good.errors, {});
assert.equal(
  specSummary(good.selections),
  'Type: Engagement · Style: Solitaire · Metal: Yellow Gold · Karat: 14K · Stone: Sapphire · Size: 7 · Budget: $1,000 – $1,500',
);

// Engagement gets gem center stones; the generic list belongs to Casual.
assert.ok(ring({spec_kind: 'Engagement', spec_stones: 'Cubic Zirconia'}).errors.spec_stones);
assert.ok(!ring({spec_kind: 'Casual', spec_stones: 'Cubic Zirconia'}).errors.spec_stones);

// Branching: the same style value is only valid under its own branch —
// "Wedding Band" is a Casual style, so it fails the Engagement sheet.
assert.ok(ring({spec_kind: 'Engagement', spec_style: 'Wedding Band'}).errors.spec_style);
assert.ok(!ring({spec_kind: 'Casual', spec_style: 'Wedding Band'}).errors.spec_style);

// A value outside the sheet (tampered form) and a missing one both error.
const bad = ring({spec_metal: 'Platinum', spec_karat: '14K'});
assert.equal(bad.errors.spec_metal, 'Please choose one of the listed options.');
assert.match(bad.errors.spec_size, /choose/i);

// An unknown category has no sheet, so nothing is required and nothing passes.
const none = readSpecSelections('Nonsense', () => 'x');
assert.deepEqual(none, {selections: [], errors: {}});

console.log('customDesignOptions.test.ts: all assertions passed');
