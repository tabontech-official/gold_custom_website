/**
 * End-to-end check of the collection share cards against the LIVE Shopify CDN.
 *
 * Imports the real `resolveShareImage`/`pageSeo` and hands them a withCache
 * stub that is just `fetch`, so what it reports is what the loader will publish
 * — not a re-implementation that can drift from it.
 *
 * Not part of any build: `npx vite-node scripts/verify-og.mjs`. Run it after
 * touching OG_TIERS, the cap, or the fallback, and after a merchant re-uploads
 * collection banners.
 */
import {readFileSync} from 'node:fs';
import {pageSeo, resolveShareImage, SITE} from '../app/lib/seo.ts';

// Read .env directly rather than process.env: vite-node inlines process.env at
// transform time, so the vars are simply not there at runtime.
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*(\w+)\s*=\s*"?([^"\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const DOMAIN = env.PUBLIC_STORE_DOMAIN ?? 'goldcustomedo.myshopify.com';
const TOKEN = env.PUBLIC_STOREFRONT_API_TOKEN;
if (!TOKEN) throw new Error('PUBLIC_STOREFRONT_API_TOKEN missing from .env');

// The body MUST be drained. Hydrogen's real withCache reads it to cache it;
// leaving it open here exhausts undici's connection pool part-way through the
// run and the probe starts failing on collections that are perfectly fine — the
// first version of this script blamed 8 healthy banners on the size cap.
const withCache = {
  fetch: async (url, init) => {
    const response = await fetch(url, init);
    await response.arrayBuffer();
    return {response};
  },
};

const res = await fetch(`https://${DOMAIN}/api/2025-07/graphql.json`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN},
  body: JSON.stringify({
    query: `query{collections(first:250){nodes{handle title image{url}}}}`,
  }),
});
const {data} = await res.json();
const collections = data.collections.nodes;

const rows = [];
for (let i = 0; i < collections.length; i += 8) {
  await Promise.all(
    collections.slice(i, i + 8).map(async (c) => {
      const shareImage = await resolveShareImage(withCache, c.image?.url);
      const tags = pageSeo({title: c.title, shareImage});
      const og = tags.find((t) => t.property === 'og:image').content;
      rows.push({
        handle: c.handle,
        hasImage: Boolean(c.image),
        ownImage: !og.includes('Gold_Custom_Logo'),
        size: shareImage ? `${shareImage.width}x${shareImage.height}` : 'fallback',
        og,
      });
    }),
  );
}

const withImage = rows.filter((r) => r.hasImage);
const lost = withImage.filter((r) => !r.ownImage);
const wrongCategory = rows.filter((r) => !r.ownImage && r.og.includes('/collections/'));

console.log(`collections:            ${rows.length}`);
console.log(`  have an image:        ${withImage.length}`);
console.log(`    published their own:${withImage.filter((r) => r.ownImage).length}`);
console.log(`    lost to the cap:    ${lost.length}${lost.length ? ' ' + lost.map((r) => r.handle).join(', ') : ''}`);
console.log(`  no image -> brand:    ${rows.length - withImage.length}`);
console.log(`\nby tier: ${JSON.stringify(rows.reduce((a, r) => ({...a, [r.size]: (a[r.size] ?? 0) + 1}), {}))}`);

// The bug the merchant reported: a card showing some OTHER category's picture.
// The fallback is the brand logo, so no share card may ever point at a
// /collections/ image it does not belong to.
console.log(`\nshowing another category's image: ${wrongCategory.length}`);
if (wrongCategory.length) {
  console.log(wrongCategory.map((r) => `  ${r.handle} -> ${r.og}`).join('\n'));
  process.exitCode = 1;
}
console.log(`fallback is: ${SITE.ogImage}`);
