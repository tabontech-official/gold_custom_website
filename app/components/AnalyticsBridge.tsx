import {useEffect, useRef} from 'react';
import {
  useAnalytics,
  type CartLineUpdatePayload,
  type CartViewPayload,
  type CollectionViewPayload,
  type PageViewPayload,
  type ProductViewPayload,
  type SearchViewPayload,
} from '@shopify/hydrogen';
import {analyticsVendorScripts, type AnalyticsTagIds} from '~/lib/analytics';

/**
 * Translates Hydrogen's analytics events into GA4 and Meta pixel events.
 *
 * One component for both vendors on purpose. The mapping — which Shopify event
 * counts as a product view, what the line-item delta is on a cart change, which
 * ID a variant reports as — is the hard part and it is identical for the two.
 * Split across two files they drift, and the drift shows up as GA4 and Meta
 * disagreeing about the same session, which is close to impossible to debug
 * after the fact.
 *
 * See app/lib/analytics.ts for why this exists and what it deliberately omits
 * (everything from the checkout button onward — Shopify's own pixels still own
 * `purchase`, `begin_checkout` and `add_payment_info`).
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

type ConsentApi = {
  analyticsProcessingAllowed: () => boolean;
  marketingAllowed: () => boolean;
};

type Ga4Item = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_variant?: string;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
  price: number;
  quantity: number;
};

/**
 * Cart lines are read structurally rather than through the generated Storefront
 * types. The shape below is the subset CART_QUERY_FRAGMENT actually selects,
 * and it is the same for `CartLine` and `ComponentizableCartLine` — pinning to
 * either generated union member makes this file re-break every time the cart
 * query is edited, for no added safety at runtime.
 */
type CartLineish = {
  quantity?: number | null;
  cost?: {amountPerQuantity?: {amount?: string | null} | null} | null;
  merchandise?: {
    id?: string | null;
    title?: string | null;
    price?: {amount?: string | null} | null;
    product?: {title?: string | null; vendor?: string | null} | null;
  } | null;
};

/**
 * `gid://shopify/ProductVariant/43096442306740` -> `43096442306740`.
 *
 * The numeric variant ID is what the Facebook & Instagram app writes into the
 * Meta catalogue as the item's retailer ID, so it is what `content_ids` has to
 * carry for dynamic ads and retargeting to match a product. GA4 has no such
 * constraint but uses the same value, so one product is one `item_id` in both
 * tools.
 */
function numericId(gid?: string | null): string {
  if (!gid) return '';
  const match = /\/(\d+)(?:\?.*)?$/.exec(gid);
  return match ? match[1] : gid;
}

