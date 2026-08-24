/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      /** Shop Pay Installments banner, upgraded by Shopify's shop-js loader. */
      'shopify-payment-terms': {
        'variant-id': string;
        'shopify-meta': string;
      };
    }
  }

  /**
   * Hydrogen declares `interface Env extends HydrogenEnv {}` globally, so the
   * storefront's own variables merge in here rather than replacing it.
   *
   * Both are optional on purpose: an unset ID has to mean "don't load that
   * tag", not "crash the storefront". Oxygen environments are configured by
   * hand, so a preview deployment that nobody added them to must still boot.
   */
  interface Env {
    /** GA4 measurement ID, e.g. `G-XXXXXXXXXX`. See app/lib/analytics.ts. */
    PUBLIC_GA4_ID?: string;
    /** Meta (Facebook/Instagram) pixel ID — all digits. */
    PUBLIC_META_PIXEL_ID?: string;
    /**
     * Admin API token (custom app, write_customers scope) for the
     * dataSaleOptOut mutation behind /pages/data-sharing-opt-out. Unset:
     * browser-level opt-out still works, account-level returns an apology.
     */
    PRIVATE_ADMIN_API_TOKEN?: string;
  }
}
