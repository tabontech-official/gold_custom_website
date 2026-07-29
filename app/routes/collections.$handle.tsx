import {
  redirect,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router';
import type {Route} from './+types/collections.$handle';
import type {HeaderQuery} from 'storefrontapi.generated';
import {
  getPaginationVariables,
  Analytics,
  Pagination,
  getSeoMeta,
} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {
  SITE,
  absoluteUrl,
  breadcrumbJsonLd,
  metaDescription,
  rootDataFrom,
  siteOrigin,
} from '~/lib/seo';
import {ProductItem} from '~/components/ProductItem';
import {Breadcrumb} from '~/components/Breadcrumb';
import {CollectionSubNavIcons} from '~/components/CollectionSubNavIcons';
import {CollectionFilterSidebar} from '~/components/CollectionFilterSidebar';
import {getFiltersFromParam, getSortFromParam} from '~/lib/collectionFilter';
import {
  MEGA_MENU,
  MERGED_CUBAN_HANDLES,
  MIAMI_CUBAN_HANDLE,
  getColumnItems,
  getMegaMenuDepartmentForHandle,
  getNavCollectionHandles,
  toRelativeUrl,
} from '~/lib/megaMenu';
import type {RootLoader} from '~/root';
import {FaqAccordion} from '~/components/FaqAccordion';
import {parseFaqMetaobject} from '~/lib/faqs';

type CollectionCoverPhoto = {
  image: string;
  alt?: string | null;
  align: 'left' | 'right';
};

type CoverPhotoField = {
  key?: string | null;
  value?: string | null;
  reference?: {
    url?: string | null;
    image?: {
      url?: string | null;
      altText?: string | null;
    } | null;
  } | null;
  references?: {
    nodes?: Array<{
      url?: string | null;
      image?: {
        url?: string | null;
        altText?: string | null;
      } | null;
    }>;
  } | null;
};

function displayTitle(collection?: {handle: string; title: string} | null) {
  if (!collection) return '';
  return collection.handle === 'all' ? 'All Products' : collection.title;
}

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

function CollectionProductBreak({item}: {item: CollectionCoverPhoto}) {
  return (
    <div
      className={`collection-product-break is-${item.align}`}
      style={{backgroundImage: `url("${item.image}")`}}
      role="img"
      aria-label={item.alt || 'Collection cover photo'}
    />
  );
}

export const meta: Route.MetaFunction = ({data, matches}) => {
  const collection = data?.collection;
  const origin = siteOrigin(rootDataFrom(matches));
  const title = displayTitle(collection);

  if (!collection) {
    return getSeoMeta({title, titleTemplate: `%s | ${SITE.name}`}) ?? [];
  }

  return (
    getSeoMeta({
      title: collection.seo?.title || title,
      titleTemplate: `%s | ${SITE.name}`,
      description: metaDescription(
        collection.seo?.description || collection.description,
      ),
      url: absoluteUrl(origin, `/collections/${collection.handle}`),
      media: collection.image?.url
        ? {type: 'image', url: collection.image.url}
        : undefined,
      jsonLd: breadcrumbJsonLd(origin, [
        {name: 'Home', path: '/'},
        {name: title, path: `/collections/${collection.handle}`},
      ]),
    }) ?? []
  );
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
  // Only show in-stock products in category listings
  const filters = [{available: true}, ...getFiltersFromParam(url.searchParams)];
  const sort = getSortFromParam(url.searchParams.get('sort'));

  if (!handle) {
    throw redirect('/collections');
  }

  // Folded into the single Miami Cuban Chains category — see megaMenu.
  if (MERGED_CUBAN_HANDLES.includes(handle)) {
    throw redirect(`/collections/${MIAMI_CUBAN_HANDLE}`, 301);
  }

  const [{collection}, allCollections] = await Promise.all([
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
    // Backs the sidebar's category list. Cached and non-fatal: the page still
    // renders if it fails.
    storefront
      .query(SIDEBAR_COLLECTIONS_QUERY, {cache: storefront.CacheLong()})
      .then((data) => data.collections.nodes)
      .catch(() => []),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {
    collection,
    allCollections,
    // These metaobjects are assigned in Shopify on each individual collection.
    // Never search or fall back to general site-wide FAQ/cover data here.
    coverPhotos: getCoverPhotos(
      {
        metaobjects: {
          nodes: collection.collectionCenterImages?.reference
            ? [collection.collectionCenterImages.reference]
            : [],
        },
      },
      handle,
      false,
    ),
    faqs: parseFaqMetaobject(collection.collectionFaqs?.reference),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

function getCoverPhotos(
  response: any,
  collectionHandle: string,
  requireSectionMatch = true,
): CollectionCoverPhoto[] {
  const nodes = response?.metaobjects?.nodes as any[] | undefined;
  if (!Array.isArray(nodes)) return [];
  const normalizedHandle = collectionHandle.toLowerCase();
  const seenImages = new Set<string>();
  const photos: CollectionCoverPhoto[] = [];

  nodes.forEach((rawNode) => {
    const node = rawNode as any;
    const nodeHandle = String(node?.handle ?? '').toLowerCase();
    const metaobject = node as {fields?: CoverPhotoField[]};
    const fields: CoverPhotoField[] = Array.isArray(metaobject.fields)
      ? metaobject.fields
      : [];
    const belongsToCollection =
      nodeHandle === normalizedHandle ||
      nodeHandle.startsWith(`${normalizedHandle}-`) ||
      nodeHandle.endsWith(`-${normalizedHandle}`) ||
      fields.some((field) => {
        const key = String(field?.key ?? '')
          .toLowerCase()
          .replace(/[_\s]+/g, '-');
        const value = String(field?.value ?? '')
          .toLowerCase()
          .replace(/[_\s]+/g, '-');
        return (
          [
            'section',
            'section-handle',
            'collection',
            'collection-handle',
            'category',
            'category-handle',
            'handle',
          ].includes(key) && value === normalizedHandle
        );
      });
    if (requireSectionMatch && !belongsToCollection) return;
    const altField = fields.find((field) => {
      const key = String(field?.key ?? '').toLowerCase();
      return key === 'alt' || key === 'alt_text' || key === 'title';
    });

    fields.forEach((field) => {
      const key = String(field?.key ?? '').toLowerCase();
      const isPhotoField =
        key.includes('image') || key.includes('photo') || key.includes('cover');
      const candidates = [
        {
          image: field.reference?.image?.url ?? field.reference?.url ?? null,
          alt: field.reference?.image?.altText ?? altField?.value ?? null,
        },
        ...(field.references?.nodes ?? []).map((reference) => ({
          image: reference.image?.url ?? reference.url ?? null,
          alt: reference.image?.altText ?? altField?.value ?? null,
        })),
        {
          image:
            field.value &&
            (isPhotoField ||
              /\.(avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(field.value)) &&
            /^https?:\/\//i.test(field.value)
              ? field.value
              : null,
          alt: altField?.value ?? null,
        },
      ];

      candidates.forEach((candidate) => {
        if (!candidate.image || seenImages.has(candidate.image)) return;
        seenImages.add(candidate.image);
        photos.push({
          image: candidate.image,
          alt: candidate.alt,
          align: photos.length % 2 === 0 ? 'left' : 'right',
        });
      });
    });
  });

  return photos;
}

export default function Collection() {
  const {collection, allCollections, coverPhotos, faqs} =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const isListView = searchParams.get('view') === 'list';
  const rootData = useRouteLoaderData<RootLoader>('root');
  const parentCrumb = getCollectionParentCrumb({
    handle: collection.handle,
    header: rootData?.header,
    publicStoreDomain: rootData?.publicStoreDomain,
  });
  const productCollectionContext = {
    categoryLabel: parentCrumb?.label ?? collection.title,
    categoryHandle:
      parentCrumb?.to?.replace('/collections/', '') ?? collection.handle,
    subcategoryLabel: parentCrumb ? collection.title : undefined,
    subcategoryHandle: parentCrumb ? collection.handle : undefined,
  };

  // Only the collections the header nav doesn't already link to — the nav
  // holds the departments, the sidebar holds the rest of the catalog.
  const navHandles =
    rootData?.header && rootData.publicStoreDomain
      ? getNavCollectionHandles(rootData.header, rootData.publicStoreDomain)
      : new Set<string>();
  const categories = allCollections
    .filter(
      (node) =>
        node.products.nodes.length > 0 &&
        !navHandles.has(node.handle) &&
        // Shopify's default "Home page" collection — not a real category.
        node.handle !== 'frontpage',
    )
    .map((node) => ({handle: node.handle, title: node.title}));

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
          <CollectionFilterSidebar categories={categories} filters={filters} />
          <div
            className={`collection-main${isListView ? ' is-list-view' : ''}`}
          >
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
                          <div
                            className="collection-product-row"
                            key={row[0]?.id ?? rowIndex}
                          >
                            <div className="products-grid">
                              {row.map((product, productIndex) => (
                                <ProductItem
                                  key={product.id}
                                  product={product}
                                  collectionContext={productCollectionContext}
                                  loading={
                                    rowIndex === 0 && productIndex < 8
                                      ? 'eager'
                                      : 'lazy'
                                  }
                                />
                              ))}
                            </div>

                            {rowIndex < productRows.length - 1 &&
                              rowIndex < coverPhotos.length && (
                                <CollectionProductBreak
                                  item={coverPhotos[rowIndex]}
                                />
                              )}
                          </div>
                        ))}
                      </>
                    )}

                    {isLoading && (
                      <div
                        className="products-grid collection-load-more-skeleton"
                        aria-label="Loading more products"
                      >
                        {Array.from({length: 4}).map((_, index) => (
                          <article
                            className="product-item product-skeleton"
                            key={index}
                          >
                            <div className="product-image-skeleton" />
                            <div className="product-card-body">
                              <div className="product-text-skeleton is-title" />
                              <div className="product-text-skeleton is-price" />
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    <div className="load-more-bar">
                      <span className="load-more-count">
                        {nodes.length} pieces shown
                      </span>
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

      <FaqAccordion faqs={faqs} />

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
// Sidebar category list: every published collection, alphabetical. `products`
// is only there to drop the empty tag-collections (same check as
// collections._index) so the sidebar never links to a blank page.
const SIDEBAR_COLLECTIONS_QUERY = `#graphql
  query SidebarCollections($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 250, sortKey: TITLE) {
      nodes {
        handle
        title
        products(first: 1) {
          nodes {
            id
          }
        }
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
      # Merchant-authored SEO overrides from the Shopify admin; these win over
      # the raw title/description in the page's meta tags.
      seo {
        title
        description
      }
      image {
        url
        altText
      }
      collectionFaqs: metafield(namespace: "custom", key: "collections_faqs") {
        reference {
          ... on Metaobject {
            handle
            fields {
              key
              value
            }
          }
        }
      }
      collectionCenterImages: metafield(namespace: "custom", key: "collection_center_images") {
        reference {
          ... on Metaobject {
            handle
            fields {
              key
              value
              reference {
                ... on MediaImage {
                  image {
                    url
                    altText
                  }
                }
                ... on GenericFile {
                  url
                }
              }
              references(first: 20) {
                nodes {
                  ... on MediaImage {
                    image {
                      url
                      altText
                    }
                  }
                  ... on GenericFile {
                    url
                  }
                }
              }
            }
          }
        }
      }
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
