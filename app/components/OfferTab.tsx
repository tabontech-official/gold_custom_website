import {useEffect, useState} from 'react';
import {SignupModal} from '~/components/SignupModal';

/**
 * Permanent way back to the 10%-off offer once the announcement bar is gone —
 * the bar is dismissible and the offer shouldn't disappear with it.
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
      <SignupModal
        triggerLabel={
          <>
            Get <strong>10%</strong> off
          </>
        }
        triggerClassName="offer-tab-btn"
        autoOpenAfterMs={6000}
      />
      <button
        type="button"
        className="offer-tab-close"
        aria-label="Dismiss the 10% off offer"
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
