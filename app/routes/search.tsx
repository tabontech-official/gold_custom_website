import {Link, redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/search';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {SearchResults} from '~/components/SearchResults';
import {Breadcrumb} from '~/components/Breadcrumb';
import {
  type RegularSearchReturn,
  type PredictiveSearchReturn,
  getEmptyPredictiveSearchResult,
  mostRelatedCollection,
  productsMatchingTerm,
} from '~/lib/search';
import type {RegularSearchQuery} from 'storefrontapi.generated';
import {SITE, pageSeo} from '~/lib/seo';
import {tagFromSearchTerm} from '~/lib/browseTags';
import {CollectionFilterSidebar} from '~/components/CollectionFilterSidebar';
import {
  SEARCH_SORT_OPTIONS,
  getFiltersFromParam,
  getSearchSortFromParam,
} from '~/lib/collectionFilter';
import {CacheCatalog} from '~/lib/cache';

// Result pages are thin/duplicative and would burn crawl budget across every
// query permutation, so the route is noindex — but still followable so
// crawlers can reach the products it links to.
export const meta: Route.MetaFunction = () =>
  pageSeo({
    title: 'Search',
    description: `Search ${SITE.name} for gold chains, rings, bracelets, pendants and charms.`,
    noIndex: true,
  });

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const isPredictive = url.searchParams.has('predictive');

  // A term that names a category outright is answered by the category itself.
  // Searching "women diamond ring" means the 23 pieces in `womens-diamond-ring`,
  // and Shopify's OR-matching cannot produce that set — it returns a thousand
  // things that are a ring OR a diamond. The collection page already has the
  // filters, sort and pagination this one would otherwise have to reimplement,
  // so hand over to it. `filter`/`sort` params use the same vocabulary on both
  // routes (see collectionFilter.ts), so they survive the hop.
  if (!isPredictive) {
    const term = String(url.searchParams.get('q') || '').trim();
    const tag = tagFromSearchTerm(term);
    if (term && !tag) {
      const {collections} = await context.storefront.query(
        COLLECTION_INDEX_QUERY,
        {cache: context.storefront.CacheLong()},
      );
      const match = mostRelatedCollection(term, collections?.nodes ?? []);
      if (match?.exact) {
        const params = new URLSearchParams(url.searchParams);
        params.delete('q');
        const query = params.toString();
        return redirect(
          `/collections/${match.collection.handle}${query ? `?${query}` : ''}`,
        );
      }
    }
  }

  const searchPromise: Promise<PredictiveSearchReturn | RegularSearchReturn> =
    isPredictive
      ? predictiveSearch({request, context})
      : regularSearch({request, context});

  searchPromise.catch((error: Error) => {
    console.error(error);
    return {term: '', result: null, error: error.message};
  });

  return await searchPromise;
}

/**
 * Renders the /search route
 */
