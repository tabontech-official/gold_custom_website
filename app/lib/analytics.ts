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

/** `https://www.googletagmanager.com/gtag/js?id=…`, or null when unconfigured. */
export function gtagScriptSrc({ga4Id}: AnalyticsTagIds): string | null {
  return ga4Id
    ? `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`
    : null;
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
      // Canonical Meta snippet, minus its trailing `fbq('track','PageView')`:
      // that would fire before consent is known and again on no navigation at
      // all. The bridge owns PageView for the same reason gtag does.
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){` +
        `n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};` +
        `if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];` +
        `t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];` +
        `s.parentNode.insertBefore(t,s)}(window,document,'script',` +
        `'https://connect.facebook.net/en_US/fbevents.js');` +
        `fbq('consent','revoke');` +
        `fbq('init','${metaPixelId}');`,
    );
  }

  return parts.join('');
}
