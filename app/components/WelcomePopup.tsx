import {useEffect, useState} from 'react';
import {useFetcher} from 'react-router';
import {useTrackConversion} from '~/hooks/useTrackConversion';

const STORAGE_KEY = 'welcome-popup-seen';
// ponytail: code is hardcoded — WELCOME10 is the store's active first-order
// discount and the Storefront API can't read discount codes. Update here if
// the discount changes in admin.
const WELCOME_CODE = 'WELCOME10';

// First-visit popup offering the welcome discount for joining the list.
// Shows once (localStorage) after a delay.
//
// 8s, not the 2.5s it was. The timer starts at hydration, and on a throttled
// phone hydration lands while the product photo is still arriving — so the old
// delay put a full-screen overlay on top of the page mid-LCP, over a shopper
// who had not yet seen what they came for. 8s clears the load on a slow
// connection and is still well inside a real browsing session.
//
// ponytail: a plain timer. Scroll depth or exit intent target the offer better,
// but they are a behavioural change to argue about with whoever owns the
// discount, not a performance fix — this is the part that was costing speed.
const SHOW_AFTER_MS = 8000;

export function WelcomePopup() {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<{success?: boolean; error?: string}>();
  const subscribed = Boolean(fetcher.data?.success);

  // Same event as the footer form, different `method` — GA4 breaks sign-ups
  // down by it, which is the only way to tell whether the popup is earning the
  // interruption it costs.
  useTrackConversion(subscribed, 'sign_up', 'welcome_popup', 'Lead');

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Once subscribed, never show again — even if they close the tab
  // without dismissing.
  useEffect(() => {
    if (subscribed) localStorage.setItem(STORAGE_KEY, '1');
  }, [subscribed]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="welcome-popup-overlay" onClick={dismiss}>
      <div
        className="welcome-popup"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome offer"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="welcome-popup-close"
          onClick={dismiss}
          aria-label="Close"
        >
          &times;
        </button>

        {subscribed ? (
          <>
            <h2>Welcome to the Family</h2>
            <p>Use this code at checkout for 10% off your first order:</p>
            <p className="welcome-popup-code">{WELCOME_CODE}</p>
            <button type="button" className="btn btn-primary" onClick={dismiss}>
              Start Shopping
            </button>
          </>
        ) : (
          <>
            <span className="welcome-popup-eyebrow">Welcome Offer</span>
            <h2>Get 10% Off Your First Order</h2>
            <p>
              Join our list for early access to new collections and private
              offers.
            </p>
            <fetcher.Form
              method="post"
              action="/api/subscribe"
              className="welcome-popup-form"
            >
              <input
                type="email"
                name="email"
                placeholder="Email address"
                aria-label="Email address"
                required
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={fetcher.state !== 'idle'}
              >
                {fetcher.state === 'idle' ? 'Claim 10% Off' : 'Sending…'}
              </button>
            </fetcher.Form>
            {fetcher.data?.error ? (
              <p className="welcome-popup-error">{fetcher.data.error}</p>
            ) : null}
            <button
              type="button"
              className="welcome-popup-dismiss"
              onClick={dismiss}
            >
              No thanks
            </button>
          </>
        )}
      </div>
    </div>
  );
}
