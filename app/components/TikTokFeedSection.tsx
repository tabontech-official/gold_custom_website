import {useEffect, useRef} from 'react';

const REPUTON_SCRIPT_ID = 'reputon-tiktok-script';
/** Shop domain is public — it ships in every storefront URL, it isn't a secret. */
const SHOP_DOMAIN = 'goldcustomedo.myshopify.com';
const REPUTON_SCRIPT_SRC = `https://cdn.ttw.reputon.com/assets/widget.js?shop=${SHOP_DOMAIN}`;
/** How long the feed waits for Hydrogen's consent setup before loading anyway. */
const SHOPIFY_GLOBAL_TIMEOUT_MS = 10_000;

/**
 * True once this file may touch `window.Shopify` — see mountWidget below for
 * why that has to wait. Either Hydrogen has put its watcher on the global (an
 * accessor property on `window`), or Shopify's consent API has already
 * attached to it.
 */
function shopifyGlobalReady() {
  const w = window as unknown as {Shopify?: {customerPrivacy?: unknown}};
  return Boolean(
    w.Shopify?.customerPrivacy ||
    Object.getOwnPropertyDescriptor(window, 'Shopify')?.get,
  );
}

/**
 * Runs `fn` as soon as shopifyGlobalReady(), or after the timeout so a blocked
 * consent script can never hide the feed. Returns a cancel for unmount.
 */
function whenShopifyGlobalReady(fn: () => void): () => void {
  const started = Date.now();
  let timer = 0;
  const check = () => {
    if (
      shopifyGlobalReady() ||
      Date.now() - started >= SHOPIFY_GLOBAL_TIMEOUT_MS
    ) {
      fn();
    } else {
      timer = window.setTimeout(check, 200);
    }
  };
  check();
  return () => window.clearTimeout(timer);
}

/**
 * Reputon TikTok feed. On the Liquid storefront the tag arrives from the app's
 * theme extension; Hydrogen has no equivalent, so the storefront loads it.
 *
 * Deferred to a viewport of runway the same way the reviews widget is — the
 * carousel autoplays video, so fetching it during first paint would spend the
 * LCP budget on clips nobody has scrolled to. The div is in the markup from the
 * start so the widget script finds its mount the moment it lands.
 */
export function TikTokFeedSection() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;

    let cancelWait = () => {};

    const mountWidget = () => {
      /**
       * widget.js scans for its containers once, at the bottom of the bundle,
       * and exposes no re-init hook — no history listener, no observer of its
       * own. So on a client-side navigation back to the homepage React hands
       * it a fresh empty div that nothing ever mounts into, and the section
       * renders blank. Dropping the old tag and appending a new one re-runs
       * that scan; the bundle and the widget's own content fetch are both
       * cached by then, so this costs parse time, not requests.
       *
       * ponytail: re-executing appends another copy of the widget's
       * stylesheet each time. It is a few KB per homepage visit — swap this
       * for a persistent portal outside the router only if that adds up.
       */
      document.getElementById(REPUTON_SCRIPT_ID)?.remove();

      /**
       * widget.js fetches its clips from
       * `ttw.reputon.com/app/storefront/content?shop=` + `Shopify.shop`. That
       * global comes from Liquid's theme layout, which Hydrogen has no
       * equivalent of, so the storefront has to supply it. The `?shop=` on
       * the script src is not a fallback — the bundle never reads it.
       *
       * It has to be a mutation of the existing object, never
       * `window.Shopify = {...}`. Hydrogen's consent setup
       * (useCustomerPrivacy) installs `Shopify` as an accessor on `window`
       * whose setter keeps only an EMPTY object — the one Shopify's consent
       * script creates — and discards anything else. So a replacement lands
       * only while that setup is still pending, which is why the feed used
       * to fetch `?shop=undefined` on a cold first load.
       *
       * And it has to wait for that setup (whenShopifyGlobalReady). Hydrogen
       * installs its watcher only once the root loader's streamed `shop`
       * resolves. If this ran first, `{}` became a plain object the watcher
       * never sees; Shopify's consent script then reuses it and attaches
       * there, Hydrogen never learns the API loaded, and EVERY analytics
       * event for the visit — Shopify's, GA4's, Meta's — stays queued.
       * Homepage visits on a tall screen, where this section is within the
       * observer's margin on load, were the ones that tracked nothing.
       */
      // Hydrogen already declares `window.Shopify` for its own consent API,
      // so widen it rather than fight the ambient type over one extra key.
      const w = window as unknown as {Shopify?: {shop?: string}};
      if (!w.Shopify) w.Shopify = {};
      if (w.Shopify) w.Shopify.shop = SHOP_DOMAIN;

      const script = document.createElement('script');
      script.id = REPUTON_SCRIPT_ID;
      script.src = REPUTON_SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        cancelWait = whenShopifyGlobalReady(mountWidget);
      },
      {rootMargin: '100% 0px'},
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelWait();
    };
  }, []);

  return (
    <section className="home-section tiktok-feed-section">
      <div className="section-inner">
        {/* Heads the feed AND the social bar under it — one heading for the
            whole block, which is why SocialFollow carries none of its own.
            Reputon's header sits below this with the account handle and follow
            button; the two are spaced tight so they read as one unit rather
            than two headings. */}
        <div className="editorial-heading tiktok-feed-heading">
          <h2 className="editorial-title">Our Media</h2>
        </div>
        <div
          ref={stage}
          className="reputon-tiktok-widget"
          data-content-index="1"
          data-autoscroll="true"
          data-autoplay="off"
          data-type="carousel"
          data-theme="light"
          /* On: Reputon's own title bar is the section's heading — it carries
             the account handle and follow button, which a plain <h2> can't. The
             section has no heading of its own precisely so these don't stack. */
          data-show-header="true"
        />
      </div>
    </section>
  );
}
