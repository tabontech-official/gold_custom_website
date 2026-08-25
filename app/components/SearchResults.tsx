import {Link} from 'react-router';
import {urlWithTrackingParams, type RegularSearchReturn} from '~/lib/search';
import {ProductItem} from '~/components/ProductItem';

type SearchItems = RegularSearchReturn['result']['items'];
type PartialSearchResult<ItemType extends keyof SearchItems> = Pick<
  SearchItems,
  ItemType
> &
  Pick<RegularSearchReturn, 'term'>;

type SearchResultsProps = RegularSearchReturn & {
  children: (args: SearchItems & {term: string}) => React.ReactNode;
};

export function SearchResults({
  term,
  result,
  children,
}: Omit<SearchResultsProps, 'error' | 'type'>) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

function SearchResultsPages({term, pages}: PartialSearchResult<'pages'>) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result-section">
      <h2 className="search-result-heading">Pages</h2>
      <ul className="search-result-list">
        {pages.nodes.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <li key={page.id}>
              <Link prefetch="intent" to={pageUrl}>
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SearchResultsProducts({
  term,
  products,
}: PartialSearchResult<'products'>) {
  if (!products?.nodes.length) {
    return null;
  }

  // No <Pagination>/"Load more": the loader fetches every matching product in
  // one request (see the note on SEARCH_QUERY), so what's here IS the
  // complete result — there's nothing more to load.
  return (
    <div className="search-result-section">
      <div className="products-grid">
        {products.nodes.map((product, index) => (
          <ProductItem
            key={product.id}
            product={product}
            loading={index < 8 ? 'eager' : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function SearchResultsEmpty() {
  return (
    <div className="search-page-empty">
      <p>No results found. Try a different search term.</p>
    </div>
  );
}
