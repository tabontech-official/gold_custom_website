import {useEffect} from 'react';

const TIDIO_SCRIPT_ID = 'tidio-chat-script';
/** Public widget key — it ships in the storefront's HTML, it isn't a secret. */
const TIDIO_SCRIPT_SRC =
  'https://code.tidio.co/rstwyrly4vojjuoxkz9om5z3mr9q5kx9.js';

/**
 * Tidio live chat — the same widget, inbox and agents the Liquid storefront
 * uses. There the tag arrives from the Tidio app's theme app extension, which
 * Hydrogen has no equivalent of, so the storefront loads it itself.
 *
 * Held back until the visitor does something, because the widget pulls a few
 * hundred KB of script plus webfonts and notification audio. Loading it during
 * first paint would spend the page's LCP budget on a button nobody has clicked
 * yet; the Liquid storefront defers it the same way.
 */
export function ChatWidget() {
  useEffect(() => {
    if (document.getElementById(TIDIO_SCRIPT_ID)) return;

    const controller = new AbortController();
    const load = () => {
      controller.abort(); // drops the sibling listeners with one call
      if (document.getElementById(TIDIO_SCRIPT_ID)) return;

      const script = document.createElement('script');
      script.id = TIDIO_SCRIPT_ID;
      script.src = TIDIO_SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    };

    // ponytail: any first interaction counts — pointermove for desktop,
    // pointerdown for touch, and the other two for keyboard and reading.
    // No scroll-depth or dwell-time heuristics until this demonstrably
    // misses conversations.
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'scroll']) {
      window.addEventListener(type, load, {
        passive: true,
        signal: controller.signal,
      });
    }

    return () => controller.abort();
  }, []);

  return null;
}
