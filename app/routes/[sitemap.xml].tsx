import type {Route} from './+types/[sitemap.xml]';
import {getSitemapIndex} from '@shopify/hydrogen';

export async function loader({
  request,
  context: {storefront},
}: Route.LoaderArgs) {
  const response = await getSitemapIndex({
    storefront,
    request,
    // Explicit, because Hydrogen's default list also includes `metaObjects`
    // and this storefront has no route that serves one. Every URL in that
    // child sitemap fell through `getLink` to `${baseUrl}/${type}/${handle}`
    // — /pages_faqs/rings-faq and the like — which the catch-all 404s. That
    // is a sitemap submitting known-dead URLs to Google, which is exactly
    // what the rest of this sitemap setup was written to avoid.
    types: ['products', 'pages', 'collections', 'articles', 'blogs'],
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}
