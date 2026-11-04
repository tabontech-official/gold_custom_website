import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';
import {generalRedirectTarget} from '~/lib/legacyRedirects';

// Exact per-URL overrides, checked first. Anything not listed here falls through
// to Shopify's URL redirects, then to generalRedirectTarget.
const LEGACY_REDIRECTS: Record<string, string> = {
  '/pages/contact': '/contact',
  '/pages/custom-jewelry': '/custom-jewelry',
  '/policies/contact-information': '/contact',
  '/agents.md': '/llms.txt',
  // Deleted collections whose general target would be a worse fit.
  '/collections/cuban-link-chains': '/collections/cuban-chains',
  '/collections/14k-chains': '/collections/chains',
  '/collections/crosses': '/collections/religious-pendants',
  '/collections/saints-necklaces': '/collections/religious-pendants',
  '/collections/virgin-mary-pendants': '/collections/religious-pendants',
  '/collections/saint-jude-pendants': '/collections/religious-pendants',
  '/collections/aztec-calendar-pendants': '/collections/pendants',
  '/collections/egyptian-pendants': '/collections/pendants',
  '/collections/initial-necklaces': '/collections/pendants',
  '/collections/mens-gold-pendants': '/collections/mens',
  '/collections/birthstone-jewelry': '/collections/all',
};

/**
 * Export a fetch handler in module format.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
      );

      /**
       * Create a Hydrogen request handler that internally
       * delegates to React Router for routing and rendering.
       */
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
      });

      const response = await handleRequest(request);

      if (hydrogenContext.session.isPending) {
        response.headers.set(
          'Set-Cookie',
          await hydrogenContext.session.commit(),
        );
      }

      if (response.status === 404) {
        // Old Liquid theme paths with no 1:1 route here. The theme now sends
        // every visitor to the same path on goldcustom.com, so these must land.
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/$/, '');
        const legacy = LEGACY_REDIRECTS[path];
        if (legacy) {
          return Response.redirect(new URL(legacy + url.search, url), 301);
        }

        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `storefrontRedirect`
         * will pass through the 404 response.
         */
        const redirected = await storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
        if (redirected.status !== 404) return redirected;

        // Nothing set in Shopify either: a deleted collection, product or
        // category goes to the nearest live page instead of an error.
        const general = generalRedirectTarget(path);
        return general
          ? Response.redirect(new URL(general + url.search, url), 301)
          : redirected;
      }

      return response;
    } catch (error) {
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};
