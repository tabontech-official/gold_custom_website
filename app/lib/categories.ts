export type StorefrontCategory = {
  label: string;
  handle: string;
  tags?: string[];
};

/**
 * Static shop-by-category tiles shown on the homepage grid and the
 * collection-page category slider. Kept separate from MEGA_MENU (megaMenu.ts)
 * because these are simple label/handle pairs for tile links, not the
 * full nested department/column structure used by the header nav.
 */
export const CATEGORIES: StorefrontCategory[] = [
  {
    label: 'Rings',
    handle: 'rings',
    tags: [
      'All Products',
      'Gold Ring',
      'Gold Ring for Women',
      "Men's Gold Rings",
      'Yellow Gold',
      'Diamond Rings',
      'Engagement',
    ],
  },
  {
    label: 'Chains',
    handle: 'chains',
    tags: [
      'All Products',
      'Cuban Link',
      'Figaro Chain',
      'Rope Chain',
      'Box Chain',
      'Miami Cuban',
      'Presidential',
    ],
  },
  {
    label: 'Bracelets',
    handle: 'bracelets',
    tags: [
      'All Products',
      'Gold Bracelet',
      'Miami Bracelet',
      'Cuban Link Bracelet',
      'Figaro Bracelet',
    ],
  },
  {label: 'Earrings', handle: 'earrings'},
  {label: 'Pendants', handle: 'pendants'},
  {label: 'Necklaces', handle: 'necklaces'},
  {label: 'Charms', handle: 'charms'},
  {label: 'Diamond', handle: 'diamond'},
  {label: 'Engagement', handle: 'engagement-rings'},
];

type CategorizableProduct = {
  category?: {name?: string | null} | null;
  productType?: string | null;
};

/**
 * Whole-word containment.
 *
 * The loose `String.includes` this replaces filed every single earring under
 * Rings, because "earrings".includes("rings") is true and Rings sits earlier
 * in CATEGORIES — so earrings got /products/rings/… as their canonical URL
 * and "Rings" in their breadcrumb. Requiring a word boundary keeps the
 * containment check that Shopify taxonomy names like "Necklaces in Jewelry"
 * depend on, while refusing to match a label buried inside a longer word.
 */
function containsWord(haystack: string, needle: string) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

/**
 * Resolve a product's Shopify category/productType to one of the CATEGORIES
 * tiles above, so it can be linked as a shoppable collection.
 *
 * First match in CATEGORIES order wins, deliberately: "Diamond Rings" and
 * "Engagement Rings" both resolve to Rings, which is where their existing
 * canonical URLs already point. Reordering or preferring the longer label
 * would silently move live product URLs.
 */
export function getProductCategoryMatch(product: CategorizableProduct) {
  const rawCategory = product.category?.name || product.productType || '';
  const categoryName =
    rawCategory && rawCategory.toLowerCase() !== 'uncategorized'
      ? rawCategory
      : '';
  if (!categoryName) return undefined;

  const name = categoryName.toLowerCase();

  return CATEGORIES.find((c) => {
    const label = c.label.toLowerCase();
    return (
      name === label ||
      name === c.handle ||
      containsWord(name, label) ||
      containsWord(name, c.handle)
    );
  });
}

/**
 * `/collections/{collection}/products/{handle}` — the storefront's one product
 * URL shape.
 *
 * This is the shape the previous Liquid storefront used, so every product link
 * Google, an old email or a customer's bookmark still holds resolves here
 * directly with no redirect at all. It also keeps the path a shopper is
 * standing in stable: clicking a product inside /collections/earrings no
 * longer throws them out to a different top-level branch of the site.
 */
export function buildProductPath(collectionHandle: string, handle: string) {
  return `/collections/${encodeURIComponent(collectionHandle)}/products/${encodeURIComponent(handle)}`;
}

/**
 * The single indexable path for a product.
 *
 * A product sits in many collections, so it is reachable at many valid URLs —
 * exactly as it was on the Liquid storefront. The collection segment here is
 * the product's OWN resolved category, never whichever collection it happened
 * to be browsed through, so the answer is the same on every one of those pages
 * and they all point at one indexed URL.
 *
 * Products whose category doesn't resolve have no collection to nest under and
 * stay at the flat `/products/{handle}`, which serves 200 for them.
 *
 * The loader, the `<link rel="canonical">`, the JSON-LD and llms.txt all call
 * this, so they can never drift apart.
 */
export function productCanonicalPath(
  product: CategorizableProduct & {handle: string},
) {
  const category = getProductCategoryMatch(product);
  if (!category) return `/products/${encodeURIComponent(product.handle)}`;

  return buildProductPath(category.handle, product.handle);
}

/**
 * Display name for a collection handle, for breadcrumbs on a product page
 * reached through a collection. The handle is all the URL carries, and
 * querying the collection just to title it would cost a round trip on every
 * product view — so use the known label where we have one and title-case the
 * handle otherwise ("mens-gold-rings" → "Mens Gold Rings").
 */
export function collectionLabel(handle: string) {
  const known = CATEGORIES.find((c) => c.handle === handle);
  if (known) return known.label;
  return handle
    .replace(/-/g, ' ')
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
