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
import {pageSeo, resolveShareImage, stripBrandSuffix} from './seo.ts';

// No brand suffix on titles — it pushed products past the ~60 chars Google
// renders. Real collection value from Shopify's SEO field, plus the two ways
// this could go wrong: eating a mid-title brand, and eating the whole title.
assert.equal(
  stripBrandSuffix('10K & 14K Gold Charms | Gold Custom'),
  '10K & 14K Gold Charms',
);
assert.equal(
  stripBrandSuffix('Gold Custom Chains for Men'),
  'Gold Custom Chains for Men',
);
assert.equal(stripBrandSuffix('Gold Custom'), 'Gold Custom');

const PNG = 'https://cdn.shopify.com/s/files/1/0806/collections/chain.png?v=1';

/**
 * Minimal stand-in for Hydrogen's withCache: only the response headers matter.
 * `headers` may be a single set (same answer at every tier) or one set per
 * OG_TIERS entry, largest first, to model an image that only fits when shrunk.
 */
function stubCache(...perTier: Record<string, string>[]) {
  let call = 0;
  return {
    fetch: async () => ({
      response: new Response(null, {
        headers: perTier[Math.min(call++, perTier.length - 1)],
      }),
    }),
  } as unknown as WithCache;
}

const at = (width: number, height: number) =>
  `${PNG}&width=${width}&height=${height}&pad_color=fff&quality=80&format=jpg`;

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
// is the byte count it refuses. The FIRST tier wins, and the transformed url
// comes back carrying the size it was verified at.
assert.deepEqual(
  await resolveShareImage(
    stubCache({'content-type': 'image/png', 'content-length': '200000'}),
    PNG,
  ),
  {url: at(1200, 630), width: 1200, height: 630},
);

// THE BUG THIS RELEASE FIXES. A transparent PNG the CDN will not transcode: too
// heavy at 1200x630, fine at 600x315. It used to give up after the first miss
// and publish the brand shot, which is how 47 of 61 collection banners ended up
// showing a picture of some other category. Now it drops a tier and keeps its
// own image, and the published url must be the 600px one — republishing the
// 1200px url would put it straight back over the cap.
assert.deepEqual(
  await resolveShareImage(
    stubCache(
      {'content-type': 'image/png', 'content-length': '973000'},
      {'content-type': 'image/png', 'content-length': '260000'},
    ),
    PNG,
  ),
  {url: at(600, 315), width: 600, height: 315},
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

// Over the cap at EVERY tier: only now is the brand logo the right answer.
assert.equal(
  await resolveShareImage(
    stubCache({'content-type': 'image/png', 'content-length': '400000'}),
    PNG,
  ),
  null,
);

// No content-length is not a reason to drop a collection's banner — fall back to
// "is this an image at all".
assert.deepEqual(
  await resolveShareImage(stubCache({'content-type': 'image/png'}), PNG),
  {url: at(1200, 630), width: 1200, height: 630},
);
assert.equal(
  await resolveShareImage(stubCache({'content-type': 'text/html'}), PNG),
  null,
);

// No image to probe → no share image, and no request made.
assert.equal(await resolveShareImage(stubCache({}), null), null);

// A measured image is published verbatim — pageSeo must NOT re-transform it, or
// the 600px tier that just rescued 47 collections gets re-stamped at 1200.
const measured = {url: at(600, 315), width: 600, height: 315};
const sized = pageSeo({title: 'Rope Chains', shareImage: measured});
const sizedProp = (name: string) =>
  (sized.find((tag) => (tag as any).property === name) as any).content;
assert.equal(sizedProp('og:image'), measured.url);
assert.equal(sizedProp('og:image:width'), '600');
assert.equal(sizedProp('og:image:height'), '315');

// The fallback is the BRAND LOGO, not a collection banner. It used to be the
// Gold Jewelry collection's own shot, so every un-imaged category advertised a
// category it had nothing to do with — the merchant-visible half of this bug.
assert.match(prop('og:image').content, /Gold_Custom_Logo/);
assert.ok(!prop('og:image').content.includes('/collections/'));

// A small source is NOT a reason to fall back. The old guard rejected anything
// under 600x315 believing the CDN would not upscale; `pad_color` does, and the
// 325x325 Charms banner comes back a true 1200x630.
const small = pageSeo({
  title: 'Charms',
  media: {type: 'image', url: PNG, width: 325, height: 325},
});
assert.match(
  (small.find((tag) => (tag as any).property === 'og:image') as any).content,
  /chain\.png/,
);

console.log('seo: all assertions passed');
