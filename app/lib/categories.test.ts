/**
 * Self-check for product → category resolution.
 * No test runner in this project, so: `node app/lib/categories.test.ts`
 *
 * This function decides each product's canonical URL and breadcrumb, so a
 * wrong answer here is not cosmetic — it changes the address Google indexes.
 * The earrings case below is a regression guard: a plain `includes` matched
 * "rings" inside "earrings" and filed the entire earring catalogue under
 * /products/rings/.
 */
import assert from 'node:assert/strict';
import {
  buildProductPath,
  collectionLabel,
  getProductCategoryMatch,
  productCanonicalPath,
} from './categories.ts';

const match = (category: string) =>
  getProductCategoryMatch({category: {name: category}})?.handle;

// --- the regression --------------------------------------------------------

assert.equal(match('Earrings'), 'earrings');
assert.equal(match('10k gold Stud Earrings'), 'earrings');
assert.equal(match('Drop Earrings'), 'earrings');

// --- still matches what it always did --------------------------------------

assert.equal(match('Rings'), 'rings');
assert.equal(match('Chains'), 'chains');
assert.equal(match('Bracelets'), 'bracelets');
assert.equal(match('Pendants'), 'pendants');

// Shopify taxonomy names embed the label in a phrase; that is the whole
// reason containment matching exists, so it has to keep working.
assert.equal(match('Necklaces in Jewelry'), 'necklaces');
assert.equal(match('Jewelry > Bracelets'), 'bracelets');

// First-match-wins is load-bearing: these already resolve to Rings in
// production, and "improving" them to Diamond/Engagement would move live URLs.
assert.equal(match('Diamond Rings'), 'rings');
assert.equal(match('Engagement Rings'), 'rings');

// --- no category at all ----------------------------------------------------

assert.equal(match('uncategorized'), undefined);
assert.equal(match(''), undefined);
assert.equal(getProductCategoryMatch({}), undefined);
// Falls back to productType when Shopify's category is absent.
assert.equal(
  getProductCategoryMatch({productType: 'Charms'})?.handle,
  'charms',
);

// --- canonical paths, which is what all of the above feeds -----------------

// The shape the old Liquid storefront used, so its indexed links land here
// with no redirect at all.
assert.equal(
  productCanonicalPath({handle: 'gold-hoop', category: {name: 'Earrings'}}),
  '/collections/earrings/products/gold-hoop',
);
assert.equal(
  buildProductPath('chains', '10k-miami-cuban'),
  '/collections/chains/products/10k-miami-cuban',
);

// Unmatched category has no collection to nest under, so it stays flat — and
// products.$handle.tsx compares against exactly this string to decide whether
// to redirect. Change the fallback and that route redirects to itself forever.
assert.equal(
  productCanonicalPath({handle: 'mystery-item', category: {name: 'Widgets'}}),
  '/products/mystery-item',
);

// Canonical follows the product's OWN category, never the collection it was
// browsed through — that is what keeps one product on one indexed URL no
// matter how many collections list it.
assert.equal(
  productCanonicalPath({handle: 'gold-hoop', category: {name: 'Drop Earrings'}}),
  '/collections/earrings/products/gold-hoop',
);

// --- breadcrumb labels for a collection handle -----------------------------

assert.equal(collectionLabel('earrings'), 'Earrings');
assert.equal(collectionLabel('engagement-rings'), 'Engagement');
// Not a CATEGORIES tile: title-cased rather than shown raw as "mens-gold-rings".
assert.equal(collectionLabel('mens-gold-rings'), 'Mens Gold Rings');

console.log('categories: all assertions passed');
