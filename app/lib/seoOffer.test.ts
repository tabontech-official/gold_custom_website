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
  cleanSku,
  metaDescription,
  offerShippingDetails,
  offerValidFromDate,
  priceValidUntilDate,
} from './seo.ts';

// --- meta description: must clear getSeoMeta's real limit -------------------

// getSeoMeta says "longer than 160 characters" but actually rejects > 155, so
// anything in the 156-160 window logs `Error in SEO input` on every render.
for (const length of [100, 155, 156, 160, 300]) {
  const out = metaDescription('word '.repeat(400).slice(0, length).trim());
  assert.ok(
    out.length <= 155,
    `metaDescription returned ${out.length} chars for a ${length}-char input`,
  );
}
// Short input is passed through untouched — no gratuitous ellipsis.
assert.equal(metaDescription('A short description.'), 'A short description.');

// Rich text from Shopify is reduced to prose. This shipped live: the refund
// and terms policies published descriptions whose FIRST characters were a
// literal "&nbsp;", and pageSeo feeds this straight to og:description too.
assert.equal(
  metaDescription('<p>&nbsp;If, for any reason &amp; at any time</p>'),
  'If, for any reason & at any time',
);
// Block tags become a space, never nothing — otherwise adjacent blocks glue
// their words together ("gold.Free" instead of "gold. Free").
assert.equal(
  metaDescription('<p>Solid 14K gold.</p><p>Free shipping.</p>'),
  'Solid 14K gold. Free shipping.',
);
// Tags are stripped BEFORE entities are decoded. Reversing that order turns
// an encoded &lt;b&gt; into a real-looking tag and silently eats the text.
assert.equal(metaDescription('<p>Use &lt;b&gt; for bold</p>'), 'Use <b> for bold');
// Empty input falls back rather than emitting an empty description tag.
assert.ok(metaDescription('').length > 0);
assert.ok(metaDescription(null).length > 0);
// Truncation cuts on a word boundary, so it never ends mid-word.
const truncated = metaDescription('supercalifragilistic '.repeat(20));
assert.ok(truncated.endsWith('…'));
assert.ok(!truncated.includes('supercalifragilistic…'.slice(0, 5) + '…'));

// --- free shipping: only claimed where it is unconditionally true ----------

// At and above $99 the order qualifies on its own, so the claim holds.
const atThreshold = offerShippingDetails({amount: '99.00', currencyCode: 'USD'});
assert.equal(atThreshold?.shippingRate.value, 0);
assert.equal(atThreshold?.shippingDestination.addressCountry, 'US');
assert.ok(offerShippingDetails({amount: '1375.0', currencyCode: 'USD'}));

// deliveryTime rides along with every shippingDetails — required by Google's
// structured data check, and must state both legs, not just a total.
// Merchant-given figure: "2 or 3 days" door-to-door.
assert.equal(atThreshold?.deliveryTime.handlingTime.minValue, 1);
assert.equal(atThreshold?.deliveryTime.handlingTime.maxValue, 1);
assert.equal(atThreshold?.deliveryTime.transitTime.minValue, 1);
assert.equal(atThreshold?.deliveryTime.transitTime.maxValue, 2);
assert.equal(atThreshold?.deliveryTime.handlingTime.unitCode, 'DAY');

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
// Customer bears return shipping ("less shipping and handling charges") but
// the policy names no fixed amount — NOT ReturnShippingFees, which would
// require one (and require inventing a number the policy doesn't give).
assert.equal(
  MERCHANT_RETURN_POLICY.returnFees,
  'https://schema.org/ReturnFeesCustomerResponsibility',
);

// --- sku/mpn: whitespace must not survive as a "real" identifier -----------

assert.equal(cleanSku('  GC-1042  '), 'GC-1042');
assert.equal(cleanSku('   '), undefined);
assert.equal(cleanSku(''), undefined);
assert.equal(cleanSku(null), undefined);
assert.equal(cleanSku(undefined), undefined);

// --- validFrom --------------------------------------------------------------

assert.equal(offerValidFromDate(new Date('2026-08-03T12:00:00Z')), '2026-08-03');
assert.match(offerValidFromDate(), /^\d{4}-\d{2}-\d{2}$/);

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