export default function SearchPage() {
  const {type, term, result, error} = useLoaderData<typeof loader>();
  if (type === 'predictive') return null;

  const hasResults = Boolean(term) && Boolean(result?.total);

  // `input` is typed as a JSON scalar but is a JSON string at runtime — same
  // normalisation the collection route does before handing facets to the rail.
  const filters = (result?.items?.products?.productFilters ?? []).map(
    (filter) => ({
      id: filter.id,
      label: filter.label,
      type: filter.type,
      values: filter.values.map((value) => ({
        id: value.id,
        label: value.label,
        count: value.count,
        input: String(value.input),
      })),
    }),
  );

  // Non-null only when the visitor arrived from a tag link in the collection
  // sidebar, which encodes the tag as `tag:"…"` in `q`.
  const browsedTag = tagFromSearchTerm(term);

  const results = !hasResults ? (
    <SearchResults.Empty />
  ) : (
    <SearchResults result={result} term={term}>
      {({pages, products, term}) => (
        <div className="search-page-sections">
          <SearchResults.Products products={products} term={term} />
          <SearchResults.Pages pages={pages} term={term} />
        </div>
      )}
    </SearchResults>
  );

  return (
    <div className="search-page">
      <div className="section-inner">
        <Breadcrumb
          items={
            browsedTag
              ? [
                  {label: 'Home', to: '/'},
                  {label: 'Search', to: '/search'},
                  {label: browsedTag},
                ]
              : [{label: 'Home', to: '/'}, {label: 'Search'}]
          }
        />
        {/*
          Tag links from the collection sidebar carry a `tag:"…"` term. Showing
          that verbatim put raw query syntax in front of the shopper, so a tag
          search gets named after the tag instead — and the tag becomes the h1,
          because on those visits it, not the word "Search", is what the page
          is about.
        */}
        {/* Same title row the collection pages use — search shares their filter
            rail and grid, so it should share their masthead too. */}
        <div className="collection-title-row">
          <h1>{browsedTag ?? 'Search'}</h1>
        </div>
        {browsedTag ? (
          <p className="search-page-summary">
            {result?.total
              ? `Every ${browsedTag.toLowerCase()} piece we carry.`
              : `Nothing tagged ${browsedTag} right now.`}{' '}
            <Link to="/collections/shop-all">Shop all →</Link>
          </p>
        ) : (
          term && (
            <p className="search-page-summary">
              {result?.total
                ? `Results for "${term}"`
                : `No results for "${term}"`}
            </p>
          )
        )}

        {error && <p className="search-page-error">{error}</p>}
      </div>

      {term ? (
        // Same rail + grid the category pages use. Rendered whenever there is
        // a term, including when a filter narrows the results to nothing —
        // otherwise the only control that could undo that filter disappears
        // with the products.
        <section className="home-section">
          <div className="section-inner collection-layout">
            <CollectionFilterSidebar
              filters={filters}
              sortOptions={SEARCH_SORT_OPTIONS}
              showCounts={false}
              showAppliedChips={false}
            />
            <div className="collection-main">{results}</div>
          </div>
        </section>
      ) : (
        <div className="section-inner">{results}</div>
      )}

      <Analytics.SearchView data={{searchTerm: term, searchResults: result}} />
    </div>
  );
}

/**
 * Regular search query and fragments
 * (adjust as needed)
 */
const SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment SearchProduct on Product {
    __typename
    handle
    id
    # Resolve each result's canonical /collections/<category>/products/<handle>
    # link. Without them the card falls back to the flat path, which 301s.
    productType
    category {
      name
    }
    publishedAt
    title
    trackingParameters
    vendor
    featuredImage {
      id
      url
      altText
      width
      height
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
      selectedOptions {
        name
        value
      }
      product {
        handle
        title
      }
    }
  }
` as const;

const SEARCH_PAGE_FRAGMENT = `#graphql
  fragment SearchPage on Page {
     __typename
     handle
    id
    title
    trackingParameters
  }
` as const;

const PAGE_INFO_FRAGMENT = `#graphql
  fragment PageInfoFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/search
export const SEARCH_QUERY = `#graphql
  query RegularSearch(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $term: String!
    $startCursor: String
    $productFilters: [ProductFilter!]
    $sortKey: SearchSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    pages: search(
      query: $term,
      types: [PAGE],
      first: $first,
    ) {
      nodes {
        ...on Page {
          ...SearchPage
        }
      }
    }
    products: search(
      after: $endCursor,
      before: $startCursor,
      first: $first,
      last: $last,
      query: $term,
      sortKey: $sortKey,
      reverse: $reverse,
      productFilters: $productFilters,
      types: [PRODUCT],
      unavailableProducts: HIDE,
    ) {
      nodes {
        ...on Product {
          ...SearchProduct
        }
      }
      # The facets available for THIS result set, so the rail offers only
      # filters that can actually narrow the current search.
      productFilters {
        id
        label
        type
        values {
          id
          label
          count
          input
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
    }
  }
  ${SEARCH_PRODUCT_FRAGMENT}
  ${SEARCH_PAGE_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
` as const;

/**
 * Regular search fetcher
 */
