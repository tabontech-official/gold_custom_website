import {
  redirect,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router';
import type {Route} from './+types/collections.$handle';
import type {HeaderQuery} from 'storefrontapi.generated';
import {getPaginationVariables, Analytics, Pagination} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {productCanonicalPath} from '~/lib/categories';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  metaDescription,
  pageSeo,
  rootDataFrom,
  siteOrigin,
} from '~/lib/seo';
import {ProductItem} from '~/components/ProductItem';
import {Breadcrumb} from '~/components/Breadcrumb';
import {CollectionSubNavIcons} from '~/components/CollectionSubNavIcons';
import {CollectionFilterSidebar} from '~/components/CollectionFilterSidebar';
import {getFiltersFromParam, getSortFromParam} from '~/lib/collectionFilter';
import {
  CATEGORY_MENU_HANDLES,
  MEGA_MENU,
  MERGED_CUBAN_HANDLES,
  MIAMI_CUBAN_HANDLE,
  collectionHandlesFromMenu,
  getColumnItems,
  getMegaMenuDepartmentForHandle,
  getMegaMenuParentHandle,
  getNavCollectionHandles,
  toRelativeUrl,
} from '~/lib/megaMenu';
import type {RootLoader} from '~/root';
import {FaqAccordion} from '~/components/FaqAccordion';
import {extractFaqsFromDescription} from '~/lib/description';
import {
  buildFaqJsonLd,
  parseFaqMetaobject,
  parseFaqMetafield,
  type Faq,
} from '~/lib/faqs';

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

/** The FAQs this page renders: metafield first, description block as fallback. */
function collectionFaqs(data: {
  faqs?: Faq[];
  collection?: {descriptionHtml?: string | null} | null;
}): Faq[] {
  if (data?.faqs?.length) return data.faqs;
  return extractFaqsFromDescription(data?.collection?.descriptionHtml).faqs;
}

export const meta: Route.MetaFunction = ({data, matches}) => {
  const collection = data?.collection;
  const origin = siteOrigin(rootDataFrom(matches));
  const title = displayTitle(collection);

  if (!collection) {
    return pageSeo({title});
  }

  return pageSeo({
    title: collection.seo?.title || title,
    description: metaDescription(
      collection.seo?.description || collection.description,
    ),
    url: absoluteUrl(origin, `/collections/${collection.handle}`),
    media: collection.image?.url
      ? {
          type: 'image' as const,
          url: collection.image.url,
          width: collection.image.width,
          height: collection.image.height,
        }
      : undefined,
    jsonLd: [
      breadcrumbJsonLd(origin, [
        {name: 'Home', path: '/'},
        {name: title, path: `/collections/${collection.handle}`},
      ]),
      collectionItemListJsonLd(origin, collection),
      // Resolved exactly as the page does, so the markup describes the
      // accordion a visitor actually sees rather than a second source.
      // Both inputs are merchant-authored Q&A, which is what FAQPage
      // requires — see the warning on buildFaqJsonLd.
      ...(collectionFaqs(data).length
        ? [buildFaqJsonLd(collectionFaqs(data))]
        : []),
    ],
  });
};

/**
 * ItemList naming the products on this page, in the order they are rendered.
 *
 * Without it a category page is just prose to a crawler — the grid is the
 * page's actual content, and nothing in the markup says these thirty links
 * are one ranked set of products. `position` is what makes it a list rather
 * than a bag of URLs.
 *
 * Only the first page of results is described. `Pagination` appends further
 * pages client-side, so the server-rendered meta cannot see them, and
 * inventing entries for products not present in the HTML would contradict the
 * page. Deep pages are reached through the sitemap instead.
 */
function collectionItemListJsonLd(origin: string, collection: any) {
  const nodes: any[] = collection.products?.nodes ?? [];

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${absoluteUrl(origin, `/collections/${collection.handle}`)}#products`,
    name: collection.seo?.title || displayTitle(collection),
    numberOfItems: nodes.length,
    itemListElement: nodes.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      // Must be the canonical /collections/<category>/products/<handle>, not
      // the flat /products/<handle>, which 301s. See the productType/category
      // fields on the ProductItem fragment.
      url: absoluteUrl(origin, productCanonicalPath(product)),
      name: product.title,
    })),
  };
}

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

  // These metaobjects are assigned in Shopify on each individual collection.
  // Never search or fall back to general site-wide FAQ/cover data here; the only
  // permitted fallback is the collection's own parent department (below).
  let coverSource = collection.collectionCenterImages?.reference ?? null;
  let faqs = readFaqMetafield(collection.collectionFaqs);

  // A child category with neither of its own inherits both from its parent, so
  // merchants only fill these in once per department. Both lookups are cached
  // and non-fatal: worst case the child page renders without FAQs/covers.
  if (!coverSource && !faqs.length) {
    // Most departments list their children in a Shopify menu rather than in
    // MEGA_MENU's curated items, so the menus are needed to find the parent.
    const menus = await storefront
      .query(CATEGORY_MENUS_QUERY, {cache: storefront.CacheLong()})
      .catch(() => null);

    const menuItemHandles = menus
      ? Object.fromEntries(
          Object.keys(CATEGORY_MENU_HANDLES).map((key) => [
            key,
            collectionHandlesFromMenu(
              menus[key as keyof typeof CATEGORY_MENU_HANDLES],
            ),
          ]),
        )
      : undefined;

    const parentHandle = getMegaMenuParentHandle(handle, menuItemHandles);
    if (parentHandle) {
      const parent = await storefront
        .query(PARENT_COLLECTION_CONTENT_QUERY, {
          variables: {handle: parentHandle},
          cache: storefront.CacheLong(),
        })
        .then((data) => data.collection)
        .catch(() => null);

      coverSource = parent?.collectionCenterImages?.reference ?? null;
      faqs = readFaqMetafield(parent?.collectionFaqs);
    }
  }

  return {
    collection,
    allCollections,
    coverPhotos: getCoverPhotos(
      {metaobjects: {nodes: coverSource ? [coverSource] : []}},
      handle,
      false,
    ),
    faqs,
  };
}

