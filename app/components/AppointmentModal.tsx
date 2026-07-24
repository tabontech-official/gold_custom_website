import {useEffect, useRef, useState} from 'react';
import {useFetcher} from 'react-router';

type ProductInfo = {
  title: string;
  handle: string;
  id: string;
  variantInfo: string; // SKU / variant title, best-effort
};

type ActionResult =
  | {ok: true}
  | {ok: false; error?: string; errors?: Record<string, string>};

/**
 * "Book Private Consultation" button + modal for the product page. Captures
 * product context automatically; posts to /api/appointment. Booking success,
 * field errors, and server errors are all driven off the fetcher.
 */
export function AppointmentModal({product}: {product: ProductInfo}) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<ActionResult>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const submitting = fetcher.state !== 'idle';
  const result = fetcher.data;
  const succeeded = result?.ok === true;
  const fieldErrors = result && !result.ok ? result.errors : undefined;
  const formError = result && !result.ok ? result.error : undefined;

  // Close on Escape; lock body scroll while open; focus the first field.
  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Today, in the browser's local date, for the date input's `min`.
  const todayLocal = new Date();
  const minDate = `${todayLocal.getFullYear()}-${String(
    todayLocal.getMonth() + 1,
  ).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;

  return (
    <>
      <button
        type="button"
        className="btn product-book-consult"
        onClick={() => setOpen(true)}
      >
        Book Private Consultation
      </button>

      {open && (
        <div
          className="appt-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Book a private consultation"
          onMouseDown={(e) => {
            if (e.target === dialogRef.current?.parentElement) setOpen(false);
          }}
        >
          <button
            className="appt-overlay-scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="appt-modal" ref={dialogRef}>
            <button
              type="button"
              className="appt-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>

            {succeeded ? (
              <div className="appt-success">
                <div className="appt-success-mark" aria-hidden="true">
                  <svg viewBox="0 0 52 52">
                    <circle cx="26" cy="26" r="24" fill="none" />
                    <path fill="none" d="M15 27l7 7 15-16" />
                  </svg>
                </div>
                <h2>Request received</h2>
                <p>
                  Your private consultation request has been received. Our
                  jewelry specialist will contact you shortly.
                </p>
                <button
                  type="button"
                  className="btn product-book-consult"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <header className="appt-head">
                  <span className="appt-eyebrow">By Appointment</span>
                  <h2>Book a Private Consultation</h2>
                  <p className="appt-piece">{product.title}</p>
                </header>

                <fetcher.Form method="post" action="/api/appointment" noValidate>
                  <input type="hidden" name="productTitle" value={product.title} />
                  <input type="hidden" name="productHandle" value={product.handle} />
                  <input type="hidden" name="productId" value={product.id} />
                  <input
                    type="hidden"
                    name="variantInfo"
                    value={product.variantInfo}
                  />

                  <label className="appt-field">
                    <span>Full Name</span>
                    <input
                      ref={firstFieldRef}
                      type="text"
                      name="name"
                      autoComplete="name"
                      required
                      aria-invalid={Boolean(fieldErrors?.name)}
                    />
                    {fieldErrors?.name && (
                      <em className="appt-error">{fieldErrors.name}</em>
                    )}
                  </label>

                  <label className="appt-field">
                    <span>Email Address</span>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      aria-invalid={Boolean(fieldErrors?.email)}
                    />
                    {fieldErrors?.email && (
                      <em className="appt-error">{fieldErrors.email}</em>
                    )}
                  </label>

                  <label className="appt-field">
                    <span>Preferred Date</span>
                    <input
                      type="date"
                      name="date"
                      min={minDate}
                      required
                      aria-invalid={Boolean(fieldErrors?.date)}
                    />
                    {fieldErrors?.date && (
                      <em className="appt-error">{fieldErrors.date}</em>
                    )}
                  </label>

                  {formError && <p className="appt-form-error">{formError}</p>}

                  <button
                    type="submit"
                    className="btn product-book-consult appt-submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Sending…' : 'Request Consultation'}
                  </button>
                  <p className="appt-fineprint">
                    A specialist will reach out to confirm your appointment.
                  </p>
                </fetcher.Form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
