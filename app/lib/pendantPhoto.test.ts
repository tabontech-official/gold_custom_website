/**
 * Self-check for which products ask the shopper for a photo.
 * Run: `npx vite-node app/lib/pendantPhoto.test.ts`
 * ponytail: plain asserts, no runner.
 *
 * Regression guard: the diamond Hamsa pendants are tagged "Diamond Picture
 * Pendants" (a category) and were being asked for an upload.
 */
import assert from 'node:assert/strict';
import {isPicturePendantProduct} from './pendantPhoto.ts';

assert.equal(isPicturePendantProduct({tags: ['Picture Pendants']}), true);
assert.equal(isPicturePendantProduct({tags: ['picture pendant']}), true);
assert.equal(isPicturePendantProduct({productType: 'Picture Pendants'}), true);
assert.equal(
  isPicturePendantProduct({
    tags: ['Diamond Picture Pendants', 'Hamsa'],
    productType: 'Pendants',
  }),
  false,
);
assert.equal(isPicturePendantProduct({tags: ['Diamond Pendants']}), false);
assert.equal(isPicturePendantProduct({}), false);

console.log('pendantPhoto: all assertions passed');