async function regularSearch({
  request,
  context,
}: Pick<
  Route.LoaderArgs,
  'request' | 'context'
>): Promise<RegularSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  // Fetched per page, before filtering. Shopify ORs the query words together,
  // so a page of 8 could arrive as 2 once the loose matches are dropped — the
  // page has to be big enough that a filtered one still fills the grid.
  const variables = getPaginationVariables(request, {pageBy: 48});
  const term = String(url.searchParams.get('q') || '');
  // Same `filter` and `sort` params the collection rail writes, so the sidebar
  // component works here unchanged. No `{available: true}` filter is added —
  // `unavailableProducts: HIDE` on the query already does that job.
  const productFilters = getFiltersFromParam(url.searchParams);
  const sort = getSearchSortFromParam(url.searchParams.get('sort'));

  // Search pages and products for the `q` term — blog articles are deliberately
  // not searched here; someone searching the shop is looking for things to buy.
  const {
    errors,
    ...items
  }: {errors?: Array<{message: string}>} & RegularSearchQuery =
    await storefront.query(SEARCH_QUERY, {
      cache: CacheCatalog(),
      variables: {
        ...variables,
        term,
        productFilters,
        sortKey: sort.sortKey,
        reverse: sort.reverse,
      },
    });

  if (!items) {
    throw new Error('No search data returned from Shopify API');
  }

  // Same relevance rule the dropdown uses: every word of the term has to be in
  // the title or product type. Without it "18 inch chain" returns 629 results of
  // which four in the first forty are actually 18 inches long. `pageInfo` is
  // left untouched so "load more" still walks Shopify's cursors.
  const filtered = {
    ...items,
    products: {
      ...items.products,
      nodes: productsMatchingTerm(term, items.products.nodes),
    },
  };

  const total = Object.values(filtered).reduce(
    (acc: number, {nodes}: {nodes: Array<unknown>}) => acc + nodes.length,
    0,
  );

  const error = errors
    ? errors.map(({message}: {message: string}) => message).join(', ')
    : undefined;

  return {type: 'regular', term, error, result: {total, items: filtered}};
}

/**
 * Predictive search query and fragments
 * (adjust as needed)
 */
const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    # Resolve each suggestion's canonical
    # /collections/<category>/products/<handle> link, so picking one out of the
    # dropdown doesn't cost a redirect.
    productType
    category {
      name
    }
    trackingParameters
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
    }
  }
` as const;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    styledText
    trackingParameters
  }
` as const;

// Every collection, so a search term is scored against the whole catalogue
// rather than the ten guesses predictiveSearch happens to return. Titles and
// handles change a few times a year, so this is cached hard and shared by every
// keystroke of every shopper.
const COLLECTION_INDEX_QUERY = `#graphql
  query CollectionIndex($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 250) {
      nodes {
        id
        title
        handle
        image {
          url
          altText
          width
          height
        }
        # Existence check, not a listing — a suggestion that opens onto "no
        # products" is worse than no suggestion.
        products(first: 1) {
          nodes {
            id
          }
        }
      }
    }
  }
` as const;

// A matched collection's products, which ARE the answer when the term names a
// category: "women diamond ring" means the 23 in `womens-diamond-ring`, not the
// 100 loosely-related rings Shopify's OR-matching returns for those words.
const COLLECTION_PRODUCTS_QUERY = `#graphql
  query CollectionSearchProducts(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
    $productCount: Int!
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      products(first: $productCount) {
        nodes {
          ...PredictiveProduct
        }
      }
    }
  }
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
` as const;

// Ceiling, not a target. A matched collection returns exactly what it holds —
// 23 for `womens-diamond-ring` — and only the unmatched fallback ever fills this.
const MAX_DROPDOWN_PRODUCTS = 100;

// The fallback pool searched before filtering. Shopify's OR-matching means the
// genuine hits are scattered through the results rather than sitting at the top
// ("18 inch chain": 4 real matches in the first 40, 60 in the first 250), so the
// net has to be cast wider than the number we intend to show.
const FALLBACK_SEARCH_POOL = 250;

/**
 * "ova" → "ova*", so the word still being typed matches as a prefix.
 *
 * Only the last word: wildcarding the rest widens the OR-matching this code
 * spends its time undoing.
 */
