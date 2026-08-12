/**
 * Google Analytics 4 + Meta pixel loading.
 *
 * WHY THIS FILE EXISTS AT ALL
 *
 * On the old Liquid storefront neither tag was ever written by hand. The
 * Google & YouTube app and the Facebook & Instagram app each install a *web
 * pixel*, and the Online Store theme loads Shopify's Web Pixels Manager on
 * every page, which runs them. Hydrogen never loads that manager — it ships
 * only the Customer Privacy API, the privacy banner, perf-kit and its own
 * monorail reporting (verified against @shopify/hydrogen 2026.1.0). So both
 * apps still say "Connected" in the admin, and both are still correct: they
 * are connected to the *store*. They simply have no way to reach a page this
 * app renders. That gap is what this file closes.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * `purchase`, `begin_checkout` and `add_payment_info`. Checkout is still
 * Shopify-hosted, so the two app pixels keep firing there exactly as before.
 * Emitting them from the storefront as well would double-count revenue in GA4
 * and Meta — the most expensive kind of analytics bug, because the numbers
 * stay plausible. Everything up to the checkout button is ours; everything
 * from the checkout button on is theirs.
 *
 * CONSENT
 *
 * Both tags boot denied. `Analytics.Provider` already gates delivery — its
 * `publish` is a no-op while `canTrack()` is false, and `canTrack` defaults to
 * `window.Shopify.customerPrivacy.analyticsProcessingAllowed()` — so no event
 * can reach the bridge before Shopify's consent API has loaded and allowed it.
 * The bridge then translates that same consent into Google Consent Mode v2 and
 * `fbq('consent', ...)`. Booting granted would put the cookie down before any
 * of that ran.
 */

export type AnalyticsTagIds = {
  /** GA4 measurement ID, e.g. `G-XXXXXXXXXX`. */
  ga4Id?: string;
  /** Meta pixel ID — all digits. */
  metaPixelId?: string;
};

/**
 * These IDs are interpolated into an inline `<script>`, so they are validated
 * rather than trusted. They arrive from `context.env`, which is merchant-set
 * configuration in the Oxygen dashboard — not user input, but not compiled-in
 * either, and a typo'd value should disable the tag rather than produce a
 * syntax error that takes the rest of the bootstrap down with it.
 */
const GA4_ID = /^G-[A-Z0-9]{4,20}$/i;
const META_PIXEL_ID = /^\d{6,25}$/;

export function analyticsTagIds(env: {
  PUBLIC_GA4_ID?: string;
  PUBLIC_META_PIXEL_ID?: string;
}): AnalyticsTagIds {
  const ga4Id = env.PUBLIC_GA4_ID?.trim();
  const metaPixelId = env.PUBLIC_META_PIXEL_ID?.trim();

  return {
    ga4Id: ga4Id && GA4_ID.test(ga4Id) ? ga4Id : undefined,
    metaPixelId:
      metaPixelId && META_PIXEL_ID.test(metaPixelId) ? metaPixelId : undefined,
  };
}

/**
 * The product shape every Hydrogen analytics event uses, built from a
 * Storefront product node.
 *
 * Product cards and collection grids only ever query the list-card fields —
 * there is no selected variant and no vendor on a grid node — so this reads
 * everything optionally and falls back rather than throwing. `variantId` is
 * what both GA4 and Meta key a product on (see AnalyticsBridge), so the
 * first-available variant is used when nothing is selected yet; the exact
 * variant arrives later with `view_item` from the product page.
 */
export type AnalyticsProductNode = {
  id?: string | null;
  title?: string | null;
  vendor?: string | null;
  productType?: string | null;
  selectedOrFirstAvailableVariant?: {id?: string | null} | null;
  priceRange?: {minVariantPrice?: {amount?: string | null} | null} | null;
};

export function analyticsProduct(node: AnalyticsProductNode) {
  return {
    id: node.id ?? '',
    title: node.title ?? '',
    price: node.priceRange?.minVariantPrice?.amount ?? '0',
    vendor: node.vendor ?? '',
    variantId: node.selectedOrFirstAvailableVariant?.id ?? '',
    variantTitle: '',
    quantity: 1,
    ...(node.productType ? {productType: node.productType} : {}),
  };
}

