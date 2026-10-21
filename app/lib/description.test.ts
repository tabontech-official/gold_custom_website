/**
 * Self-check for localizeLinks.
 * No test runner in this project, so: `node app/lib/description.test.ts`
 *
 * Merchant HTML links to the bare apex host hundreds of times, which keeps
 * goldcustom.com indexed as its own site. The rewrite has to catch every
 * own-host href and nothing else — not the visible text, not other domains,
 * and not the Shopify-only paths that would 404 on www.
 */
import assert from 'node:assert/strict';
import {localizeLinks} from './description.ts';

const cases: [string, string][] = [
  // apex, www and the Shopify checkout host all become root-relative
  [
    '<a href="https://goldcustom.com/collections/chains">',
    '<a href="/collections/chains">',
  ],
  [
    '<a href="https://www.goldcustom.com/blogs/how-to-tell-if-gold-is-real">',
    '<a href="/blogs/how-to-tell-if-gold-is-real">',
  ],
  [
    '<a href="https://checkout.goldcustom.com/pages/faqs">',
    '<a href="/pages/faqs">',
  ],
  ['<a href="http://goldcustom.com/products/x">', '<a href="/products/x">'],
  // bare host, with and without the trailing slash
  ['<a href="https://goldcustom.com">', '<a href="/">'],
  ['<a href="https://goldcustom.com/">', '<a href="/">'],
  // query and hash survive
  [
    '<a href="https://goldcustom.com/products/x?variant=48767724978424#size">',
    '<a href="/products/x?variant=48767724978424#size">',
  ],
  // Shopify-host-only paths stay absolute
  [
    '<a href="https://checkout.goldcustom.com/checkouts/abc">',
    '<a href="https://checkout.goldcustom.com/checkouts/abc">',
  ],
  [
    '<a href="https://goldcustom.com/orders">',
    '<a href="https://goldcustom.com/orders">',
  ],
  [
    '<a href="https://goldcustom.com/apps/reviews?x=1">',
    '<a href="https://goldcustom.com/apps/reviews?x=1">',
  ],
  [
    '<a href="https://goldcustom.com/tools/x">',
    '<a href="https://goldcustom.com/tools/x">',
  ],
  // ...but only as whole segments
  ['<a href="https://goldcustom.com/apps-guide">', '<a href="/apps-guide">'],
  // link text and src untouched
  [
    '<a href="https://goldcustom.com/">https://goldcustom.com/</a>',
    '<a href="/">https://goldcustom.com/</a>',
  ],
  [
    '<img src="https://goldcustom.com/cdn/x.jpg">',
    '<img src="https://goldcustom.com/cdn/x.jpg">',
  ],
  // other domains, including look-alikes, untouched
  [
    '<a href="https://example.com/goldcustom.com">',
    '<a href="https://example.com/goldcustom.com">',
  ],
  [
    '<a href="https://goldcustom.com.evil.io/">',
    '<a href="https://goldcustom.com.evil.io/">',
  ],
  [
    '<a href="https://shop.goldcustom.com/x">',
    '<a href="https://shop.goldcustom.com/x">',
  ],
];

for (const [input, expected] of cases) {
  assert.equal(localizeLinks(input), expected, input);
}

// Every link in a block, not just the first.
assert.equal(
  localizeLinks(
    '<p><a href="https://goldcustom.com/a">a</a> <a href="https://goldcustom.com/b">b</a></p>',
  ),
  '<p><a href="/a">a</a> <a href="/b">b</a></p>',
);

console.log('description self-check passed');
