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
  const keys = fields.map((f) => `${f.key}|${[f.when?.value ?? ''].flat().join()}`);
  assert.equal(new Set(keys).size, keys.length, `duplicate key in "${type}"`);
  for (const field of fields) {
    if (field.when) {
      // Some earlier field with that key must offer each trigger value —
      // "earlier" so the flow can never depend on an answer not yet asked.
      for (const value of [field.when.value].flat()) {
        assert.ok(
          fields.some(
            (f) =>
              f.key === field.when!.key &&
              fields.indexOf(f) < fields.indexOf(field) &&
              f.options.some((o) => o.value === value),
          ),
          `bad when-value "${value}" in "${type}" ${field.key}`,
        );
      }
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
  spec_style: 'Round',
  spec_design: 'Solitaire Band',
  spec_stones: 'Sapphire',
  spec_carat: '1.00 ct',
  spec_metal: 'Yellow Gold',
  spec_karat: '14K',
  spec_size: '7',
  spec_engraving: 'No Engraving',
  spec_budget: '$1,000 – $1,500',
});
assert.deepEqual(good.errors, {});
assert.equal(
  specSummary(good.selections),
  'Type: Engagement · Style: Round · Band: Solitaire Band · Stone: Sapphire · Carat: 1.00 ct · Metal: Yellow Gold · Karat: 14K · Size: 7 · Engraving: No Engraving · Budget: $1,000 – $1,500',
);

// A diamond center raises the natural-vs-lab question; a sapphire does not.
assert.match(
  ring({spec_kind: 'Engagement', spec_stones: 'Diamond'}).errors.spec_stonetype,
  /choose/i,
);
assert.ok(!('spec_stonetype' in good.errors));

// Engagement requires a center stone; only the Casual list offers "No stones".
assert.ok(ring({spec_kind: 'Engagement', spec_stones: 'No stones'}).errors.spec_stones);
assert.ok(!ring({spec_kind: 'Casual', spec_stones: 'No stones'}).errors.spec_stones);

// Branching: the same style value is only valid under its own branch —
// "Wedding Band" is a Casual style, so it fails the Engagement sheet.
assert.ok(ring({spec_kind: 'Engagement', spec_style: 'Wedding Band'}).errors.spec_style);
assert.ok(!ring({spec_kind: 'Casual', spec_style: 'Wedding Band'}).errors.spec_style);

// A value outside the sheet (tampered form) and a missing one both error.
const bad = ring({spec_metal: 'Platinum', spec_karat: '14K'});
assert.equal(bad.errors.spec_metal, 'Please choose one of the listed options.');
assert.match(bad.errors.spec_size, /choose/i);

// Pendant styles branch into their own follow-ups: a Cross asks for a cross
// design; a Nameplate never sees that field but asks for a font instead.
const pendant = (values: Record<string, string>) =>
  readSpecSelections('Pendant', (name) => values[name] ?? '');
assert.match(pendant({spec_style: 'Cross'}).errors.spec_design, /choose/i);
assert.ok(!('spec_font' in pendant({spec_style: 'Cross'}).errors));
assert.match(pendant({spec_style: 'Nameplate'}).errors.spec_font, /choose/i);
assert.ok(!pendant({spec_style: 'Cross', spec_design: 'Gothic Cross'}).errors.spec_design);

// Chains: stone type/coverage only appear once a diamond setting is chosen —
// and any of the three stone-bearing settings unlocks them.
const chain = (values: Record<string, string>) =>
  readSpecSelections('Chain', (name) => values[name] ?? '');
assert.ok(!('spec_stonetype' in chain({spec_stones: 'No Diamonds'}).errors));
assert.match(chain({spec_stones: 'Partial Pavé'}).errors.spec_stonetype, /choose/i);
assert.ok(!chain({spec_stones: 'Full Pavé / Iced', spec_stonetype: 'Diamond'}).errors.spec_stonetype);

// An unknown category has no sheet, so nothing is required and nothing passes.
const none = readSpecSelections('Nonsense', () => 'x');
assert.deepEqual(none, {selections: [], errors: {}});

console.log('customDesignOptions.test.ts: all assertions passed');
