import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type {Route} from './+types/root';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import {getWishlist} from '~/lib/wishlist';
import appStyles from '~/styles/app.css?url';
import appStylesInline from '~/styles/app.css?inline';
import almarai400 from '~/assets/fonts/almarai-400.woff2?url';
import almarai300 from '~/assets/fonts/almarai-300.woff2?url';
import {PageLayout} from './components/PageLayout';
import {ChatWidget} from './components/ChatWidget';
import {WishlistToast} from './components/WishlistToast';
import {AnalyticsBridge} from './components/AnalyticsBridge';
import {analyticsBootstrap, analyticsTagIds} from '~/lib/analytics';
import {
  SITE,
  localBusinessJsonLd,
  organizationJsonLd,
  pageSeo,
  rootDataFrom,
  siteOrigin,
  websiteJsonLd,
} from '~/lib/seo';

export type RootLoader = typeof loader;

/**
 * Sitewide SEO defaults. Child routes call `getSeoMeta` with their own config,
 * which overrides these per-key — so this supplies the title template,
 * og:site_name and the Organization/WebSite graph on every page without each
 * route repeating it.
 */
export const meta: Route.MetaFunction = ({matches}) => {
  const origin = siteOrigin(rootDataFrom(matches));

  // pageSeo, not getSeoMeta — it is the only thing that emits `og:image`,
  // `og:type`, `og:site_name` and `twitter:card`, and it supplies the brand
  // fallback image. Routes that called getSeoMeta directly were the ones
  // shipping blank social previews. See lib/seo.ts.
  return pageSeo({
    title: SITE.name,
    description: SITE.description,
    url: origin,
  });
};

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g login, cart update...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    /**
     * The two homepage widgets — the Reputon TikTok carousel and the Elfsight
     * reviews grid — are both third-party scripts injected on scroll, so the
     * browser only learns their origins at the moment it needs them and pays a
     * cold DNS + TCP + TLS handshake before a byte of either arrives.
     *
     * `dns-prefetch`, not `preconnect`: a preconnect holds an open socket, and
     * browsers cap parallel connections during load, so four of them would take
     * slots the LCP image wants. These resolve DNS early and cost nothing if
     * the shopper never scrolls that far.
     *
     * Kept in sync with REPUTON_SCRIPT_SRC (components/TikTokFeedSection.tsx)
     * and ELFSIGHT_SCRIPT_SRC (components/GoogleReviewsSection.tsx).
     */
    {rel: 'dns-prefetch', href: 'https://cdn.ttw.reputon.com'},
    {rel: 'dns-prefetch', href: 'https://ttw.reputon.com'},
    {rel: 'dns-prefetch', href: 'https://elfsightcdn.com'},
    {rel: 'dns-prefetch', href: 'https://static.elfsight.com'},
    // No `preconnect` to shop.app. It was here for Shop Pay, but the only Shop
    // Pay surface in this app is the installments banner on the product page,
    // and that loads shop-js from cdn.shopify.com — the origin preconnected
    // above. Nothing on any route requests shop.app, so the hint spent a DNS +
    // TCP + TLS handshake on an origin never used, on every page, and Lighthouse
    // flagged it as an unused preconnect. Browsers cap parallel connections
    // during load, so a dead one is not free: it takes a slot the LCP image
    // could have had. Add it back only alongside something that actually
    // requests it (a Shop Pay checkout button, say).
    //
    // See SHOP_PAY_TERMS_SCRIPT in routes/products.$handle.tsx.
    // Almarai is self-hosted (@font-face in app.css) — no fonts.googleapis.com
    // stylesheet in the critical path, no second origin to connect to. Preload
    // the body weight so it starts downloading before the parser reaches the
    // @font-face rule it belongs to (inlined in Layout, so that is early — but
    // still 160 KB of CSS later than this tag).
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: almarai400,
      crossOrigin: 'anonymous',
    },
    // 300 and 800: the two faces that render ABOVE THE FOLD.
    //
    // Pick these by what paints first, NOT by how many rules mention a weight —
    // counting declarations is what got this wrong once already. Almarai ships
    // 300/400/700/800 and nothing between, and app.css asks for `600` 93 times
    // and `500` 30 times, so CSS matching resolves 600 -> 700 and 500 -> 400.
    // That makes 700 the most-DECLARED face by a wide margin. It is also almost
    // entirely below the fold, so preloading it bought nothing and measurably
    // displaced the two faces that do paint immediately:
    //
    //   .hero-heading  font-weight: 300  <- the words on the hero banner
    //
    // Lighthouse's critical request chain named it at 643 ms, discovered late
    // because it was not preloaded. 400 stays because it is the body face and
    // `font-weight: 500` resolves onto it.
    //
    // 800 used to be here too, for the first-load intro overlay's `.intro-text`.
    // That overlay is gone, so 800 is no longer above the fold and the preload
    // came out with it — a third font competes with the LCP image for the same
    // early bandwidth, which is the wrong trade on a phone.
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: almarai300,
      crossOrigin: 'anonymous',
    },
    // Served from public/ at a fixed path rather than imported as a hashed
    // Vite asset: crawlers and the Organization JSON-LD logo both need a
    // stable URL, and /favicon.svg was 404ing because the hashed asset never
    // lived there. This is the store's own icon, pulled from Shopify.
    {rel: 'icon', type: 'image/png', href: '/favicon.png'},
  ];
}

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;
  const checkoutDomain = env.PUBLIC_CHECKOUT_DOMAIN ?? env.PUBLIC_STORE_DOMAIN;

  return {
    ...deferredData,
    ...criticalData,
    wishlist: getWishlist(args.context.session),
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    // GA4 + Meta pixel IDs. Both tags used to be injected by Shopify's Web
    // Pixels Manager, which Hydrogen never loads — see app/lib/analytics.ts.
    analyticsTags: analyticsTagIds(env),
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      // CacheShort, NOT CacheLong. CacheLong is maxAge 3600 + SWR 82800 — a
      // 24-hour stale window, and stale-while-revalidate SERVES the stale copy
      // to the visitor who triggers the refresh, so a menu edit in the Shopify
      // admin took an hour plus two page loads to show up. This query carries
      // every nav menu and the collection titles in them, which is exactly the
      // content merchants edit and expect to see live.
      cache: storefront.CacheShort(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {header};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheShort(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({children}: {children?: React.ReactNode}) {
  const nonce = useNonce();
  const rootData = useRouteLoaderData<RootLoader>('root');
  const origin = siteOrigin(rootData);
  // Undefined on the error shell, where the root loader never resolved. No
  // tags there is the right outcome — an error page is not a pageview.
  const tagBootstrap = analyticsBootstrap(rootData?.analyticsTags ?? {});

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/*
          Google Search Console ownership. Rendered in the shell rather than a
          route `meta` export for the same reason as the JSON-LD below: a child
          route's `meta` REPLACES the root's, so a `meta`-based tag would vanish
          on exactly the pages that define their own — including the home page.

          Verification is re-checked periodically, not just once: removing this
          tag silently un-verifies the property and cuts off Search Console
          data. Leave it in place.
        */}
        <meta
          name="google-site-verification"
          content="_oBhTHP7os68yaOsHXe330yYwZwHMUBUAvfzm7WnwLw"
        />
        {/*
          BEFORE the stylesheet, deliberately. `Links` carries the preconnects
          and the font preload, and the inlined `<style>` below is 160 KB of
          markup — roughly 21 KB even brotlied. Sitting after it, every hint in
          here was discovered that much later in the stream.

          It matters more since the stylesheet stopped being a `<link>`. That
          link used to be the first thing to touch cdn.shopify.com, so it opened
          the connection the product images then reused for free. Nothing opens
          it now, which makes the `preconnect` below load-bearing rather than
          belt-and-braces: it is what gets the handshake started before the
          parser has waded through the CSS to reach the LCP `<img>`.
        */}
        <Meta />
        <Links />
        {/*
          The stylesheet is INLINED in production, not linked.

          Linked, it was the page's only render-blocking request and cost
          ~1,950 ms on a throttled phone — and only ~350 ms of that was the
          bytes. The rest is a cold connection: the built assets live on
          cdn.shopify.com while the document comes from the storefront origin,
          so the browser has to spend a DNS + TCP + TLS handshake before it can
          even ask for it. A `preconnect` only overlaps that handshake with
          whatever else is in flight — it cannot remove the round trip. The only
          way to not pay for one is to not make one.

          Measured cost of doing it this way, so the next person can re-decide
          with real numbers rather than re-derive them:

            document      19.7 KB -> ~45 KB brotli
            root JS chunk  8.2 KB -> 33.4 KB brotli
            CSS request    25 KB + ~1,600 ms of connection -> gone

          The JS growth is the same CSS a second time: `Layout` is universal, so
          the string ships in the client bundle as well to keep hydration
          matching. It is a string literal, not code — no parse or execute cost,
          just bytes on an async chunk that lands after first paint. Net +25 KB
          transfer for roughly -1.2 s of FCP, which is the right way round for a
          storefront whose mobile traffic mostly arrives cold from search.

          The alternative — splitting app.css per route — was measured too and
          is the worse deal: only ~36% of the sheet is exclusive to a single
          route, so it leaves the request (and its handshake) in place and saves
          about 175 ms for a 1,297-block partitioning job. Worth doing ON TOP of
          this one day to shrink the inlined payload; not worth doing instead.

          Dev still links it, so CSS hot-reload keeps working. `import.meta.env`
          is a build-time constant, identical on server and client, so the two
          branches can never disagree across a hydration boundary.
        */}
        {import.meta.env.DEV ? (
          <link rel="stylesheet" href={appStyles} />
        ) : (
          <style dangerouslySetInnerHTML={{__html: appStylesInline}} />
        )}
        {/*
          Organization + WebSite must appear on every page, but a child route's
          `meta` export REPLACES the root's rather than merging with it — so
          putting this in root `meta` would only reach the handful of routes
          that don't define their own. Rendering it in the shell instead makes
          it genuinely sitewide.
        */}
        {/*
          No `nonce` here: React round-trips it inconsistently between server
          and client and triggers a hydration mismatch, and CSP `script-src`
          doesn't govern non-executable `ld+json` data blocks anyway.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // This graph is built from compile-time constants, so it is safe
            // today by accident rather than by rule. Escaping `<` the same way
            // the product page does makes that structural: if anything here
            // ever starts reading merchant or session data, a stray
            // `</script>` still cannot break out of the block.
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                organizationJsonLd(origin),
                localBusinessJsonLd(origin),
                websiteJsonLd(origin),
              ],
            }).replace(/</g, '\\u003c'),
          }}
        />
        {/*
          GA4 + Meta pixel — the queue stubs only, no vendor `<script src>`.

          This has to run early: it creates `dataLayer` and `fbq` as queues, so
          an event published during hydration is held rather than dropped. It
          costs nothing, being inline with no request to schedule.

          AnalyticsBridge loads the two vendor bundles after hydration instead
          of React rendering them here. That is deliberate and load-bearing —
          see app/lib/analytics.ts. Both drain their queue on arrival, so
          arriving late loses no events.
        */}
        {tagBootstrap && (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{__html: tagBootstrap}}
          />
        )}
      </head>
      <body>
        {children}
        <WishlistToast />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');

  if (!data) {
    return <Outlet />;
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
      <ChatWidget />
      {/*
        Inside the provider, because it subscribes to it. It renders nothing —
        it forwards Shopify's events to GA4 and Meta, which used to be the Web
        Pixels Manager's job on the Liquid storefront.
      */}
      <AnalyticsBridge {...data.analyticsTags} />
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="route-error">
      <h1>Oops</h1>
      <h2>{errorStatus}</h2>
      {errorMessage && (
        <fieldset>
          <pre>{errorMessage}</pre>
        </fieldset>
      )}
    </div>
  );
}
