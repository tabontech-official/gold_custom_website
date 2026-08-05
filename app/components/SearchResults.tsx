import {Link} from 'react-router';
import {Pagination} from '@shopify/hydrogen';
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

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

function SearchResultsArticles({
  term,
  articles,
}: PartialSearchResult<'articles'>) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result-section">
      <h2 className="search-result-heading">Articles</h2>
      <ul className="search-result-list">
        {articles.nodes.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <li key={article.id}>
              <Link prefetch="intent" to={articleUrl}>
                {article.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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

  return (
    <div className="search-result-section">
      <h2 className="search-result-heading">Products</h2>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink, hasNextPage}) => (
          <div>
            <div className="load-more">
              <PreviousLink className="load-more-btn is-ghost">
                {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
              </PreviousLink>
            </div>
            <div className="products-grid">
              {nodes.map((product, index) => (
                <ProductItem
                  key={product.id}
                  product={product}
                  loading={index < 8 ? 'eager' : undefined}
                />
              ))}
            </div>
            <div className="load-more-bar">
              <NextLink className="load-more-btn">
                {isLoading ? 'Loading...' : <span>Load more ↓</span>}
              </NextLink>
            </div>
          </div>
        )}
      </Pagination>
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
