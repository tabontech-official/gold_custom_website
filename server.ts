import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';

// ponytail: a literal map. Shopify Admin > Navigation > URL redirects (read by
// storefrontRedirect below) is the place for anything a merchant should edit.
const LEGACY_REDIRECTS: Record<string, string> = {
  '/pages/contact': '/contact',
  '/pages/custom-jewelry': '/custom-jewelry',
  '/policies/contact-information': '/contact',
  '/agents.md': '/llms.txt',
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
        const legacy = LEGACY_REDIRECTS[url.pathname.replace(/\/$/, '')];
        if (legacy) {
          return Response.redirect(new URL(legacy + url.search, url), 301);
        }

        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `storefrontRedirect`
         * will pass through the 404 response.
         */
        return storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
      }

      return response;
    } catch (error) {
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};