function amount(value?: string | number | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function totalValue(items: Ga4Item[]): number {
  // Rounded to cents: floating point turns 3 × 19.99 into 59.96999999999999,
  // and GA4 stores `value` verbatim.
  const sum = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  return Math.round(sum * 100) / 100;
}

function itemFromProduct(
  product: ProductViewPayload['products'][number],
  index?: number,
): Ga4Item {
  return {
    item_id: numericId(product.variantId) || numericId(product.id),
    item_name: product.title,
    item_brand: product.vendor || undefined,
    item_variant: product.variantTitle || undefined,
    price: amount(product.price),
    quantity: product.quantity ?? 1,
    ...(index === undefined ? {} : {index}),
  };
}

function itemFromLine(line: CartLineish | undefined, quantity: number): Ga4Item {
  const merchandise = line?.merchandise;
  return {
    item_id: numericId(merchandise?.id),
    item_name: merchandise?.product?.title ?? '',
    item_brand: merchandise?.product?.vendor || undefined,
    item_variant: merchandise?.title || undefined,
    price: amount(
      line?.cost?.amountPerQuantity?.amount ?? merchandise?.price?.amount,
    ),
    quantity,
  };
}

/** Meta's `contents` array, derived from the GA4 items so the two can't diverge. */
function metaContents(items: Ga4Item[]) {
  return items.map((item) => ({
    id: item.item_id,
    quantity: item.quantity,
    item_price: item.price,
  }));
}

/**
 * Read consent from Shopify directly rather than from `useAnalytics()`. It is
 * the same object either way, but reading it at send time — instead of closing
 * over a value captured when the subscription was created — means a consent
 * change mid-session takes effect on the very next event.
 */
function consentApi(): ConsentApi | null {
  try {
    const shopify = (
      window as unknown as {Shopify?: {customerPrivacy?: ConsentApi}}
    ).Shopify;
    return shopify?.customerPrivacy ?? null;
  } catch {
    return null;
  }
}

function marketingAllowed(): boolean {
  try {
    return consentApi()?.marketingAllowed() ?? false;
  } catch {
    return false;
  }
}

export function AnalyticsBridge({ga4Id, metaPixelId}: AnalyticsTagIds) {
  const {subscribe, register, shop} = useAnalytics();

  /**
   * Registering is not optional. `Analytics.Provider` buffers every published
   * event until all registered keys report ready, then flushes. Without this,
   * the `page_viewed` and `product_viewed` that fire on a cold load land before
   * the effect below has attached its subscribers, and every session loses its
   * first — and on a single-page visit, only — events.
   */
  const {ready} = register('Third_party_GA4_Meta');

  // `register` hands back a fresh object every render, so `ready` can't go in
  // the dependency list below without re-running the whole effect on every
  // render of the app. The ref pins a stable handle to the current one.
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const lastConsent = useRef('');

  /**
   * Load gtag.js and fbevents.js, once — at the first idle moment or the first
   * interaction, whichever comes first, NOT immediately on hydration.
   *
   * Measured on the live homepage (Lighthouse, Moto G / Slow 4G): these two
   * bundles blocked the main thread for 636 ms between them — fbevents.js 304
   * ms, its signals/config follow-up 185 ms, gtag.js 197 + 150 ms. That was the
   * bulk of a 1,000 ms Total Blocking Time on a page whose own hydration costs
   * ~312 ms. None of it is our code and none of it can be made faster; the only
   * variable is when it runs, and running it the instant React finishes puts it
   * squarely in the window where a shopper is trying to tap something.
   *
   * No event is lost by waiting. The inline bootstrap in root.tsx has already
   * created `dataLayer` and `fbq` as QUEUES, this bridge only ever pushes onto
   * them, and each vendor drains its queue when it loads — see the contract in
   * app/lib/analytics.ts. Arriving late is a supported state; arriving never is
   * not, which is why this cannot be interaction-only:
   *
   *   interaction-only  -> a visitor who reads the page and leaves without
   *                        touching it is never counted. On a storefront that
   *                        is most of the landing-page traffic, and it would
   *                        quietly delete the bounce data the marketing side
   *                        reads. It would also flatter Lighthouse, which never
   *                        interacts — the wrong reason to pick a design.
   *   idle-only         -> fine, but a real shopper usually touches the screen
   *                        before the main thread is ever idle, so the tag
   *                        would load later than it needs to.
   *   whichever first   -> engaged visitors are tracked from their first touch,
   *                        bounced visitors are still counted at idle.
   *
   * The `timeout` matters: `requestIdleCallback` fires it as a deadline even if
   * idle never arrives, so a page that stays busy still gets its tags rather
   * than dropping the session.
   *
   * Appending to `document.body` rather than `<head>` matches how every other
   * third-party script in this app is loaded (chat, reviews, the TikTok feed):
   * React owns the head it server-rendered, and a foreign node appended there
   * is a hydration mismatch waiting to happen the next time the head
   * re-renders. Nothing about a tag requires it to live in the head.
   */
  useEffect(() => {
    const scripts = analyticsVendorScripts({ga4Id, metaPixelId});
    if (!scripts.length) return;

    const controller = new AbortController();
    let idleHandle: number | undefined;

    const load = () => {
      controller.abort(); // drops the interaction listeners with one call
      if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
      for (const {id, src} of scripts) {
        if (document.getElementById(id)) continue;
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
      }
    };

    // Same interaction set as ChatWidget, for the same reason: pointermove
    // catches desktop, pointerdown touch, and the other two keyboard and
    // reading.
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'scroll']) {
      window.addEventListener(type, load, {
        passive: true,
        signal: controller.signal,
      });
    }

    // Safari only shipped requestIdleCallback in 16.4 — the timer is the
    // fallback, at roughly the deadline the idle timeout would have enforced.
    if (window.requestIdleCallback) {
      idleHandle = window.requestIdleCallback(load, {timeout: 5000});
    } else {
      const timer = window.setTimeout(load, 5000);
      controller.signal.addEventListener('abort', () =>
        window.clearTimeout(timer),
      );
    }

    return () => {
      controller.abort();
      if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
    };
  }, [ga4Id, metaPixelId]);

  useEffect(() => {
    /**
     * Every path out of here has to reach `ready()`. The provider holds each
     * published event until all registered subscribers report ready, so a
     * bridge that registers and then returns early strands Shopify's own
     * analytics behind it — the store's admin reporting would go quiet because
     * of third-party tag plumbing. That is why an unconfigured storefront still
     * reports ready instead of skipping registration.
     *
     * Nothing below can throw before that call: `subscribe` only writes to a
     * map, and Hydrogen wraps each callback in its own try/catch when it
     * publishes, so a mapping bug surfaces as one console error rather than a
     * dead analytics pipeline.
     */
    if (!ga4Id && !metaPixelId) {
      readyRef.current();
      return;
    }

    const currency = shop?.currency ?? 'USD';

    /**
     * Mirror Shopify's consent state into Google Consent Mode v2 and Meta.
     * Called at the top of every send rather than once on mount: it is a string
     * comparison after the first call, and it guarantees the tags know the
     * visitor's choice before the first event is measured, without depending on
     * effect ordering between this component and Shopify's consent script.
     */
    function syncConsent() {
      const privacy = consentApi();
      const analytics = privacy?.analyticsProcessingAllowed() ?? false;
      const marketing = privacy?.marketingAllowed() ?? false;
      const state = `${analytics}|${marketing}`;
      if (state === lastConsent.current) return;
      lastConsent.current = state;

      window.gtag?.('consent', 'update', {
        analytics_storage: analytics ? 'granted' : 'denied',
        ad_storage: marketing ? 'granted' : 'denied',
        ad_user_data: marketing ? 'granted' : 'denied',
        ad_personalization: marketing ? 'granted' : 'denied',
      });
      window.fbq?.('consent', marketing ? 'grant' : 'revoke');
    }

    function ga4(event: string, params: Record<string, unknown>) {
      if (!ga4Id) return;
      syncConsent();
      window.gtag?.('event', event, params);
    }

    /**
     * Meta is gated on *marketing* consent, which is a separate choice from the
     * analytics consent Hydrogen's provider already enforces. A visitor may
     * allow measurement and refuse advertising; GA4 should still hear about
     * them and Meta should not.
     */
    function meta(event: string, params?: Record<string, unknown>) {
      if (!metaPixelId || !marketingAllowed()) return;
      syncConsent();
      window.fbq?.('track', event, params);
    }

    subscribe('page_viewed', (payload: PageViewPayload) => {
      ga4('page_view', {
        page_location: payload.url,
        page_title: document.title,
      });
      meta('PageView');
    });

    subscribe('product_viewed', (payload: ProductViewPayload) => {
      const items = payload.products.map((product) => itemFromProduct(product));
      if (!items.length) return;

      ga4('view_item', {currency, value: totalValue(items), items});
      meta('ViewContent', {
        content_type: 'product',
        content_ids: items.map((item) => item.item_id),
        content_name: items[0].item_name,
        contents: metaContents(items),
        currency,
        value: totalValue(items),
      });
    });

    subscribe('collection_viewed', (payload: CollectionViewPayload) => {
      // The collection route passes its visible products through `customData`;
      // Hydrogen's own payload carries only the collection id and handle, and a
      // `view_item_list` with no items populates no report in GA4.
      const products = (payload.customData?.products ??
        []) as ProductViewPayload['products'];
      const listId = payload.collection.handle;

      ga4('view_item_list', {
        item_list_id: listId,
        item_list_name: listId,
        items: products.map((product, index) => ({
          ...itemFromProduct(product, index),
          item_list_id: listId,
          item_list_name: listId,
        })),
      });
    });

    subscribe('search_viewed', (payload: SearchViewPayload) => {
      ga4('search', {search_term: payload.searchTerm});
      meta('Search', {search_string: payload.searchTerm});
    });

    subscribe('cart_viewed', (payload: CartViewPayload) => {
      const lines = (payload.cart?.lines?.nodes ?? []) as CartLineish[];
      const items = lines.map((line) => itemFromLine(line, line.quantity ?? 1));

      ga4('view_cart', {
        currency: payload.cart?.cost?.totalAmount?.currencyCode ?? currency,
        value: amount(payload.cart?.cost?.totalAmount?.amount),
        items,
      });
    });

    subscribe('product_added_to_cart', (payload: CartLineUpdatePayload) => {
      const current = payload.currentLine as CartLineish | undefined;
      const previous = payload.prevLine as CartLineish | undefined;
      // Hydrogen fires this both for a brand-new line (no prevLine) and for a
      // quantity increase on an existing one, so the added amount is the delta,
      // not the line's new total.
      const added = (current?.quantity ?? 0) - (previous?.quantity ?? 0);
      if (added <= 0) return;

      const items = [itemFromLine(current, added)];
      ga4('add_to_cart', {currency, value: totalValue(items), items});
      meta('AddToCart', {
        content_type: 'product',
        content_ids: items.map((item) => item.item_id),
        content_name: items[0].item_name,
        contents: metaContents(items),
        currency,
        value: totalValue(items),
      });
    });

    subscribe('product_removed_from_cart', (payload: CartLineUpdatePayload) => {
      const current = payload.currentLine as CartLineish | undefined;
      const previous = payload.prevLine as CartLineish | undefined;
      const removed = (previous?.quantity ?? 0) - (current?.quantity ?? 0);
      if (removed <= 0) return;

      const items = [itemFromLine(previous ?? current, removed)];
      ga4('remove_from_cart', {currency, value: totalValue(items), items});
    });

    /**
     * Everything Hydrogen has no event for — card clicks, newsletter signups,
     * appointment requests, wishlist adds — is published as a custom event by
     * the component that owns the interaction and mapped here. `custom_ga4` is
     * a single channel rather than one subscription per event so that adding
     * the next one is a one-line change at the call site.
     */
    subscribe('custom_ga4', (payload) => {
      const event = payload.event as string | undefined;
      if (!event) return;

      const params = {...((payload.params ?? {}) as Record<string, unknown>)};

      // A caller passes products in Hydrogen's own product-payload shape and
      // they are mapped to GA4 items here — the same mapper `view_item` and
      // `add_to_cart` use. Building items at the call site instead would put a
      // second definition of "what a product looks like" in the codebase, and
      // the two would eventually disagree about the ID.
      const products = payload.products as
        | ProductViewPayload['products']
        | undefined;
      if (products?.length) {
        params.items = products.map((product, index) =>
          itemFromProduct(product, index),
        );
      }

      ga4(event, params);

      // Meta only hears about a custom event if the caller names one — most
      // are GA4-only. When it does, the product block is derived from the same
      // items GA4 just got, so a caller never has to know Meta's `contents` /
      // `content_ids` shape or which ID matches the catalogue.
      const metaEvent = payload.metaEvent as string | undefined;
      if (!metaEvent) return;

      const metaParams = {
        ...((payload.metaParams ?? {}) as Record<string, unknown>),
      };
      const items = params.items as Ga4Item[] | undefined;
      if (items?.length) {
        metaParams.content_type ??= 'product';
        metaParams.content_ids ??= items.map((item) => item.item_id);
        metaParams.contents ??= metaContents(items);
        metaParams.content_name ??= items[0].item_name;
        metaParams.currency ??= currency;
        metaParams.value ??= totalValue(items);
      }
      meta(metaEvent, metaParams);
    });

    readyRef.current();
    // `subscribe` is a module-level function in Hydrogen, so this list is
    // genuinely stable and the effect runs once per configuration change
    // rather than once per render. Re-running it would be harmless anyway —
    // subscriptions are keyed by callback source, so re-subscribing the same
    // handler replaces it instead of doubling every event — but "harmless"
    // is a bad thing to rely on for something that fires on every render.
  }, [subscribe, shop?.currency, ga4Id, metaPixelId]);

  return null;
}
