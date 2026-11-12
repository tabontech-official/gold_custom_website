// No test runner in this project, so: `node app/lib/discount.test.ts`
import assert from 'node:assert/strict';
import {formatUsd, savingsFor} from './discount.ts';

// The live Black Friday example: 48% off, saves $2,339.
assert.deepEqual(savingsFor('2541', '4880'), {percent: 48, amount: 2339});
// The bad data from the audit: $2,072 against $20,724,000 is not a discount.
assert.equal(savingsFor('2072', '20724000'), null);
// No markdown, compare-at below price, and missing values all show plain price.
assert.equal(savingsFor('100', '100'), null);
assert.equal(savingsFor('100', '90'), null);
assert.equal(savingsFor('100', null), null);
assert.equal(savingsFor(null, '500'), null);
assert.equal(savingsFor('0', '500'), null);
// Exactly the cap is allowed; one more percent is not.
assert.equal(savingsFor('40', '100')?.percent, 60);
assert.equal(savingsFor('39', '100'), null);
assert.equal(formatUsd(2339), '$2,339');
console.log('discount: ok');
