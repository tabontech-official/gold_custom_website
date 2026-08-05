/**
 * Checks every tag in BROWSE_GROUPS still matches products in the live shop.
 *
 *   npx tsx app/lib/browseTags.live.ts
 *
 * Worth running whenever the merchandising team renames or prunes tags. A tag
 * that no longer exists does not error anywhere — `/search?q=tag:"Gone"` just
 * renders an empty results page — so nothing else in the codebase can catch it.
 *
 * Reads PUBLIC_STORE_DOMAIN / PUBLIC_STOREFRONT_API_TOKEN from .env, so it is a
 * developer tool and deliberately not imported by the app.
 * Exits non-zero when a tag is dead, to be CI-able if that's ever wanted.
 */
import {readFileSync} from 'node:fs';
import {BROWSE_GROUPS, browseLabel, tagSearchTerm} from './browseTags';

const API_VERSION = '2026-01';
/** Storefront `search` caps a page at 250; we only need "more than zero". */
const PROBE = `query($q: String!) {
  search(query: $q, types: PRODUCT, first: 1) { nodes { ... on Product { id } } }
}`;

function env(): {domain: string; token: string} {
  const raw = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
  const read = (key: string) =>
    raw.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim().replace(/^"|"$/g, '');
  const domain = read('PUBLIC_STORE_DOMAIN');
  const token = read('PUBLIC_STOREFRONT_API_TOKEN');
  if (!domain || !token) {
    throw new Error('.env is missing PUBLIC_STORE_DOMAIN or PUBLIC_STOREFRONT_API_TOKEN');
  }
  return {domain, token};
}

async function count(
  {domain, token}: {domain: string; token: string},
  tag: string,
): Promise<number> {
  const response = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({query: PROBE, variables: {q: tagSearchTerm(tag)}}),
  });
  const body = (await response.json()) as any;
  if (body.errors) throw new Error(JSON.stringify(body.errors).slice(0, 200));
  return body.data.search.nodes.length;
}

const credentials = env();
const dead: string[] = [];

for (const group of BROWSE_GROUPS) {
  console.log(`\n=== ${group.title} ===`);
  for (const entry of group.tags) {
    const hits = await count(credentials, entry.tag);
    if (hits === 0) dead.push(entry.tag);
    const name = browseLabel(entry);
    const shown = name === entry.tag ? name : `${name}  (tag: ${entry.tag})`;
    console.log(`  ${hits > 0 ? 'ok  ' : 'DEAD'}  ${shown}`);
  }
}

const total = BROWSE_GROUPS.reduce((n, g) => n + g.tags.length, 0);
if (dead.length) {
  console.error(`\n${dead.length}/${total} tags match nothing: ${dead.join(', ')}`);
  process.exit(1);
}
console.log(`\nbrowseTags.live: all ${total} tags match products.`);
