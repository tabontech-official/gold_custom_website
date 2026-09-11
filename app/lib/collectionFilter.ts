import type {
  ProductFilter,
  ProductCollectionSortKeys,
  SearchSortKeys,
} from '@shopify/hydrogen/storefront-api-types';

export type SortOption = {
  label: string;
  value: string;
  sortKey: ProductCollectionSortKeys;
  reverse: boolean;
};

export type SearchSortOption = {
  label: string;
  value: string;
  sortKey: SearchSortKeys;
  reverse: boolean;
};

export const SORT_OPTIONS: SortOption[] = [
  {
    label: 'Featured',
    value: 'featured',
    sortKey: 'COLLECTION_DEFAULT',
    reverse: false,
  },
  {
    label: 'Most relevant',
    value: 'relevant',
    sortKey: 'COLLECTION_DEFAULT',
    reverse: false,
  },
  {
    label: 'Best Selling',
    value: 'best-selling',
    sortKey: 'BEST_SELLING',
    reverse: false,
  },
  {
    label: 'Alphabetically, A–Z',
    value: 'title-asc',
    sortKey: 'TITLE',
    reverse: false,
  },
  {
    label: 'Alphabetically, Z–A',
    value: 'title-desc',
    sortKey: 'TITLE',
    reverse: true,
  },
  {
    label: 'Price, low to high',
    value: 'price-asc',
    sortKey: 'PRICE',
    reverse: false,
  },
  {
    label: 'Price, high to low',
    value: 'price-desc',
    sortKey: 'PRICE',
    reverse: true,
  },
  {
    label: 'Date, old to new',
    value: 'date-asc',
    sortKey: 'CREATED',
    reverse: false,
  },
  {
    label: 'Date, new to old',
    value: 'date-desc',
    sortKey: 'CREATED',
    reverse: true,
  },
];

export function getSortFromParam(sort?: string | null): SortOption {
  return (
    SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0]
  );
}

/**
 * Search sorts from a far smaller vocabulary than collections: `SearchSortKeys`
 * is only PRICE and RELEVANCE. Best-selling, alphabetical and date orderings
 * live on `ProductCollectionSortKeys` alone, so offering the collection list on
 * /search would put three-quarters of the menu there as controls that silently
 * do nothing.
 *
 * The `value` strings deliberately match the collection ones, so a shopper who
 * picked "Price, low to high" in a category keeps it when they search.
 */
export const SEARCH_SORT_OPTIONS: SearchSortOption[] = [
  {
    label: 'Most relevant',
    value: 'relevant',
    sortKey: 'RELEVANCE',
    reverse: false,
  },
  {
    label: 'Price, low to high',
    value: 'price-asc',
    sortKey: 'PRICE',
    reverse: false,
  },
  {
    label: 'Price, high to low',
    value: 'price-desc',
    sortKey: 'PRICE',
    reverse: true,
  },
];

export function getSearchSortFromParam(sort?: string | null): SearchSortOption {
  return (
    SEARCH_SORT_OPTIONS.find((option) => option.value === sort) ??
    SEARCH_SORT_OPTIONS[0]
  );
}

/** Every active facet is stored as a JSON-encoded `filter` search param. */
export function getFiltersFromParam(
  searchParams: URLSearchParams,
): ProductFilter[] {
  const filters: ProductFilter[] = [];
  for (const value of searchParams.getAll('filter')) {
    try {
      // every facet has sidebar UI now, price slider included
      filters.push(JSON.parse(value) as ProductFilter);
    } catch {
      // ignore malformed filter params
    }
  }
  return filters;
}

/**
 * How many products the collection actually holds, straight from Shopify.
 *
 * The Storefront API exposes no count on a collection's product connection —
 * but every facet it returns is counted, and the Availability facet covers
 * the whole set by definition: in stock plus out of stock IS the collection.
 * Verified against a full cursor walk of the live catalogue: pendants sums to
 * 1497 and walks to 1497, rings 1594, earrings 715, chains 353.
 *
 * It costs nothing — the filters come back with the first page of products,
 * in the query the page already makes — and it tracks the ACTIVE filters,
 * because Shopify counts facets against the current filtered context. So
 * "1497 pieces" becomes "23 pieces" the moment a facet narrows it.
 *
 * `undefined` when the facet is absent (a collection with no products, or a
 * shop with availability filtering switched off), which the caller shows as
 * no total rather than as zero.
 */
export function collectionProductCount(
  filters: Array<{id: string; values: Array<{count: number}>}> | undefined,
): number | undefined {
  const availability = filters?.find((filter) =>
    filter.id.endsWith('availability'),
  );
  if (!availability?.values?.length) return undefined;
  return availability.values.reduce(
    (total, value) => total + (Number(value.count) || 0),
    0,
  );
}
