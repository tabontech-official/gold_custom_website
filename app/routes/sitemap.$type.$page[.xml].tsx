import type {Route} from './+types/sitemap.$type.$page[.xml]';
import {getSitemap} from '@shopify/hydrogen';
import {productIndexPath} from '~/lib/categories';

/**
 * Pages this app serves from its own routes rather than from Shopify `pages`,
 * so Shopify's sitemap API has never heard of them. They ride along at the
 * end of the first pages sitemap. Each is a self-canonical, indexable 200.
 */
const APP_PAGES = ['/showroom', '/repairs', '/custom-jewelry', '/contact'];

export async function loader({
  request,
  params,
  context: {storefront},
}: Route.LoaderArgs) {
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
      // One indexed URL per product: the flat /products/<handle>, the same one
      // every product page declares as its canonical.
      if (type === 'products' && handle) {
        return `${baseUrl}${productIndexPath(handle)}`;
      }
      return `${baseUrl}/${type}/${handle}`;
    },
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  if (params.type === 'pages' && params.page === '1') {
    const origin = new URL(request.url).origin;
    const appPages = APP_PAGES.map(
      (path) => `<url><loc>${origin}${path}</loc></url>`,
    ).join('');
    const xml = (await response.text()).replace(
      '</urlset>',
      `${appPages}</urlset>`,
    );
    return new Response(xml, {headers: response.headers});
  }

  return response;
}
