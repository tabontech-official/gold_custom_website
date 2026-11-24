import {useEffect, useRef} from 'react';

const ELFSIGHT_SCRIPT_ID = 'elfsight-platform-script';
const ELFSIGHT_SCRIPT_SRC = 'https://elfsightcdn.com/platform.js';
const ELFSIGHT_WIDGET_ID = 'elfsight-app-40ff83f5-944e-4864-91a0-16bd2dddc311';
const REVIEW_PREVIEW_CONTROL = '.es-carousel-item .es-text-shortener-control-open';

export function GoogleReviewsSection({
  productPage = false,
}: {
  productPage?: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);

  /**
   * Elfsight is 547 KB of third-party script — a 15 KB loader that then pulls a
   * 527 KB reviews bundle — for a widget that sits at the very bottom of the
   * page, below the FAQs and the "You May Also Like" rail. Injecting it on
   * mount spent the product page's whole bandwidth budget on reviews nobody had
   * scrolled to, on the one connection the LCP image was waiting for.
   *
   * `data-elfsight-app-lazy` does not cover this: that only defers Elfsight's
   * own rendering, after its bundle has already landed.
   *
   * So the request is held until the section is within a screen of showing up.
   * Same deferral the chat widget uses, keyed on scroll position rather than
   * first interaction — a shopper who never scrolls this far never pays for it,
   * and one who does gets it loading a viewport ahead of the reveal.
   */
  useEffect(() => {
    const el = stage.current;
    if (!el || document.getElementById(ELFSIGHT_SCRIPT_ID)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (document.getElementById(ELFSIGHT_SCRIPT_ID)) return;

        const script = document.createElement('script');
        script.id = ELFSIGHT_SCRIPT_ID;
        script.src = ELFSIGHT_SCRIPT_SRC;
        script.async = true;
        document.body.appendChild(script);
      },
      // One viewport of runway, so the widget is usually painted by the time
      // the section is actually reached.
      {rootMargin: '100% 0px'},
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;

    const labelReviewControls = () => {
      for (const control of element.querySelectorAll(REVIEW_PREVIEW_CONTROL)) {
        // Keep Elfsight's keyboard handlers and full-review dialog attached.
        const label = control.firstChild;
        if (label?.nodeValue === 'Read more') label.nodeValue = 'Load more';
      }
    };

    labelReviewControls();
    const observer = new MutationObserver(labelReviewControls);
    observer.observe(element, {childList: true, subtree: true});
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={
        productPage
          ? 'google-reviews-section product-google-reviews'
          : 'home-section google-reviews-section'
      }
      aria-label="Google reviews"
    >
      <div className="section-inner">
        <div
          className={`google-reviews-stage${productPage ? ' pdp-card' : ''}`}
          ref={stage}
        >
          {/* No aria-live: Elfsight mounts and rotates hundreds of nodes in
              here, and a live region read every one of them aloud. */}
          <div className={ELFSIGHT_WIDGET_ID} data-elfsight-app-lazy="" />
        </div>
      </div>
    </section>
  );
}

