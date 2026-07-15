import {redirect, useLoaderData, useRouteLoaderData} from 'react-router';
import type {Route} from './+types/collections.$handle';
import type {HeaderQuery} from 'storefrontapi.generated';
import {getPaginationVariables, Analytics, Pagination} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import {Breadcrumb} from '~/components/Breadcrumb';
import {CollectionSubNavIcons} from '~/components/CollectionSubNavIcons';
import {CollectionFilterSidebar} from '~/components/CollectionFilterSidebar';
import {AutoLoadMore} from '~/components/AutoLoadMore';
import {getFiltersFromParam, getSortFromParam} from '~/lib/collectionFilter';
import {
  MEGA_MENU,
  getColumnItems,
  getMegaMenuDepartmentForHandle,
  toRelativeUrl,
} from '~/lib/megaMenu';
import type {RootLoader} from '~/root';

function displayTitle(collection?: {handle: string; title: string} | null) {
  if (!collection) return '';
  return collection.handle === 'all' ? 'All Products' : collection.title;
}

const COLLECTION_PRODUCT_BREAKS = [
  {
    image: '/cover3.webp',
    eyebrow: 'Women\'s Diamond Jewelry',
    title: 'Radiant diamonds made to hold the moment.',
    variant: 'cover3',
    align: 'left',
  },
  {
    image: '/cover4.webp',
    eyebrow: 'Men\'s Diamond Studs',
    title: 'Sharp brilliance, built for everyday presence.',
    variant: 'cover4',
    align: 'right',
  },
] as const;

function getCollectionParentCrumb({
  handle,
  header,
  publicStoreDomain,
}: {
  handle: string;
  header?: HeaderQuery;
  publicStoreDomain?: string;
}) {
  if (!header || !publicStoreDomain) return null;

  const directDepartment = getMegaMenuDepartmentForHandle(handle);
  if (directDepartment) return null;

  const currentPath = `/collections/${handle}`;
  const primaryDomainUrl = header.shop.primaryDomain.url;
  const parent = MEGA_MENU.find((department) =>
    department.columns.some((column) =>
      getColumnItems(header, column).some((item) => {
        if (!item.url) return false;
        return (
          toRelativeUrl(item.url, primaryDomainUrl, publicStoreDomain) ===
          currentPath
        );
      }),
    ),
  );

  return parent ? {label: parent.label, to: parent.to} : null;
}

function CollectionProductBreak({
  item,
}: {
  item: (typeof COLLECTION_PRODUCT_BREAKS)[number];
}) {
  return (
    <div
      className={`collection-product-break is-${item.align} is-${item.variant}`}
      style={{backgroundImage: `url("${item.image}")`}}
    >
      <div className="collection-product-break-copy">
        <span>{item.eyebrow}</span>
        <h3>{item.title}</h3>
      </div>
    </div>
  );
}

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `${displayTitle(data?.collection)} | Gold Jewelry Co.`}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 24,
  });
  const url = new URL(request.url);
  const filters = getFiltersFromParam(url.searchParams);
  const sort = getSortFromParam(url.searchParams.get('sort'));

  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        filters,
        sortKey: sort.sortKey,
        reverse: sort.reverse,
        ...paginationVariables,
      },
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {collection};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Collection() {
  const {collection} = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData<RootLoader>('root');
  const parentCrumb = getCollectionParentCrumb({
    handle: collection.handle,
    header: rootData?.header,
    publicStoreDomain: rootData?.publicStoreDomain,
  });

  // The API types `input` as a JSON scalar; it's a JSON string at runtime.
  const filters = (collection.products.filters ?? []).map((filter) => ({
    id: filter.id,
    label: filter.label,
    type: filter.type,
    values: filter.values.map((value) => ({
      id: value.id,
      label: value.label,
      count: value.count,
      input: String(value.input),
    })),
  }));

  return (
    <div className="collection">
      <div className="section-inner">
        <Breadcrumb
          items={[
            {label: 'Home', to: '/'},
            {label: 'Shop', to: '/collections/all'},
            parentCrumb,
            {label: collection.title},
          ]}
        />
        <div className="collection-title-row">
          <h1>{displayTitle(collection)}</h1>
        </div>
      </div>

      {rootData?.header && (
        <div className="section-inner">
          <CollectionSubNavIcons
            handle={collection.handle}
            header={rootData.header}
            publicStoreDomain={rootData.publicStoreDomain}
          />
        </div>
      )}

      <section className="home-section">
        <div className="section-inner collection-layout">
          <CollectionFilterSidebar filters={filters} />
          <div className="collection-main">
          <Pagination connection={collection.products}>
            {({
              nodes,
              isLoading,
              PreviousLink,
              NextLink,
              hasNextPage,
              hasPreviousPage,
            }) => {
              const productRows = [];
              for (let index = 0; index < nodes.length; index += 8) {
                productRows.push(nodes.slice(index, index + 8));
              }

              return (
                <div className="load-more">
                  {hasPreviousPage && (
                    <div className="load-more-bar">
                      <PreviousLink className="load-more-btn is-ghost">
                        {isLoading ? 'Loading…' : '↑ Load previous'}
                      </PreviousLink>
                    </div>
                  )}

                  {nodes.length === 0 ? (
                    <p className="collection-empty">
                      No pieces match these filters. Try clearing a filter.
                    </p>
                  ) : (
                    <>
                      {productRows.map((row, rowIndex) => (
                        <div className="collection-product-row" key={row[0]?.id ?? rowIndex}>
                          <div className="products-grid">
                            {row.map((product, productIndex) => (
                              <ProductItem
                                key={product.id}
                                product={product}
                                loading={
                                  rowIndex === 0 && productIndex < 8
                                    ? 'eager'
                                    : 'lazy'
                                }
                              />
                            ))}
                          </div>

                          {rowIndex < productRows.length - 1 &&
                            rowIndex < COLLECTION_PRODUCT_BREAKS.length && (
                            <CollectionProductBreak
                              item={
                                COLLECTION_PRODUCT_BREAKS[rowIndex]
                              }
                            />
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  <div className="load-more-bar">
                    <span className="load-more-count">
                      {nodes.length} pieces shown
                    </span>
                    <AutoLoadMore
                      hasNextPage={hasNextPage}
                      isLoading={isLoading}
                    />
                    {hasNextPage ? (
                      <NextLink className="load-more-btn">
                        {isLoading ? 'Loading…' : 'Load More'}
                      </NextLink>
                    ) : (
                      nodes.length > 0 && (
                        <span className="load-more-end">
                          That&rsquo;s the whole collection
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            }}
          </Pagination>
          </div>
        </div>
      </section>

      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filters,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        filters {
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
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
      bestSelling: products(first: 8, sortKey: BEST_SELLING) {
        nodes {
          ...ProductItem
        }
      }
    }
  }
` as const;
