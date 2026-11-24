import assert from 'node:assert/strict';
import {
  TRUST_CLAIMS,
  claimLine,
} from './trustClaims.ts';
import {MERCHANT_RETURN_POLICY, SITE} from './seo.ts';

const lines = TRUST_CLAIMS.map(claimLine);
const everything = [...lines, SITE.description];

const shipping = TRUST_CLAIMS.find((claim) => claim.icon === 'shipping');
assert.match(shipping?.title ?? '', /free standard u\.s\. shipping/i);
assert.match(shipping?.sub ?? '', /no minimum/i);
assert.match(SITE.description, /on all orders/i);

const returns = TRUST_CLAIMS.find((claim) => claim.icon === 'returns');
assert.match(returns?.title ?? '', /manufacturing defect/i);
assert.match(returns?.sub ?? '', /exchange or store credit/i);
assert.ok(returns?.sub.includes(String(MERCHANT_RETURN_POLICY.merchantReturnDays)));

// Nothing the policies don't back.
for (const text of everything) {
  assert.doesNotMatch(text, /30[- ]?day/i, `no 30-day promise: ${text}`);
  assert.doesNotMatch(text, /\brefund/i, `no cash-refund promise: ${text}`);
  assert.doesNotMatch(text, /lifetime/i, `no lifetime promise: ${text}`);
  assert.doesNotMatch(text, /18\s?k/i, `no 18K claim (none is sold): ${text}`);
  // Neither the refund policy nor the terms of service offers a warranty. If
  // one is published, restore the claim (see trustClaims.ts) and drop this.
  assert.doesNotMatch(text, /warrant/i, `no warranty (no policy): ${text}`);
  assert.doesNotMatch(text, /\$\d+/);
}

// The site-wide description stays inside the ~125 characters social previews
// show on mobile (see SITE in seo.ts).
assert.ok(
  SITE.description.length <= 125,
  `description is ${SITE.description.length} chars`,
);

console.log('trustClaims: ok');
