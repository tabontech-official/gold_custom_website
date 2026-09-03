/**
 * Self-check for the custom-design option sheets.
 * No test runner in this project, so: `npx tsx app/lib/customDesignOptions.test.ts`
 */
import assert from 'node:assert/strict';
import {
  CATEGORY_SPECS,
  PRODUCT_TYPES,
  readSpecSelections,
  specSummary,
} from './customDesignOptions.ts';

// Every pickable product type has an option sheet, and every sheet belongs to
// a pickable type — a rename on either side would silently orphan the other.
for (const type of PRODUCT_TYPES) {
  assert.ok(CATEGORY_SPECS[type]?.length, `no spec for "${type}"`);
}
for (const type of Object.keys(CATEGORY_SPECS)) {
  assert.ok(PRODUCT_TYPES.includes(type), `spec for unknown type "${type}"`);
}

// No sheet uses the same form field twice.
for (const [type, fields] of Object.entries(CATEGORY_SPECS)) {
  const keys = fields.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length, `duplicate key in "${type}"`);
}

// Valid selections come back labeled; the summary reads as one line.
const ring = (values: Record<string, string>) =>
  readSpecSelections('Rings', (name) => values[name] ?? '');

const good = ring({
  spec_metal: 'Yellow Gold',
  spec_karat: '14K',
  spec_stones: 'Real Diamonds',
  spec_size: '7',
  spec_style: 'Pavé',
  spec_budget: '$1,000 – $2,500',
});
assert.deepEqual(good.errors, {});
assert.equal(
  specSummary(good.selections),
  'Metal color: Yellow Gold · Gold karat: 14K · Stones: Real Diamonds · Ring size (US): 7 · Ring style: Pavé · Budget range: $1,000 – $2,500',
);

// A value outside the sheet (tampered form) and a missing one both error.
const bad = ring({spec_metal: 'Platinum', spec_karat: '14K'});
assert.equal(bad.errors.spec_metal, 'Please choose one of the listed options.');
assert.match(bad.errors.spec_stones, /choose/i);

// An unknown category has no sheet, so nothing is required and nothing passes.
const none = readSpecSelections('Nonsense', () => 'x');
assert.deepEqual(none, {selections: [], errors: {}});

console.log('customDesignOptions.test.ts: all assertions passed');
