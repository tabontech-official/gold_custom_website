import type {Route} from './+types/sitemap.$type.$page[.xml]';
import {getSitemap} from '@shopify/hydrogen';
import {productCanonicalPath} from '~/lib/categories';

type Storefront = Route.LoaderArgs['context']['storefront'];

/**
 * `handle` → canonical path, for every product in the catalogue.
 *
 * WHY THIS EXISTS
 * ---------------
 * The sitemap was the one place that built product URLs by hand instead of
 * calling `productCanonicalPath`, and it drifted. Every one of the 4,256 entries
 * was the flat `/products/<handle>`, which 301s to
 * `/collections/<category>/products/<handle>` — so the sitemap advertised the
 * whole catalogue at URLs that redirect. Google files those under "Page with
 * redirect / not indexed" and never takes the canonical from the sitemap, which
 * is why products were not turning up in search at all.
 *
 * It has to be a prefetched map rather than a call inside `getLink`, because
 * `getLink` is synchronous and Hydrogen hands it only `{type, baseUrl, handle}`
 * — never the `category`/`productType` that `productCanonicalPath` resolves
 * against. Building the map up front keeps `getLink` a pure lookup and leaves
 * Hydrogen owning pagination, the index page counts and the XML, so this stays a
 * URL-shape fix and nothing else.
 */
async function productCanonicalPaths(
  storefront: Storefront,
): Promise<Map<string, string>> {
  const paths = new Map<string, string>();
  let cursor: string | null = null;

  // 250 is the Storefront API's per-page ceiling, so this is ~18 round trips for
  // this catalogue — behind CacheLong and the 24h Cache-Control below, so it
  // resolves once a day, not once a request. The page cap is a runaway guard
  // only: it is an order of magnitude above the current catalogue, and the
  // `hasNextPage` check below is what actually ends the loop.
  // ponytail: linear paging is fine at this size; revisit if the catalogue
  // outgrows the 10,000 products this cap allows.
  for (let page = 0; page < 40; page++) {
    const {products} = await storefront.query(
      SITEMAP_PRODUCT_CATEGORIES_QUERY,
      {variables: {cursor}, cache: storefront.CacheLong()},
    );

    for (const product of products.nodes) {
      paths.set(product.handle, productCanonicalPath(product));
    }

    if (!products.pageInfo.hasNextPage) break;
    cursor = products.pageInfo.endCursor;
  }

  return paths;
}

export async function loader({
  request,
  params,
  context: {storefront},
}: Route.LoaderArgs) {
  // Only the product sitemap needs the lookup, and a failure must never take the
  // sitemap down: an empty map falls every entry back to the flat
  // `/products/<handle>`, which is exactly the old behaviour.
  const canonicalPaths =
    params.type === 'products'
      ? await productCanonicalPaths(storefront).catch(
          () => new Map<string, string>(),
        )
      : null;

  const response = await getSitemap({
    storefront,
    request,
    params,
    // The skeleton template ships EN-US/EN-CA/FR-CA here, but this storefront
    // has no locale routing — those URLs 404, and hreflang pointing at 404s is
    // a hard error in Search Console. Single locale: emit no alternates.
    locales: [],
    // Articles are served at /blogs/<handle> and the single blog at /blogs, so
    // the defaults (/articles/<handle>, /blogs/<blog handle>) would feed Google
    // URLs that 404 or redirect.
    getLink: ({type, baseUrl, handle}) => {
      if (type === 'articles') return `${baseUrl}/blogs/${handle}`;
      if (type === 'blogs') return `${baseUrl}/blogs`;
      // The canonical product URL, never the flat one that 301s. A handle the
      // map does not cover — published to the sitemap but absent from the
      // products connection — keeps the flat path, which serves 200 and is
      // genuinely that product's canonical when its category does not resolve.
      if (type === 'products' && handle) {
        return `${baseUrl}${
          canonicalPaths?.get(handle) ?? `/products/${handle}`
        }`;
      }
      return `${baseUrl}/${type}/${handle}`;
    },
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}

/**
 * Only the fields `productCanonicalPath` resolves a category from. Deliberately
 * lean: this runs over the entire catalogue, so anything extra here is 4,000+
 * rows of payload for nothing.
 */
const SITEMAP_PRODUCT_CATEGORIES_QUERY = `#graphql
  query SitemapProductCategories(
    $cursor: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: 250, after: $cursor) {
      nodes {
        handle
        productType
        category {
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
` as const;
