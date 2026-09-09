/**
 * Self-check for per-metal gallery groups.
 * Run: `npx vite-node app/lib/variantMedia.test.ts`
 * ponytail: plain asserts, no runner.
 */
import assert from 'node:assert/strict';
import {mediaForSelectedOptions, mediaOptionTag} from './variantMedia.ts';

const options = [
  {name: 'Metal', optionValues: [{name: '14K Yellow Gold'}, {name: '14K White Gold'}]},
  {name: 'Size', optionValues: [{name: '6'}, {name: '7'}]},
];
const media = [
  {alt: 't4option0_0', id: 'yellow-photo'},
  {alt: 'Yellow video t4option0_0', id: 'yellow-video'},
  {alt: 't4option0_1', id: 'white-photo'},
  {alt: 'White video t4option0_1', id: 'white-video'},
  {alt: 'Certificate', id: 'untagged'},
];

assert.deepEqual(mediaOptionTag('t4option0_1'), {optionIndex: 0, valueIndex: 1});
assert.equal(mediaOptionTag('plain alt'), null);

const white = mediaForSelectedOptions(media, options, [
  {name: 'Metal', value: '14K White Gold'},
  {name: 'Size', value: '7'},
]);
// Both white items plus the untagged one; the yellow group is gone — video
// included, which is the whole point.
assert.deepEqual(white.map((m) => m.id), ['white-photo', 'white-video', 'untagged']);

const yellow = mediaForSelectedOptions(media, options, [
  {name: 'Metal', value: '14K Yellow Gold'},
]);
assert.deepEqual(yellow.map((m) => m.id), ['yellow-photo', 'yellow-video', 'untagged']);

// Nothing tagged for the selection (option renamed, tag typo) -> full gallery,
// never a blank one.
assert.equal(
  mediaForSelectedOptions(media, options, [{name: 'Metal', value: 'Rose Gold'}]).length,
  media.length,
);
assert.equal(mediaForSelectedOptions([], options, []).length, 0);

console.log('variantMedia: all assertions passed');
