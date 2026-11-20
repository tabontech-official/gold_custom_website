import assert from 'node:assert/strict';
import {parseSitePolicies, policySeoDescription} from './sitePolicies.ts';

const fallback = parseSitePolicies(null);
assert.ok(fallback.shipping.includes('$99'));
assert.ok(fallback.returns);
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
assert.equal(parsed.shipping, 'Ships free on qualifying orders');
assert.equal(parsed.returns, '14-day returns for store credit');
assert.equal(parsed.warranty, 'One year limited warranty');
assert.equal(parsed.madeInUSA, 'Made in the United States');
assert.match(policySeoDescription(parsed), /One year limited warranty/);

const partial = parseSitePolicies({metaobject: {fields: [{key: 'shipping', value: 'Only shipping changed'}]}});
assert.equal(partial.shipping, 'Only shipping changed');
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
