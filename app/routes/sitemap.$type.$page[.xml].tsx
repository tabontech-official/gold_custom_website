import type {Route} from './+types/sitemap.$type.$page[.xml]';
import {getSitemap} from '@shopify/hydrogen';

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
      return `${baseUrl}/${type}/${handle}`;
    },
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}
