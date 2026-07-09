import type {
  ProductFilter,
  ProductCollectionSortKeys,
} from '@shopify/hydrogen/storefront-api-types';

export type SortOption = {
  label: string;
  value: string;
  sortKey: ProductCollectionSortKeys;
  reverse: boolean;
};

export const SORT_OPTIONS: SortOption[] = [
  {label: 'Featured', value: 'featured', sortKey: 'COLLECTION_DEFAULT', reverse: false},
  {label: 'Best Selling', value: 'best-selling', sortKey: 'BEST_SELLING', reverse: false},
  {label: 'Newest', value: 'newest', sortKey: 'CREATED', reverse: true},
  {label: 'Price: Low to High', value: 'price-asc', sortKey: 'PRICE', reverse: false},
  {label: 'Price: High to Low', value: 'price-desc', sortKey: 'PRICE', reverse: true},
];

export function getSortFromParam(sort?: string | null): SortOption {
  return SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
}

/** Every active facet is stored as a JSON-encoded `filter` search param. */
export function getFiltersFromParam(searchParams: URLSearchParams): ProductFilter[] {
  const filters: ProductFilter[] = [];
  for (const value of searchParams.getAll('filter')) {
    try {
      const filter = JSON.parse(value) as ProductFilter;
      if (
        filter &&
        typeof filter === 'object' &&
        ('price' in filter || 'available' in filter)
      ) {
        continue;
      }
      filters.push(filter);
    } catch {
      // ignore malformed filter params
    }
  }
  return filters;
}
