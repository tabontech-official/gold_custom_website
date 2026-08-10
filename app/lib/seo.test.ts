/**
 * Self-check for the share-image decisions behind every Open Graph card.
 * No test runner in this project, so: `npx vite-node app/lib/seo.test.ts`
 * vite-node, not the `npx tsx` the sibling tests use: this one reaches
 * `@shopify/hydrogen` through ./seo, and tsx reads tsconfig's `baseUrl: ""` as
 * unset and refuses the bare specifier. vite-node uses the vite config, which
 * resolves it.
 * ponytail: plain asserts; move to a runner if this grows past a handful of cases.
 *
 * Both cases here are regression guards for the WhatsApp/Facebook blank-preview
 * bug: a hardcoded `og:image:type` that contradicted the bytes the Shopify CDN
 * actually served, and a size cap that any JPEG could walk straight past.
 */
import assert from 'node:assert/strict';
import type {WithCache} from '@shopify/hydrogen';
import {pageSeo, resolveShareImage} from './seo';

const PNG = 'https://cdn.shopify.com/s/files/1/0806/collections/chain.png?v=1';

/** Minimal stand-in for Hydrogen's withCache: only the response headers matter. */
function stubCache(headers: Record<string, string>) {
  return {
    fetch: async () => ({response: new Response(null, {headers})}),
  } as unknown as WithCache;
}

const tags = pageSeo({title: 'Earrings'});
const prop = (name: string) =>
  tags.find((tag) => (tag as any).property === name) as any;

// The card must still declare an image, and an absolute one — a relative
// og:image is the most reliable way to get a blank preview.
assert.ok(prop('og:image').content.startsWith('https://'));
assert.equal(prop('og:image:secure_url').content, prop('og:image').content);

// THE BUG. `og:image:type` was hardcoded `image/jpeg` while the CDN returned
// unchanged PNG for every alpha source — which is most of this catalogue. Meta's
// scraper trusts the declared type and drops an image that disagrees with it,
// which is why the cards worked everywhere except WhatsApp and Facebook. Never
// publish this tag from a guess again; only from a measured content-type.
assert.equal(
  tags.some((tag) => (tag as any).property === 'og:image:type'),
  false,
  'og:image:type must not be declared unless it was measured off the response',
);

// A PNG comfortably under the cap is usable — WhatsApp renders PNG happily, it
// is the byte count it refuses. The RAW url comes back, never the transformed
// one: pageSeo re-applies the transform itself.
assert.equal(
  await resolveShareImage(
    stubCache({'content-type': 'image/png', 'content-length': '200000'}),
    PNG,
  ),
  PNG,
);

// THE OTHER BUG. The check was `type.includes('jpeg') || under cap`, so a
// multi-megabyte JPEG passed on format alone — the exact case the cap exists to
// stop. Size gates now, format gets no say.
assert.equal(
  await resolveShareImage(
    stubCache({'content-type': 'image/jpeg', 'content-length': '2000000'}),
    PNG,
  ),
  null,
);

// Over the cap as PNG: still a fallback, as before.
assert.equal(
  await resolveShareImage(
    stubCache({'content-type': 'image/png', 'content-length': '400000'}),
    PNG,
  ),
  null,
);

// No content-length is not a reason to drop a collection's banner — fall back to
// "is this an image at all".
assert.equal(
  await resolveShareImage(stubCache({'content-type': 'image/png'}), PNG),
  PNG,
);
assert.equal(
  await resolveShareImage(stubCache({'content-type': 'text/html'}), PNG),
  null,
);

// No image to probe → no share image, and no request made.
assert.equal(await resolveShareImage(stubCache({}), null), null);

console.log('seo: all assertions passed');
