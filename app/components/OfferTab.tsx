import {useEffect, useState} from 'react';
import {Link} from 'react-router';

/**
 * Floating shortcut to Black Friday deals after the announcement scrolls away.
 *
 * Its own dismissal is separate from the bar's and lives in sessionStorage,
 * same as the bar: gone for this visit, back on the next one.
 */
export function OfferTab() {
  const [visible, setVisible] = useState(false);

  // Mounted-gated so SSR never ships the tab and the stored dismissal is read
  // where sessionStorage exists.
  useEffect(() => {
    if (!sessionStorage.getItem('gc-offer-tab-dismissed')) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="offer-tab">
      <Link className="offer-tab-btn" to="/blackfriday" prefetch="intent">
        <span>Black Friday</span>
        <span>Up to <strong>50% off</strong></span>
      </Link>
      <button
        type="button"
        className="offer-tab-close"
        aria-label="Dismiss the Black Friday tab"
        onClick={() => {
          setVisible(false);
          sessionStorage.setItem('gc-offer-tab-dismissed', '1');
        }}
      >
        &times;
      </button>
    </div>
  );
}
