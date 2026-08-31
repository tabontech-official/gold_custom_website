import type {Route} from './+types/[robots.txt]';
import {parseGid} from '@shopify/hydrogen';
import {CacheStatic} from '~/lib/cache';
import {robotsTxtData} from '~/lib/robotsTxt';

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);

  // The shop id only adds two checkout `Disallow` lines, but fetching it used
  // to be able to take the whole file down with it: an unhandled query failure
  // threw, `/robots.txt` 500'd, and Google reads a 5xx robots.txt as "disallow
  // the entire site" for up to 12 hours (~30 days if it keeps failing). One
  // API blip on a cold cache therefore de-indexed every product page and broke
  // every Merchant Center landing-page check at once.
  //
  // So: never throw. A robots.txt missing two checkout rules is a rounding
  // error; a robots.txt that does not respond is a site-wide outage.
  let shopId: string | undefined;
  try {
    const {shop} = await context.storefront.query(ROBOTS_QUERY, {
      cache: CacheStatic(),
    });
    shopId = shop?.id ? parseGid(shop.id).id : undefined;
  } catch (error) {
    console.error('robots.txt: shop id lookup failed, serving without it', error);
  }

  const body = robotsTxtData({url: url.origin, shopId});

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      // Full file caches for a day. The degraded one caches for five minutes
      // so the checkout rules come back on the next request that succeeds,
      // instead of being pinned out of the file for 24 hours.
      'Cache-Control': `max-age=${shopId ? 60 * 60 * 24 : 60 * 5}`,
    },
  });
}

const ROBOTS_QUERY = `#graphql
  query StoreRobots($country: CountryCode, $language: LanguageCode)
   @inContext(country: $country, language: $language) {
    shop {
      id
    }
  }
` as const;