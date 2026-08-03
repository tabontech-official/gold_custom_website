/**
 * Self-check for the Offer claims in Product JSON-LD.
 * No test runner in this project, so: `node app/lib/seoOffer.test.ts`
 * (`.ts` extension on the import is required by Node's ESM resolver; tsx
 * cannot load this one because tsconfig sets `baseUrl` to an empty string,
 * which its path resolver reads as unset.)
 *
 * These assertions exist because this file makes public promises about
 * shipping and returns. A wrong value here is not a rendering bug — it is a
 * claim Google cross-checks against the storefront, and mismatches cost
 * Merchant Center standing. Each case below pins a promise the store actually
 * makes on-page.
 */
import assert from 'node:assert/strict';
import {
  FREE_SHIPPING_THRESHOLD_USD,
  MERCHANT_RETURN_POLICY,
  offerShippingDetails,
  priceValidUntilDate,
} from './seo.ts';

// --- free shipping: only claimed where it is unconditionally true ----------

// At and above $99 the order qualifies on its own, so the claim holds.
const atThreshold = offerShippingDetails({amount: '99.00', currencyCode: 'USD'});
assert.equal(atThreshold?.shippingRate.value, 0);
assert.equal(atThreshold?.shippingDestination.addressCountry, 'US');
assert.ok(offerShippingDetails({amount: '1375.0', currencyCode: 'USD'}));

// Below it, free shipping depends on the rest of the cart, which this schema
// cannot express — so claim nothing rather than something false.
assert.equal(offerShippingDetails({amount: '98.99', currencyCode: 'USD'}), undefined);
assert.equal(offerShippingDetails({amount: '40.00', currencyCode: 'USD'}), undefined);

// The promise is US-only; a CAD price of 200 does not earn it.
assert.equal(offerShippingDetails({amount: '200.00', currencyCode: 'CAD'}), undefined);

// Junk price data must not accidentally qualify. `Number('')` is 0 and
// `Number('abc')` is NaN — neither may pass the >= check.
assert.equal(offerShippingDetails({amount: '', currencyCode: 'USD'}), undefined);
assert.equal(offerShippingDetails({amount: 'abc', currencyCode: 'USD'}), undefined);

assert.equal(FREE_SHIPPING_THRESHOLD_USD, 99);

// --- returns: must match the refund policy, which is NOT a cash refund -----

assert.equal(MERCHANT_RETURN_POLICY.merchantReturnDays, 14);
// The policy gives exchange or store credit only. If anyone ever adds
// FullRefund here without changing the policy page, that is a false claim.
assert.ok(!MERCHANT_RETURN_POLICY.refundType.includes('https://schema.org/FullRefund' as never));
assert.deepEqual(MERCHANT_RETURN_POLICY.refundType, [
  'https://schema.org/ExchangeRefund',
  'https://schema.org/StoreCreditRefund',
]);
// Customer bears return shipping ("less shipping and handling charges").
assert.equal(MERCHANT_RETURN_POLICY.returnFees, 'https://schema.org/ReturnShippingFees');

// --- priceValidUntil ------------------------------------------------------

// Exactly one year ahead, ISO date only, so Google never sees a stale offer.
assert.equal(priceValidUntilDate(new Date('2026-08-03T12:00:00Z')), '2027-08-03');
assert.match(priceValidUntilDate(), /^\d{4}-\d{2}-\d{2}$/);
// Must be deterministic for a given instant — it is embedded in SSR markup
// that the client re-renders, and drift there is a hydration mismatch.
const instant = new Date('2026-12-31T23:59:59Z');
assert.equal(priceValidUntilDate(instant), priceValidUntilDate(instant));
// Leap day must not roll into an invalid date.
assert.equal(priceValidUntilDate(new Date('2028-02-29T00:00:00Z')), '2029-03-01');

console.log('seoOffer: all assertions passed');
