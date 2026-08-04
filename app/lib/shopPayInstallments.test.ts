// Run with: node --test app/lib/shopPayInstallments.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildShopPayMeta,
  variantIdNumber,
  stripSplitPayCopy,
  FALLBACK_PRICING,
} from './shopPayInstallments.ts';

const build = (amount: string) =>
  buildShopPayMeta({
    pricing: FALLBACK_PRICING,
    variantId: 48525937934584,
    price: {amount, currencyCode: 'USD'},
    available: true,
  });

test('meta matches what the Liquid storefront emits for the same variant', () => {
  // Byte-for-byte the `shopify-meta` goldcustom.com renders for this variant.
  const meta = build('440.00');
  assert.deepEqual(meta?.variants, [
    {
      id: 48525937934584,
      price_per_term: '$110.00',
      full_price: '$440.00',
      eligible: true,
      available: true,
      number_of_payment_terms: 4,
    },
  ]);
  assert.equal(meta?.min_price, '$35.00');
  assert.equal(meta?.max_price, '$30,000.00');
  assert.deepEqual(meta?.financing_plans[3], {
    min_price: '$1,000.00',
    max_price: '$30,000.00',
    terms: [
      {apr: 15, loan_type: 'interest', installments_count: 3},
      {apr: 15, loan_type: 'interest', installments_count: 6},
      {apr: 15, loan_type: 'interest', installments_count: 12},
    ],
  });
});

test('bands above split pay fall back to two terms, as Liquid does', () => {
  // $4,501 sits in the interest-only band, which has no split_pay term.
  const meta = build('4501.00');
  assert.equal(meta?.variants[0].number_of_payment_terms, 2);
  assert.equal(meta?.variants[0].price_per_term, '$2,250.50');
  assert.equal(meta?.variants[0].full_price, '$4,501.00');
});

test('prices outside the financed range are marked ineligible', () => {
  assert.equal(build('30.00')?.variants[0].eligible, false);
  assert.equal(build('45000.00')?.variants[0].eligible, false);
  // Band edges are inclusive on both sides.
  assert.equal(build('35.00')?.variants[0].eligible, true);
  assert.equal(build('30000.00')?.variants[0].eligible, true);
  // A gap between bands would silently drop a real price into "ineligible".
  assert.equal(build('149.99')?.variants[0].number_of_payment_terms, 4);
  assert.equal(build('150.00')?.variants[0].number_of_payment_terms, 4);
});

test('unusable prices produce no banner rather than a broken one', () => {
  assert.equal(build('0.00'), null);
  assert.equal(build('not a price'), null);
});

test('the split-pay clause is cut, and only when it is a clause', () => {
  assert.equal(
    stripSplitPayCopy(
      'Pay in 4 interest-free installments, or from $52.09/mo with Shop Pay',
    ),
    'Pay from $52.09/mo with Shop Pay',
  );
  // Split pay alone: no comma, so the sentence is left whole.
  const only = 'Pay in 4 interest-free installments of $32.50 with Shop Pay';
  assert.equal(stripSplitPayCopy(only), only);
  // Nothing to cut is a no-op, not a mangle.
  assert.equal(stripSplitPayCopy('Learn more'), 'Learn more');
});

test('variant gids reduce to the bare id the element wants', () => {
  assert.equal(variantIdNumber('gid://shopify/ProductVariant/123'), 123);
  assert.equal(variantIdNumber(undefined), null);
  assert.equal(variantIdNumber('gid://shopify/ProductVariant/'), null);
});
