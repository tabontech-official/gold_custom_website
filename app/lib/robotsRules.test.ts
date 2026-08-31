/**
 * Self-check for the robots.txt rules.
 * No test runner in this project, so: `node app/lib/robotsRules.test.ts`
 *
 * This exists because a robots.txt rule fails silently and expensively. An
 * inherited Shopify rule, `Disallow: /collections/*+*`, was meant for Liquid
 * tag-filter URLs but matched the QUERY STRING too — so every product URL
 * carrying a variant option with a space in its value
 * (`?Metal=10K+Yellow+Gold`) was blocked from Googlebot. Nothing errored,
 * nothing 404'd; ~1,900 products just quietly went uncrawlable and Merchant
 * Center rejected them all.
 *
 * It runs against the real generated body, and resolves rules the way Google
 * does — per user-agent group, longest match wins, Allow breaks ties.
 */
import assert from 'node:assert/strict';
import {robotsTxtData} from './robotsTxt.ts';

const body = robotsTxtData({
  url: 'https://www.goldcustom.com',
  shopId: '80695689464',
});

/** Rules for one user-agent, in the order robots.txt declares them. */
function groupFor(agent: string) {
  const groups = new Map<string, {kind: string; pattern: string}[]>();
  let current: {kind: string; pattern: string}[] | null = null;

  for (const raw of body.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const name = key.trim().toLowerCase();

    if (name === 'user-agent') {
      current = groups.get(value.toLowerCase()) ?? [];
      groups.set(value.toLowerCase(), current);
    } else if ((name === 'allow' || name === 'disallow') && current && value) {
      current.push({kind: name, pattern: value});
    }
  }

  const rules = groups.get(agent.toLowerCase()) ?? groups.get('*');
  assert.ok(rules && rules.length > 10, `no usable group for ${agent}`);
  return rules;
}

/**
 * Google's matcher: `*` is any run of characters, `$` anchors the end,
 * everything else is literal. Escaped against a specials list rather than a
 * regex, which keeps the intent readable.
 */
const SPECIALS = '.+?^{}()|[]';
function toRegExp(pattern: string) {
  let out = '';
  for (const ch of pattern) {
    if (ch === '*') out += '.*';
    else if (ch === '$') out += '$';
    else if (SPECIALS.includes(ch)) out += String.fromCharCode(92) + ch;
    else out += ch;
  }
  return new RegExp('^' + out);
}

function isAllowed(path: string, agent = 'Googlebot') {
  let best: {len: number; allow: boolean} | null = null;
  for (const {kind, pattern} of groupFor(agent)) {
    if (!toRegExp(pattern).test(path)) continue;
    const candidate = {len: pattern.length, allow: kind === 'allow'};
    if (
      !best ||
      candidate.len > best.len ||
      (candidate.len === best.len && candidate.allow)
    ) {
      best = candidate;
    }
  }
  return best ? best.allow : true;
}

// Product pages must be crawlable — with or without the variant params
// Hydrogen writes into the URL. `+` is an encoded space, not a tag separator.
const crawlable = [
  '/',
  '/collections/classic-link-bracelets/products/brolex5-7-5',
  '/collections/classic-link-bracelets/products/brolex5-7-5?Metal=10K+Yellow+Gold',
  '/collections/rings/products/x?Metal=10K%2BYellow+Gold',
  '/products/x?Metal=14K+White+Gold',
  '/collections/rings',
  '/pages/about',
  '/policies/refund-policy',
  '/sitemap.xml',
];

// Faceted duplicates and private pages stay out.
const blocked = [
  '/collections/rings?sort_by=price-ascending',
  '/cart',
  '/account',
  '/checkout',
  '/checkouts/abc',
  '/80695689464/orders',
  '/search?q=chain',
];

// Googlebot and the catch-all group are generated from the same rules, so a
// regression that only lands in one of them still has to fail here.
for (const agent of ['Googlebot', 'Googlebot-Image', '*']) {
  for (const path of crawlable) {
    assert.equal(isAllowed(path, agent), true, `${agent} must crawl: ${path}`);
  }
  for (const path of blocked) {
    assert.equal(isAllowed(path, agent), false, `${agent} must block: ${path}`);
  }
}

// The sitemap has to be advertised, or nothing above matters.
assert.match(body, /^Sitemap: https:\/\/www\.goldcustom\.com\/sitemap\.xml$/m);

console.log('robots rules self-check passed');
