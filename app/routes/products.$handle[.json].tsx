import type {Route} from './+types/products.$handle[.json]';
import {toAjaxProduct} from '~/lib/ajaxProduct';

/**
 * Shopify's product JSON endpoint, which Liquid storefronts serve and Hydrogen
 * does not. Reputon's TikTok widget fetches one per tagged product on mount —
 * ~50 on the homepage — and every one of them used to fall through to the
 * catch-all 404 route, which rendered a full page each time. The widget waits on
 * `Promise.all` over the whole set before it draws anything, so those 404s were
 * what kept the carousel blank until a reload. See lib/ajaxProduct.ts.
 */
export async function loader({params, context}: Route.LoaderArgs) {
  const {product} = await context.storefront.query(AJAX_PRODUCT_QUERY, {
    variables: {handle: params.handle},
    // Catalogue data, identical for every visitor. Prices move when the gold
    // rate is repriced, not per request.
    cache: context.storefront.CacheLong(),
  });

  if (!product) {
    return Response.json({error: 'Not Found'}, {status: 404});
  }

  return Response.json(toAjaxProduct(product), {
    headers: {
      // Public and shared — one origin query per handle per hour, then the CDN
      // and the browser carry the other ~50 requests a homepage visit makes.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

// 100 is the Storefront API's ceiling per connection. Nothing in this catalogue
// comes close on either count.
const AJAX_PRODUCT_QUERY = `#graphql
  query AjaxProduct($country: CountryCode, $language: LanguageCode, $handle: String!)
  @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      descriptionHtml
      vendor
      productType
      createdAt
      updatedAt
      publishedAt
      options {
        name
        optionValues {
          name
        }
      }
      images(first: 100) {
        nodes {
          id
          url
          altText
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          sku
          availableForSale
          requiresShipping
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
          image {
            id
          }
        }
      }
    }
  }
` as const;
