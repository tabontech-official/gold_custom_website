import {useRef} from 'react';
import {
  Link,
  redirect,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router';
import type {Route} from './+types/collections.$handle';
import type {HeaderQuery} from 'storefrontapi.generated';
import {Analytics} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {productCanonicalPath} from '~/lib/categories';
import {analyticsProduct} from '~/lib/analytics';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  metaDescription,
  pageSeo,
  resolveShareImage,
  rootDataFrom,
  siteOrigin,
} from '~/lib/seo';
import {ProductItem} from '~/components/ProductItem';
import {Breadcrumb} from '~/components/Breadcrumb';
import {ShareButtons} from '~/components/ShareButtons';
import {CollectionStickyHead} from '~/components/CollectionStickyHead';
import {CollectionSubNavIcons} from '~/components/CollectionSubNavIcons';
import {CollectionFilterSidebar} from '~/components/CollectionFilterSidebar';
import {
  collectionProductCount,
  getFiltersFromParam,
  getSortFromParam,
} from '~/lib/collectionFilter';
import {
  CATEGORY_MENU_HANDLES,
  MERGED_CUBAN_HANDLES,
  MIAMI_CUBAN_HANDLE,
  collectionHandlesFromMenu,
  getMegaMenuParentCrumb,
  useDepartmentHint,
  getMegaMenuParentHandle,
  getNavCollectionHandles,
} from '~/lib/megaMenu';
import type {RootLoader} from '~/root';
import {FaqAccordion} from '~/components/FaqAccordion';
import {DescriptionAccordions} from '~/components/DescriptionAccordions';
import {extractFaqsFromDescription} from '~/lib/description';
import {
  buildFaqJsonLd,
  parseFaqMetaobject,
  parseFaqMetafield,
  type Faq,
} from '~/lib/faqs';
import {CacheCatalog, CacheContent, CacheNav} from '~/lib/cache';
import {
  batchSize,
  DEFAULT_COLUMNS,
  ROWS_PER_LOAD,
  useGridColumns,
} from '~/lib/gridColumns';