/**
 * The vendor bundles, injected by AnalyticsBridge *after* hydration — never
 * rendered into `<head>` by React.
 *
 * This is not a preference, it is the fix for a real bug. Meta's official
 * snippet ends with
 * `document.getElementsByTagName('script')[0].parentNode.insertBefore(...)`,
 * which runs while the document is still parsing and puts a `<script>` node in
 * the middle of `<head>` — ahead of the JSON-LD block, which is the first
 * script element on the page. React then hydrates a head with one more child
 * than it server-rendered, fails with a hydration mismatch, and throws the
 * whole root away to re-render on the client (React errors #418 and #423).
 *
 * Injecting both bundles from an effect instead means nothing touches the DOM
 * until React has finished with it. Neither tag loses an event by arriving
 * late: the inline bootstrap below has already created `dataLayer` and `fbq`
 * as queues, and each vendor drains its queue on arrival. It also keeps two
 * third-party requests off the critical path, which the LCP image was
 * competing with.
 */
export function analyticsVendorScripts({
  ga4Id,
  metaPixelId,
}: AnalyticsTagIds): Array<{id: string; src: string}> {
  const scripts: Array<{id: string; src: string}> = [];

  if (ga4Id) {
    scripts.push({
      id: 'ga4-gtag',
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`,
    });
  }
  if (metaPixelId) {
    scripts.push({
      id: 'meta-pixel',
      src: 'https://connect.facebook.net/en_US/fbevents.js',
    });
  }

  return scripts;
}

/**
 * The inline bootstrap for both tags. Runs in `<head>` so `dataLayer`/`fbq`
 * exist and are queuing before hydration — the bridge only ever pushes onto
 * queues that are already there, and never has to care whether either vendor
 * script has finished loading.
 *
 * Returns '' when neither ID is configured, so the caller can skip the tag.
 */
export function analyticsBootstrap({
  ga4Id,
  metaPixelId,
}: AnalyticsTagIds): string {
  const parts: string[] = [];

  if (ga4Id) {
    parts.push(
      // Canonical Google snippet. `gtag` must stay a `function` expression:
      // it forwards the `arguments` object, which an arrow function has no
      // binding for.
      `window.dataLayer=window.dataLayer||[];` +
        `window.gtag=function(){window.dataLayer.push(arguments)};` +
        `gtag('js',new Date());` +
        // Consent Mode v2. Denied until the bridge hears otherwise from
        // Shopify's Customer Privacy API; `security_storage` is exempt from
        // consent under the spec and stays granted.
        `gtag('consent','default',{` +
        `ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',` +
        `analytics_storage:'denied',functionality_storage:'denied',` +
        `personalization_storage:'denied',security_storage:'granted',` +
        `wait_for_update:500});` +
        // send_page_view:false — this is a single-page app, so gtag's own
        // pageview would only ever fire on a cold load and miss every
        // in-app navigation. The bridge sends all of them, from Hydrogen's
        // `page_viewed`, so they are counted once each.
        `gtag('config','${ga4Id}',{send_page_view:false});`,
    );
  }

  if (metaPixelId) {
    parts.push(
      // Meta's snippet with BOTH of its tails removed.
      //
      // Gone: the `createElement`/`insertBefore` that loads fbevents.js. It
      // mutates `<head>` mid-parse and breaks React's hydration — see
      // analyticsVendorScripts above, which now loads the bundle instead.
      //
      // Gone: the trailing `fbq('track','PageView')`. It would fire before
      // consent is known, and never again on an in-app navigation. The bridge
      // owns PageView for the same reason gtag does.
      //
      // What is left is only the queue stub, which is all fbevents.js needs to
      // find when it eventually loads.
      `!function(f,n){if(f.fbq)return;n=f.fbq=function(){` +
        `n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};` +
        `if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}` +
        `(window);` +
        `fbq('consent','revoke');` +
        `fbq('init','${metaPixelId}');`,
    );
  }

  return parts.join('');
}
