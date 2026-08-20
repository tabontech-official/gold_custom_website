import {useEffect, useRef} from 'react';

const ELFSIGHT_SCRIPT_ID = 'elfsight-platform-script';
const ELFSIGHT_SCRIPT_SRC = 'https://elfsightcdn.com/platform.js';
const ELFSIGHT_WIDGET_ID = 'elfsight-app-40ff83f5-944e-4864-91a0-16bd2dddc311';

export function GoogleReviewsSection() {
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

  /**
   * Elfsight renders its own "Google Reviews" heading, which duplicates the
   * one this page already has. There is no config for it and no stable class
   * to target, so it is found by its text.
   *
   * The scan is coalesced into one animation frame. It used to run on EVERY
   * mutation, and each run was `querySelectorAll('*')` plus a `textContent`
   * read over the whole subtree — an O(nodes) walk. Elfsight mounts several
   * hundred nodes and then keeps mutating them (lazy avatars, carousel
   * transforms, star fills), so the observer was re-walking the entire widget
   * dozens of times per second on the main thread. That is most of why the
   * section felt slow to appear: the work was ours, not theirs.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const section = document.querySelector('.google-reviews-section');
    if (!section) return;

    let frame = 0;

    const applyReviewLayout = () => {
      frame = 0;
      section.querySelectorAll<HTMLElement>('*').forEach((element) => {
        const text = element.textContent?.trim();
        if (text === 'Google Reviews' || text === 'What Our Customers Say') {
          element.classList.add('google-reviews-hidden-heading');
        }
      });
    };

    const scheduleScan = () => {
      if (frame) return;
      frame = requestAnimationFrame(applyReviewLayout);
    };

    applyReviewLayout();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(section, {childList: true, subtree: true});

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="home-section google-reviews-section">
      <div className="section-inner">
        <div
          className="google-reviews-stage"
          aria-label="Google reviews grid"
          ref={stage}
        >
          <div
            className={ELFSIGHT_WIDGET_ID}
            data-elfsight-app-lazy=""
            aria-live="polite"
          />
        </div>
      </div>
    </section>
  );
}
