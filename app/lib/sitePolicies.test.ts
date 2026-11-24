import assert from 'node:assert/strict';
import {parseSitePolicies, policySeoDescription} from './sitePolicies.ts';

const fallback = parseSitePolicies(null);
assert.match(fallback.shipping, /no minimum/);
assert.match(fallback.returns, /manufacturing defect/);
assert.ok(fallback.warranty);
assert.ok(fallback.madeInUSA);

const parsed = parseSitePolicies({
  metaobject: {
    fields: [
      {key: 'shipping', value: 'Ships free on qualifying orders'},
      {key: 'returns_policy', value: '14-day returns for store credit'},
      {key: 'warranty', value: 'One year limited warranty'},
      {key: 'made_in_usa', value: 'Made in the United States'},
    ],
  },
});
assert.equal(parsed.shipping, fallback.shipping);
assert.equal(parsed.returns, fallback.returns);
assert.equal(parsed.warranty, 'One year limited warranty');
assert.equal(parsed.madeInUSA, 'Made in the United States');
assert.match(policySeoDescription(parsed), /manufacturing defect/);

const partial = parseSitePolicies({metaobject: {fields: [{key: 'shipping', value: 'Only shipping changed'}]}});
assert.equal(partial.shipping, fallback.shipping);
assert.equal(partial.returns, fallback.returns);

const rich = parseSitePolicies({
  metaobject: {
    fields: [{
      key: 'warranty',
      value: JSON.stringify({
        type: 'root',
        children: [{type: 'paragraph', children: [{type: 'text', value: 'Rich text warranty'}]}],
      }),
    }],
  },
});
assert.equal(rich.warranty, 'Rich text warranty');

// Live site_policies keys append `_sentence`; Shopify Storefront returns those
// keys with the underscores preserved, then the parser normalizes them.
const liveFieldShape = parseSitePolicies({
  metaobject: {
    fields: [
      {key: 'shipping_sentence', value: 'Free U.S. Shipping $99+ testttt'},
      {key: 'returns_sentence', value: '14-day exchanges or store credit'},
      {key: 'warranty_sentence', value: 'Manufacturing defects only'},
      {key: 'made_in_usa_sentence', value: 'Made in U.S.A.'},
    ],
  },
});
assert.equal(liveFieldShape.shipping, fallback.shipping);
assert.equal(liveFieldShape.returns, fallback.returns);
assert.equal(liveFieldShape.warranty, 'Manufacturing defects only');
assert.equal(liveFieldShape.madeInUSA, 'Made in U.S.A.');
const liveSeoDescription = policySeoDescription(liveFieldShape);
assert.doesNotMatch(liveSeoDescription, /\$99/);
assert.ok(liveSeoDescription.length <= 155);
