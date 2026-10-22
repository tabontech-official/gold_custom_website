/**
 * Self-check: every promise the storefront prints agrees with the published
 * policies and with checkout. Run with `node app/lib/trustClaims.test.ts`.
 *
 * These claims were in four places that drifted apart: the badges said free
 * shipping over $99, checkout charged nothing from $70, the shipping policy said
 * all orders, and an engagement-ring FAQ promised 30-day returns against a
 * 14-day policy. They now share one source; this keeps it honest.
 */
import assert from 'node:assert/strict';
import {
  FREE_SHIPPING_THRESHOLD_USD,
  TRUST_CLAIMS,
  claimLine,
} from './trustClaims.ts';
import {MERCHANT_RETURN_POLICY, SITE} from './seo.ts';

const lines = TRUST_CLAIMS.map(claimLine);
const everything = [...lines, SITE.description];

// Shipping: the threshold is stated, in the title itself — on phones the
// announcement bar shows titles alone.
const shipping = TRUST_CLAIMS.find((claim) => claim.icon === 'shipping');
assert.ok(shipping, 'a shipping claim exists');
assert.ok(
  shipping.title.includes(`$${FREE_SHIPPING_THRESHOLD_USD}`),
  `shipping title names the $${FREE_SHIPPING_THRESHOLD_USD} threshold: ${shipping.title}`,
);
assert.ok(SITE.description.includes(`$${FREE_SHIPPING_THRESHOLD_USD}`));

// Returns: the policy's window and its terms (exchange or store credit), again
// in the title.
const returns = TRUST_CLAIMS.find((claim) => claim.icon === 'returns');
assert.ok(returns, 'a returns claim exists');
assert.ok(
  returns.title.includes(String(MERCHANT_RETURN_POLICY.merchantReturnDays)),
);
assert.match(returns.title, /exchange/i);
assert.match(returns.sub, /store credit/i);

// Nothing the policies don't back.
for (const text of everything) {
  assert.doesNotMatch(text, /30[- ]?day/i, `no 30-day promise: ${text}`);
  assert.doesNotMatch(text, /\brefund/i, `no cash-refund promise: ${text}`);
  assert.doesNotMatch(text, /lifetime/i, `no lifetime promise: ${text}`);
  assert.doesNotMatch(text, /18\s?k/i, `no 18K claim (none is sold): ${text}`);
  // Neither the refund policy nor the terms of service offers a warranty. If
  // one is published, restore the claim (see trustClaims.ts) and drop this.
  assert.doesNotMatch(text, /warrant/i, `no warranty (no policy): ${text}`);
  // Any dollar amount is the checkout threshold, never a stale one.
  for (const amount of text.match(/\$\d+/g) ?? []) {
    assert.equal(amount, `$${FREE_SHIPPING_THRESHOLD_USD}`, text);
  }
}

// The site-wide description stays inside the ~125 characters social previews
// show on mobile (see SITE in seo.ts).
assert.ok(
  SITE.description.length <= 125,
  `description is ${SITE.description.length} chars`,
);

console.log('trustClaims: ok');