function withTrailingWildcard(term: string) {
  const words = term.trim().split(/\s+/);
  if (!words[0]) return term;
  return [...words.slice(0, -1), `${words[words.length - 1]}*`].join(' ');
}

// Fallback for terms that name no category. Products come from the REGULAR
// search connection, not `predictiveSearch`, which caps `limit` at 10 per type —
// the API rejects anything higher, so it can never answer "show me what matches".
const QUICK_SEARCH_QUERY = `#graphql
  query QuickSearch(
    $country: CountryCode
    $language: LanguageCode
    $term: String!
    $partialTerm: String!
    $productCount: Int!
  ) @inContext(country: $country, language: $language) {
    products: search(
      query: $term,
      types: [PRODUCT],
      first: $productCount,
      unavailableProducts: LAST,
    ) {
      totalCount
      nodes {
        ...on Product {
          ...PredictiveProduct
        }
      }
    }
    # Same search with the in-progress word wildcarded. Shopify matches whole
    # tokens, so a shopper on their way to "oval" gets exactly zero results for
    # "ova" — this alias is what keeps the list alive mid-word.
    partial: search(
      query: $partialTerm,
      types: [PRODUCT],
      first: $productCount,
      unavailableProducts: LAST,
    ) {
      nodes {
        ...on Product {
          ...PredictiveProduct
        }
      }
    }
    predictiveSearch(
      limit: 10,
      limitScope: EACH,
      query: $term,
      types: [QUERY],
    ) {
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
` as const;

/**
 * Predictive search fetcher
 */
async function predictiveSearch({
  request,
  context,
}: Pick<
  Route.ActionArgs,
  'request' | 'context'
>): Promise<PredictiveSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '').trim();
  const type = 'predictive';

  if (!term) return {type, term, result: getEmptyPredictiveSearchResult()};

  const {collections} = await storefront.query(COLLECTION_INDEX_QUERY, {
    cache: storefront.CacheLong(),
  });

  const match = mostRelatedCollection(term, collections?.nodes ?? []);

  // When the term names a category, that category IS the result set — precise,
  // and as long as it actually is. Shopify's search ORs the words together, so
  // "women diamond ring" comes back as 1000 things that are merely a ring OR a
  // diamond; filtering that afterwards can't recover the answer either, because
  // "women" is a tag on virtually every ring. Only the collection knows.
  if (match?.exact) {
    const {collection} = await storefront.query(COLLECTION_PRODUCTS_QUERY, {
      cache: CacheCatalog(),
      variables: {
        handle: match.collection.handle,
        productCount: MAX_DROPDOWN_PRODUCTS,
      },
    });
    const products = collection?.products.nodes ?? [];
    if (products.length) {
      return {
        type,
        term,
        result: {
          total: products.length + 1,
          totalCount: products.length,
          collection: match.collection,
          items: {products, queries: []},
        },
      };
    }
  }

  // No category matched — fall back to relevance-ordered search.
  const {
    products,
    partial,
    predictiveSearch: suggestions,
    errors,
  } = await storefront.query(QUICK_SEARCH_QUERY, {
    cache: CacheCatalog(),
    variables: {
      term,
      partialTerm: withTrailingWildcard(term),
      productCount: FALLBACK_SEARCH_POOL,
    },
  });

  if (errors) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}: {message: string}) => message).join(', ')}`,
    );
  }

  if (!products) {
    throw new Error('No search data returned from Shopify API');
  }

  // Whole-word hits first — they rank better — then anything only the
  // wildcarded pass found, deduped.
  const seen = new Set(products.nodes.map((product) => product.id));
  const pool = [
    ...products.nodes,
    ...(partial?.nodes ?? []).filter((product) => !seen.has(product.id)),
  ];
  const matching = productsMatchingTerm(term, pool).slice(
    0,
    MAX_DROPDOWN_PRODUCTS,
  );

  return {
    type,
    term,
    result: {
      total: matching.length + (match ? 1 : 0),
      totalCount: matching.length,
      collection: match?.collection ?? null,
      items: {products: matching, queries: suggestions?.queries ?? []},
    },
  };
}
