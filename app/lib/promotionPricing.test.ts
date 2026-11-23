import assert from 'node:assert/strict';
import {promotionPricing} from './promotionPricing.ts';

const product = (title: string, amount: string, compareAt?: string) => ({
  title,
  selectedOrFirstAvailableVariant: {
    price: {amount, currencyCode: 'USD' as const},
    compareAtPrice: compareAt ? {amount: compareAt, currencyCode: 'USD' as const} : null,
  },
});
assert.equal(
  promotionPricing(product('14K Rope Chain', '200'))?.price.amount,
  '170.00',
);
assert.equal(
  promotionPricing(product('14K Rope Chain', '500'))?.price.amount,
  '425.00',
);
assert.equal(
  promotionPricing(product('Diamond Stud Earrings', '500'))?.price.amount,
  '450.00',
);
assert.equal(
  promotionPricing(product('Diamond Stud Earrings', '400'))?.price.amount,
  '400',
);
assert.equal(
  promotionPricing(product('Diamond Stud Earrings', '399'))?.promotional,
  false,
);
assert.equal(
  promotionPricing(product('Engagement Ring', '1551', '2490'))?.price.amount,
  '1551',
);
assert.equal(
  promotionPricing(product('Engagement Ring', '1551', '2490'))?.compareAtPrice
    ?.amount,
  '2490',
);
assert.equal(
  promotionPricing(product('Rope Chain', '200', '250'))?.price.amount,
  '200',
);
assert.equal(
  promotionPricing(product('Rope Chain Bracelet', '500'))?.price.amount,
  '450.00',
);
assert.equal(
  promotionPricing(product('Pendant with Chain', '500'))?.price.amount,
  '450.00',
);
assert.equal(
  promotionPricing(product('Ring', '400.01'))?.price.amount,
  '360.01',
);
const source = product('Rope Chain', '999.99');
assert.equal(promotionPricing(source)?.price.amount, '849.99');
assert.equal(source.selectedOrFirstAvailableVariant.price.amount, '999.99');
assert.equal(
  promotionPricing(source, {price: {amount: '200', currencyCode: 'USD'}})?.price
    .amount,
  '170.00',
);
assert.equal(promotionPricing(product('Chain', '0'))?.promotional, false);
console.log(
  'Promotion pricing: chain priority, threshold, variant updates, backend markdown preservation, and rounding passed.',
);