function displayTitle(collection?: {handle: string; title: string} | null) {
  if (!collection) return '';
  return collection.handle === 'all' ? 'All Products' : collection.title;
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
  const rootData = rootDataFrom(matches);
  const origin = siteOrigin(rootData);
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
    // `data.shareImage`, not `collection.image` — the loader already asked the
    // CDN which size this banner actually survives at, and hands back that
    // exact url. Null means no tier fit (a transparent PNG the CDN will not
    // transcode even at 600px), and pageSeo falls back to the brand logo.
    //
    // `shareImage`, not `media`: it is published verbatim. Routing it through
    // `media` would send it back through socialImage and re-stamp it at the
    // default 1200 tier, undoing the measurement.
    shareImage: data?.shareImage,
    jsonLd: [
      collectionPageJsonLd(origin, collection, title),
      // The SAME department crumb the page renders (see getMegaMenuParentCrumb
      // in the component below). Without it a sub-category's markup claimed
      // Home / Religious Pendants while the visible trail read Home / Pendants
      // / Religious Pendants — two different trails for one page.
      breadcrumbJsonLd(origin, [
        {name: 'Home', path: '/'},
        ...collectionParentCrumb(collection, rootData),
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
 * The department crumb between Home and this collection, as `[{name, path}]`
 * ready to splice into a crumb list — empty for a department itself, and empty
 * whenever the header has not loaded.
 *
 * Resolves through the same helper the visible <Breadcrumb> uses, so the two
 * cannot disagree.
 */
function collectionParentCrumb(
  collection: {handle: string},
  rootData: ReturnType<typeof rootDataFrom>,
): {name: string; path: string}[] {
  const parent = getMegaMenuParentCrumb({
    handle: collection.handle,
    header: (rootData as any)?.header,
    publicStoreDomain: (rootData as any)?.publicStoreDomain,
  });
  return parent ? [{name: parent.label, path: parent.to}] : [];
}

/**
 * CollectionPage node for the category itself.
 *
 * The page already published a BreadcrumbList and an ItemList, which describe
 * the trail and the grid but never say what the PAGE is. `isPartOf` points at
 * the sitewide #website node from seo.ts so this resolves into one graph
 * instead of a loose fragment.
 */
function collectionPageJsonLd(origin: string, collection: any, title: string) {
  const url = absoluteUrl(origin, `/collections/${collection.handle}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: collection.seo?.title || title,
    description:
      metaDescription(collection.seo?.description || collection.description) ||
      undefined,
    isPartOf: {'@id': `${origin}/#website`},
    // The plain-language subject, distinct from the SEO title. `about` is what
    // a retrieval engine reads to decide the page is about gold chains rather
    // than matching the title string.
    about: {'@type': 'Thing', name: title},
    mainEntity: {'@id': `${url}#products`},
  };
}

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
 * Stands in for Hydrogen's `<Pagination>`, which this page no longer uses.
 *
 * Same render-prop shape, minus `PreviousLink`/`hasPreviousPage` — there is no
 * "previous" any more, because the URL says how many products to render from
 * the first one, not which page to render. `nodes` therefore comes straight
 * from the loader instead of being stitched together from `location.state`,
 * which is what used to be lost on a reload.
 *
 * "Load More" is a real `<Link>` to `?show=N`, so it works without JavaScript,
 * is crawlable, and restores correctly on back/forward. `preventScrollReset`
 * keeps the viewport where it is while the next batch appends, and `replace`
 * keeps 10 clicks from becoming 10 history entries.
 *
 * A COUNT rather than a page number is what makes the batch size responsive.
 * With `?page=N` the server had to multiply by a page size it could not know,
 * so a phone showing 2 columns and a desktop showing 5 shared one fixed 24 —
 * four clean rows of six, a ragged 4.8 rows of five. The count is layout
 * independent: the browser measures the grid it actually rendered, adds five
 * rows of it, and asks for that many.
 */
function ProductGrid({
  connection,
  total,
  children,
}: {
  connection: {nodes: any[]; pageInfo: {hasNextPage: boolean}};
  /** Every product in this collection under the active filters, from Shopify. */
  total?: number;
  children: (props: {
    nodes: any[];
    isLoading: boolean;
    hasNextPage: boolean;
    columns: number;
    gridRef: React.MutableRefObject<HTMLDivElement | null>;
    LoadMoreLink: (props: {
      className?: string;
      children: React.ReactNode;
    }) => React.ReactElement;
  }) => React.ReactElement;
}) {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const nodes = connection.nodes ?? [];
  const gridRef = useRef<HTMLDivElement | null>(null);
  const columns = useGridColumns(gridRef);

  // Five more rows of whatever is on screen, never past the end of the
  // collection — asking for more than exists is harmless but makes the URL
  // claim a number the page cannot show.
  const nextShow = Math.min(
    nodes.length + batchSize(columns),
    total ?? Number.MAX_SAFE_INTEGER,
  );

  // Only true while THIS grid's next batch is loading — not while an unrelated
  // navigation (a filter, a product click) is in flight.
  const isLoading =
    navigation.state === 'loading' &&
    navigation.location?.search.includes(`show=${nextShow}`) === true;

  const linkTo = (count: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('show', String(count));
    // Retired scheme: a stale `page` left alongside `show` would be ignored by
    // the loader but kept in the URL, and shared onward from there forever.
    params.delete('page');
    return `?${params.toString()}`;
  };

  const LoadMoreLink = ({
    className,
    children: label,
  }: {
    className?: string;
    children: React.ReactNode;
  }) => {
    return (
      <Link
        className={className}
        to={linkTo(nextShow)}
        replace
        preventScrollReset
      >
        {label}
      </Link>
    );
  };

  return children({
    nodes,
    isLoading,
    columns,
    gridRef,
    // Shopify's own answer, and nothing else: the page stops offering more
    // products exactly when the collection runs out of them.
    hasNextPage: connection.pageInfo?.hasNextPage ?? false,
    LoadMoreLink,
  });
}

/**
 * The server-rendered first batch, in products.
 *
 * There is no viewport to measure yet, so this is the one assumed number on
 * the page: five rows of a desktop grid. A phone renders the same 20 products
 * as ten rows of two — more than a first screen either way, and every batch
 * after it is measured rather than assumed.
 */
const FIRST_BATCH = DEFAULT_COLUMNS * ROWS_PER_LOAD;

/**
 * The largest connection the Storefront API returns in one query. Bigger
 * counts are assembled by following `endCursor` — see loadCollectionProducts.
 */
const PAGE_LIMIT = 250;

/**
 * How many products this request should render: `?show=N` means "the first N",
 * not "the Nth page".
 *
 * That is the whole fix for products vanishing on the way back up. The cursor
 * pagination this replaces put `?direction=next&cursor=…` in the URL and kept
 * the earlier products only in `location.state` — browser memory. Any render
 * the server did at that URL (a reload, the back button, a restored tab, a
 * shared link) saw one page and put a "Load previous" button where the first
 * batch had been. Verified in production before the change:
 * /collections/chains served 24 products and no "Load previous"; the same URL
 * with ?direction=next&cursor=… served a different 24 and did show one.
 *
 * A count survives all of that because it is not a pointer into a result set.
 * It is also what lets the batch size follow the column count — see
 * ProductGrid.
 */
function productsToShow(request: Request): number {
  const params = new URL(request.url).searchParams;

  const show = Number(params.get('show'));
  if (Number.isFinite(show) && show >= 1) return Math.floor(show);

  // `?page=N` is the retired scheme, still live in bookmarks, inbound links
  // and anything already indexed. Read as N batches so those URLs keep
  // rendering roughly what they used to instead of snapping back to one batch.
  const page = Number(params.get('page'));
  if (Number.isFinite(page) && page >= 1) {
    return Math.floor(page) * FIRST_BATCH;
  }

  return FIRST_BATCH;
}

/**
 * The collection, with `count` products in it — following `endCursor` for as
 * many extra queries as that takes.
 *
 * One query returns at most 250; a shopper who keeps clicking is no longer
 * capped there. Each page is its own cached subrequest, so going deep re-uses
 * every earlier page rather than re-fetching the lot, and the continuation
 * query is products-only: the description, FAQs, filters and best-sellers come
 * from the first page and are never fetched again.
 */
async function loadCollectionProducts(
  storefront: Route.LoaderArgs['context']['storefront'],
  variables: {
    handle: string;
    filters: any;
    sortKey: any;
    reverse: boolean;
    count: number;
  },
) {
  const {handle, filters, sortKey, reverse, count} = variables;
  const {collection} = await storefront.query(COLLECTION_QUERY, {
    variables: {
      handle,
      filters,
      sortKey,
      reverse,
      first: Math.min(count, PAGE_LIMIT),
      last: null,
      after: null,
    },
    // The grid, with prices. Was on the 24h default, which meant a price edit
    // or a product added to this collection could stay invisible for a day.
    // Catalog tier = 5 min fresh, 20 min worst case.
    cache: CacheCatalog(),
  });

  if (!collection) return null;

  const nodes = [...collection.products.nodes];
  let pageInfo = collection.products.pageInfo;

  while (nodes.length < count && pageInfo?.hasNextPage && pageInfo?.endCursor) {
    const data = await storefront.query(COLLECTION_PRODUCTS_QUERY, {
      variables: {
        handle,
        filters,
        sortKey,
        reverse,
        first: Math.min(count - nodes.length, PAGE_LIMIT),
        after: pageInfo.endCursor,
      },
      cache: CacheCatalog(),
    });
    const next = data?.collection?.products;
    // A collection that changed under us (or a page that failed) ends the walk
    // rather than looping: `hasNextPage` from the last good page still tells
    // the grid truthfully whether to offer Load More.
    if (!next?.nodes?.length) break;
    nodes.push(...next.nodes);
    pageInfo = next.pageInfo;
  }

  return {...collection, products: {...collection.products, nodes, pageInfo}};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;
  const url = new URL(request.url);
  // No hardcoded {available: true} — that silently dropped every out-of-stock
  // product from the grid, so a collection with 40 products in the admin only
  // ever rendered the in-stock subset. Availability is a filter the shopper
  // opts into from the sidebar (getFiltersFromParam), same as any other facet.
  const filters = getFiltersFromParam(url.searchParams);
  const sort = getSortFromParam(url.searchParams.get('sort'));

  if (!handle) {
    throw redirect('/collections');
  }

  // Folded into the single Miami Cuban Chains category — see megaMenu.
  if (MERGED_CUBAN_HANDLES.includes(handle)) {
    throw redirect(`/collections/${MIAMI_CUBAN_HANDLE}`, 301);
  }

  // Kicked off HERE, next to the queries below, not after them.
  //
  // Which parent a collection inherits from depends only on the handle in the
  // URL — never on the collection response — so this chain has no reason to
  // wait for it. It used to run in series behind the main query: up to three
  // Shopify round trips stacked end to end, measured at 1.69s TTFB on a child
  // category against 0.88s on a department that skipped both. Overlapping it
  // with the main query costs whatever is left over, usually nothing.
  //
  // Every hop is cached and ends in a catch, so this promise always
  // resolves and never produces an unhandled rejection while it sits
  // un-awaited. `null` is an ordinary outcome, not an error: departments have
  // no parent, and most collections never read the result at all.
  const parentContent = storefront
    .query(CATEGORY_MENUS_QUERY, {cache: CacheNav()})
    .catch(() => null)
    .then((menus) => {
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
      // A department has nothing above it, so most pages stop here and never
      // make the second request at all.
      if (!parentHandle) return null;

      return storefront
        .query(PARENT_COLLECTION_CONTENT_QUERY, {
          variables: {handle: parentHandle},
          cache: CacheContent(),
        })
        .then((data) => data.collection)
        .catch(() => null);
    })
    .catch(() => null);

  const [collection, allCollections] = await Promise.all([
    loadCollectionProducts(storefront, {
      handle,
      filters,
      sortKey: sort.sortKey,
      reverse: sort.reverse,
      count: productsToShow(request),
    }),
    // Backs the sidebar's category list. Cached and non-fatal: the page still
    // renders if it fails.
    storefront
      .query(SIDEBAR_COLLECTIONS_QUERY, {cache: CacheNav()})
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

  // This metaobject is assigned in Shopify on each individual collection.
  // Never search or fall back to general site-wide FAQ data here; the only
  // permitted fallback is the collection's own parent department (below).
  let faqs = readFaqMetafield(collection.collectionFaqs);

  // A child category with none of its own inherits its parent's, so merchants
  // only fill these in once per department. Cached and non-fatal: worst case
  // the child page renders without FAQs.
  if (!faqs.length) {
    // Started before the query above, so by now it has usually already
    // resolved and this awaits nothing.
    const parent = await parentContent;
    if (parent) {
      faqs = readFaqMetafield(parent.collectionFaqs);
    }
  }

  return {
    collection,
    allCollections,
    faqs,
    // Resolved here, not in `meta`, because deciding it needs one look at what
    // the CDN actually returns and a meta function cannot await. Null means the
    // banner is unusable as a share image and pageSeo should fall back to the
    // brand shot — see resolveShareImage.
    shareImage: await resolveShareImage(
      context.withCache,
      collection.image?.url,
    ),
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

export default function Collection() {
  const {collection, allCollections, faqs} = useLoaderData<typeof loader>();
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
  const parentCrumb = getMegaMenuParentCrumb({
    handle: collection.handle,
    header: rootData?.header,
    publicStoreDomain: rootData?.publicStoreDomain,
    preferDepartmentId: useDepartmentHint(),
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
  // The collection's true size, from the facet counts that came back with the
  // products — no extra query, and it narrows with the filters.
  const productCount = collectionProductCount(collection.products.filters);

  const filters = (collection.products.filters ?? []).map((filter: any) => ({
    id: filter.id,
    label: filter.label,
    type: filter.type,
    values: filter.values.map((value: any) => ({
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
        <CollectionStickyHead>
          <div className="section-inner">
            <CollectionSubNavIcons
              handle={collection.handle}
              header={rootData.header}
              publicStoreDomain={rootData.publicStoreDomain}
            />
          </div>
        </CollectionStickyHead>
      )}

      <section className="home-section">
        <div className="section-inner collection-layout">
          <CollectionFilterSidebar
            categories={categories}
            filters={filters}
            shareButton={
              <ShareButtons
                title={collection.title}
                image={collection.image?.url ?? undefined}
                align="end"
              />
            }
          />
          <div
            className={`collection-main${isListView ? ' is-list-view' : ''}`}
          >
            {/* The grid sat directly under the collection's h1 with nothing
                between, so the product cards' h3 would jump a level. It also
                names the region: an agent looking for the products on a
                collection page had only an unlabelled <div> to go on. */}
            <h2 className="visually-hidden">Products</h2>
            <ProductGrid connection={collection.products} total={productCount}>
              {({
                nodes,
                isLoading,
                LoadMoreLink,
                hasNextPage,
                columns,
                gridRef,
              }) => {
                return (
                  <div className="load-more">
                    {/* No "Load previous". Every product from the first one
                        through the current page is already on screen — see
                        productsToShow(). */}
                    {nodes.length === 0 ? (
                      <p className="collection-empty">
                        No pieces match these filters. Try clearing a filter.
                      </p>
                    ) : (
                      /* One grid for every product. It used to be chunked into
                         separate 8-item grids so cover-photo banners could sit
                         between them; the banners are gone, and each chunk was
                         laying out independently — at 5 columns every grid
                         rendered 5 then 3, leaving a ragged half-empty row
                         after every eighth card. */
                      <div className="products-grid" ref={gridRef}>
                        {nodes.map((product, index) => (
                          <ProductItem
                            key={product.id}
                            product={product}
                            collectionHandle={collection.handle}
                            loading={index < 8 ? 'eager' : 'lazy'}
                          />
                        ))}
                      </div>
                    )}

                    {isLoading && (
                      <div
                        className="products-grid collection-load-more-skeleton"
                        aria-label="Loading more products"
                      >
                        {Array.from({length: columns}).map((_, index) => (
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
                      {/* The real size of the collection, straight off
                          Shopify's own facet counts — see
                          collectionProductCount. It tracks the active filters,
                          so it reads "23 of 23" once one is applied. */}
                      <span className="load-more-count">
                        {productCount
                          ? `${nodes.length} of ${productCount} pieces shown`
                          : `${nodes.length} pieces shown`}
                      </span>
                      {hasNextPage ? (
                        <LoadMoreLink className="load-more-btn">
                          {isLoading ? 'Loading…' : 'Load More'}
                        </LoadMoreLink>
                      ) : (
                        nodes.length > 0 && (
                          <span className="load-more-end">
                            That’s the whole collection
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              }}
            </ProductGrid>
          </div>
        </div>
      </section>

      {descriptionRest && (
        <section
          className="home-section collection-about"
          aria-labelledby="collection-description-title"
        >
          <div className="section-inner">
            <div className="editorial-heading">
              <h2 id="collection-description-title" className="editorial-title">
                About {collection.title}
              </h2>
            </div>
            {/* Same accordion the product page uses for its own description
                (`headingTag="h5"` there; collection copy is authored with
                `h2`). A flat wall of prose under a category grid is what
                read as cheap — a merchant's 6-heading collection write-up
                rendered as 6,000 characters of unbroken text. This keeps the
                intro visible and collapses each h2 section behind its own
                "+", the same reveal a shopper already knows from the product
                page. `collection-about` narrows the whole stack to a reading
                column and adds the section's own rule/divider — see app.css. */}
            <DescriptionAccordions html={descriptionRest} headingTag="h2" />
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
        /*
          Hydrogen's collection payload carries the id and handle and nothing
          else, but GA4's `view_item_list` is only worth sending with the list
          whenb ut begin in the cide that diuaply and the conf;9ct and yjkle o
          cico and teh code thatyhas been used in th wensite and teh one person 
          ourin and the dont bekive the coe 
          ueah the the wensote apple and samsunf and teh linyc and the oppo and 
          supported way to widen a payload, and AnalyticsBridge reads
          `products` from it. Cards show the from-price, so that is the price
          reported here; the exact variant price arrives with `view_item`.
        */
        customData={{
          products: (collection.products?.nodes ?? []).map(analyticsProduct),
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
    # New Arrival badge — see cardBadges() in ProductItem.tsx.
    publishedAt
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
    # Card badges. Tags drive Karat/Diamond and best-sellers
    # membership drives Best Seller. See cardBadges() in
    # ProductItem.tsx for why only those, and only from here.
    tags
    collections(first: 15) {
      nodes {
        handle
      }
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
      # Card badges: a Sale badge must come from a real
      # compare-at price, never from a tag someone typed.
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
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

// The FAQ metaobject, shared by the collection query and the parent-department
// lookup that child pages fall back to.
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
    diamondMenu: menu(handle: "diamond") { ...MenuHandles }
    engagementRingsMenu: menu(handle: "engagement-rings") { ...MenuHandles }
    ringsMenu: menu(handle: "rings") { ...MenuHandles }
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
/**
 * Products beyond the first page, for collections deeper than one query's 250.
 *
 * Deliberately NOT the full COLLECTION_QUERY: everything else on the page —
 * description, SEO, image, FAQs, the facet list, best-sellers — is a property
 * of the collection, not of the page of products, and re-fetching all of it
 * per 250 products would triple the cost of browsing deep for nothing.
 */
const COLLECTION_PRODUCTS_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query CollectionProductsPage(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $first: Int
    $after: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      products(
        first: $first,
        after: $after,
        filters: $filters,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        nodes {
          ...ProductItem
        }
        # Same four fields the first page returns, so the walked-to pageInfo
        # is interchangeable with it rather than a narrower shape the grid
        # would have to special-case.
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;

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
    $after: String
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
        after: $after,
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
