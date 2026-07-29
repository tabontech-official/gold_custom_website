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
 * Resolve a product's Shopify category/productType to one of the CATEGORIES
 * tiles above, so it can be linked as a shoppable collection.
 */
export function getProductCategoryMatch(product: CategorizableProduct) {
  const rawCategory = product.category?.name || product.productType || '';
  const categoryName =
    rawCategory && rawCategory.toLowerCase() !== 'uncategorized'
      ? rawCategory
      : '';
  if (!categoryName) return undefined;

  return CATEGORIES.find((c) => {
    const name = categoryName.toLowerCase();
    const label = c.label.toLowerCase();
    return (
      name === label ||
      name === c.handle ||
      name.includes(label) ||
      name.includes(c.handle)
    );
  });
}

export function buildHierarchicalProductPath({
  handle,
  categoryHandle,
  subcategoryHandle,
}: {
  handle: string;
  categoryHandle: string;
  subcategoryHandle?: string | null;
}) {
  const segments = ['products', categoryHandle];
  if (subcategoryHandle) segments.push(subcategoryHandle);
  segments.push(handle);
  return `/${segments.map(encodeURIComponent).join('/')}`;
}

/**
 * The single indexable path for a product.
 *
 * `/products/{handle}` 302-redirects to the category path, so the canonical
 * URL must be that destination or we point search engines at a redirect.
 * Subcategory paths are reachable via breadcrumb links but deliberately
 * collapse to the 2-segment category path — one product, one indexed URL.
 *
 * The loader, the `<link rel="canonical">` and the sitemap all call this, so
 * the three can never drift apart.
 */
export function productCanonicalPath(
  product: CategorizableProduct & {handle: string},
) {
  const category = getProductCategoryMatch(product);
  if (!category) return `/products/${encodeURIComponent(product.handle)}`;

  return buildHierarchicalProductPath({
    handle: product.handle,
    categoryHandle: category.handle,
  });
}