/**
 * FAQs off the `custom.collections_faqs` metafield. It points at a `pages_faqs`
 * metaobject today, whose `questions_and_answers` field holds the JSON array;
 * reading `value` first means a plain json metafield holding that same array
 * works too, without a second code path to keep in sync. On a metaobject
 * reference `value` is only the gid, so the JSON parse fails and it falls
 * through — no type check needed.
 */
function readFaqMetafield(
  metafield?: {value?: string | null; reference?: unknown} | null,
): Faq[] {
  return (
    parseFaqMetafield(metafield?.value) ??
    parseFaqMetaobject(metafield?.reference ?? null)
  );
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
  // The metafield JSON is the source of truth. Any FAQ block still sitting in
  // a description is stripped out of the prose regardless, so it can never
  // render twice, and is used only where that collection has no metafield yet
  // — 9 collections are still in that state and would otherwise show nothing.
  // Once every collection is migrated, descriptionFaqs is simply always empty.
  const {faqs: descriptionFaqs, rest: descriptionRest} =
    extractFaqsFromDescription(collection.descriptionHtml);
  const rootData = useRouteLoaderData<RootLoader>('root');
  const parentCrumb = getCollectionParentCrumb({
    handle: collection.handle,
    header: rootData?.header,
    publicStoreDomain: rootData?.publicStoreDomain,
  });

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
            {/* The grid sat directly under the collection's h1 with nothing
                between, so the product cards' h3 would jump a level. It also
                names the region: an agent looking for the products on a
                collection page had only an unlabelled <div> to go on. */}
            <h2 className="visually-hidden">Products</h2>
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
                                  collectionHandle={collection.handle}
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

      {descriptionRest && (
        <section
          className="home-section"
          aria-labelledby="collection-description-title"
        >
          <div className="section-inner">
            <div className="editorial-heading">
              <h2 id="collection-description-title" className="editorial-title">
                About {collection.title}
              </h2>
            </div>
            {/* Straight prose, not an accordion: the copy is headings and
                paragraphs meant to be read. `product-description-intro` is
                the existing style for exactly this — merchant rich text at
                body size, with gold list markers and links. */}
            <div
              className="product-description-intro"
              dangerouslySetInnerHTML={{__html: descriptionRest}}
            />
          </div>
        </section>
      )}

      <FaqAccordion faqs={faqs.length ? faqs : descriptionFaqs} />

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
    # Only used to resolve each product's canonical
    # /collections/<category>/products/<handle> path for the ItemList JSON-LD.
    # Without them productCanonicalPath falls back to the flat
    # /products/<handle>, which 301s — and a structured-data list of redirects
    # is worth less than no list at all.
    productType
    category {
      name
    }
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

// The FAQ and cover-image metaobjects, shared by the collection query and the
// parent-department lookup that child pages fall back to.
const COLLECTION_CONTENT_FRAGMENT = `#graphql
  fragment CollectionContent on Collection {
    collectionFaqs: metafield(namespace: "custom", key: "collections_faqs") {
      # Today this is a metaobject reference and value is just the gid. If the
      # metafield is ever retyped to a plain json one holding the array itself,
      # value carries it and the loader reads that instead.
      value
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
  }
` as const;

/**
 * Just the item URLs of every category menu, to find which department a child
 * collection belongs to. Deliberately leaner than HEADER_QUERY (no shop, no
 * per-item resource/products), since only the handles are needed here.
 */
const CATEGORY_MENUS_QUERY = `#graphql
  fragment MenuHandles on Menu {
    items {
      url
    }
  }
  query CategoryMenus($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    chainsGroup1: menu(handle: "chains-copy-copy-1") { ...MenuHandles }
    chainsGroup2: menu(handle: "chains-copy-copy") { ...MenuHandles }
    chainsGroup3: menu(handle: "chains-copy") { ...MenuHandles }
    braceletsMenu: menu(handle: "bracelets-1") { ...MenuHandles }
    earringsMenu: menu(handle: "earrings") { ...MenuHandles }
    pendantsMenu: menu(handle: "pendants") { ...MenuHandles }
    chainWithPendantMenu: menu(handle: "chain-with-pendant") { ...MenuHandles }
    necklacesMenu: menu(handle: "necklaces") { ...MenuHandles }
    diamondMenu: menu(handle: "diamond") { ...MenuHandles }
    engagementRingsMenu: menu(handle: "engagement-rings") { ...MenuHandles }
  }
` as const;

/** Parent department's FAQ/cover content, for child pages that define neither. */
const PARENT_COLLECTION_CONTENT_QUERY = `#graphql
  ${COLLECTION_CONTENT_FRAGMENT}
  query ParentCollectionContent(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      handle
      ...CollectionContent
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  ${COLLECTION_CONTENT_FRAGMENT}
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
      # Rendered on the page below the grid. The flat description above stays
      # for meta tags; this keeps the editor's headings, lists and links so the
      # copy can be laid out properly.
      descriptionHtml
      # Merchant-authored SEO overrides from the Shopify admin; these win over
      # the raw title/description in the page's meta tags.
      seo {
        title
        description
      }
      image {
        url
        altText
        # width/height are for the share card, not the page: pageSeo needs them
        # to tell a usable collection image from one too small to render as a
        # large preview (rings.webp is 400x363) and fall back to the brand shot.
        width
        height
      }
      ...CollectionContent
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
