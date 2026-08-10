import {useEffect, useRef} from 'react';

const REPUTON_SCRIPT_ID = 'reputon-tiktok-script';
/** Shop domain is public — it ships in every storefront URL, it isn't a secret. */
const SHOP_DOMAIN = 'goldcustomedo.myshopify.com';
const REPUTON_SCRIPT_SRC = `https://cdn.ttw.reputon.com/assets/widget.js?shop=${SHOP_DOMAIN}`;

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

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

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
         * `window.Shopify = {...}`. Shopify's consent-tracking script installs
         * `Shopify` as an accessor on `window` whose setter DISCARDS whatever
         * it is handed, to protect its own object. So a replacement lands only
         * while that script is still in flight — which is exactly why this used
         * to work on a reload and not on a cold first load, and why the feed
         * fetched `?shop=undefined`.
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
      },
      {rootMargin: '100% 0px'},
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="home-section tiktok-feed-section">
      <div className="section-inner">
        <div
          ref={stage}
          className="reputon-tiktok-widget"
          data-content-index="1"
          data-autoscroll="true"
          data-autoplay="off"
          data-type="carousel"
          data-theme="light"
          data-show-header="true"
        />
      </div>
    </section>
  );
}
