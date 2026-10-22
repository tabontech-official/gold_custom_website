// node app/lib/cartAttribution.test.ts
import assert from 'node:assert/strict';
import {withAttribution} from './cartAttribution.ts';

const cookie =
  '_ga=GA1.1.111.222; _ga_JVYC2BP1H1=GS1.1.s1761234567$o1$g1; other=x';
const get = (list: {key: string; value: string}[] | null, key: string) =>
  list?.find((a) => a.key === key)?.value;

const out = withAttribution([{key: 'gift', value: 'yes'}], {
  search: '?utm_source=test&utm_medium=qa&utm_campaign=b6_utm&gclid=G1',
  referrer: 'https://l.instagram.com/',
  path: '/collections/chains',
  cookie,
});
assert.equal(get(out, 'gift'), 'yes'); // existing attributes kept
assert.equal(get(out, '_utm_source'), 'test');
assert.equal(get(out, '_utm_campaign'), 'b6_utm');
assert.equal(get(out, '_gclid'), 'G1');
assert.equal(get(out, '_landing_referrer'), 'https://l.instagram.com/');
assert.equal(get(out, '_landing_page'), '/collections/chains');
assert.equal(get(out, '_ga_client_id'), '111.222');
assert.equal(get(out, '_ga_session_id'), '1761234567');

// Written once per cart: the marker stops a second write.
assert.equal(withAttribution(out, {search: '?utm_source=other', referrer: '', path: '/', cookie}), null);

// Our own hosts are not a source.
const own = withAttribution([], {search: '', referrer: 'https://www.goldcustom.com/x', path: '/', cookie: ''});
assert.equal(get(own, '_landing_referrer'), undefined);
assert.equal(get(own, '_ga_client_id'), undefined);
assert.equal(get(own, '_landing_page'), '/');

console.log('cartAttribution: ok');
