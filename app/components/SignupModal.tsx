import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {useFetcher} from 'react-router';
import {useTrackConversion} from '~/hooks/useTrackConversion';

/**
 * "Get 10% off" email capture, opened from the announcement bar.
 *
 * Posts to the same /api/subscribe the footer form uses — one subscribe
 * endpoint, one list. Chrome (overlay, scrim, close, fields) reuses the
 * appointment modal's classes rather than a second set of near-identical CSS.
 */
export function SignupModal({
  triggerLabel,
  triggerClassName,
  autoOpenAfterMs,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  /** Open the modal unprompted, once per session, this long after mount. */
  autoOpenAfterMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fetcher = useFetcher<{success?: boolean; error?: string}>();
  const busy = fetcher.state !== 'idle';
  const succeeded = Boolean(fetcher.data?.success);

  useEffect(() => setMounted(true), []);

  // Once a visit, not once a page view — without the flag the offer would
  // reopen on every route change, which is how a welcome popup turns into a
  // reason to leave.
  useEffect(() => {
    if (!autoOpenAfterMs) return;
    if (sessionStorage.getItem('gc-offer-shown')) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem('gc-offer-shown', '1');
      setOpen(true);
    }, autoOpenAfterMs);
    return () => window.clearTimeout(timer);
  }, [autoOpenAfterMs]);
  useTrackConversion(succeeded, 'sign_up', 'announcement_offer', 'Lead');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="appt-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Sign up and get 10% off"
          >
            <button
              className="appt-overlay-scrim"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <div className="appt-modal">
              <button
                type="button"
                className="appt-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>

              {!succeeded && (
                <header className="appt-head">
                  <span className="appt-eyebrow">Gold Custom Club</span>
                  <h2>Take 10% off your first order</h2>
                  <p className="appt-piece">
                    Join for the code, plus first look at new drops and private
                    offers.
                  </p>
                </header>
              )}

              {succeeded ? (
                <div className="appt-success signup-welcome">
                  <div className="appt-success-mark" aria-hidden="true">
                    <svg viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r="24" fill="none" />
                      <path fill="none" d="M15 27l7 7 15-16" />
                    </svg>
                  </div>
                  <h2>Done</h2>
                  <p>Your discount code has been sent to your inbox.</p>
                  <button
                    type="button"
                    className="btn product-book-consult appt-submit"
                    onClick={() => setOpen(false)}
                  >
                    Start shopping
                  </button>
                </div>
              ) : (
                <fetcher.Form
                  method="post"
                  action="/api/subscribe"
                  className="signup-form"
                >
                  <label className="appt-field">
                    <span>Email Address</span>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                    />
                  </label>
                  {fetcher.data?.error ? (
                    <em className="appt-error">{fetcher.data.error}</em>
                  ) : null}
                  <button
                    className="btn product-book-consult appt-submit"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? 'Joining' : 'Get my 10% off'}
                  </button>
                  <p className="signup-note">
                    By joining, you agree to receive occasional Gold Custom
                    emails. Unsubscribe anytime.
                  </p>
                </fetcher.Form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
