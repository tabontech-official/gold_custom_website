import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useFetcher} from 'react-router';
import {useTrackConversion} from '~/hooks/useTrackConversion';
import {CATEGORY_SPECS, PRODUCT_TYPES} from '~/lib/customDesignOptions';

type ActionResult =
  | {ok: true}
  | {ok: false; error?: string; errors?: Record<string, string>};

/**
 * "Start your design" button + modal — a dedicated custom-piece inquiry,
 * separate from AppointmentModal's date-booking flow. Same shell/CSS
 * (.appt-*), same fetcher/success-state pattern, posts to
 * /api/custom-jewelry instead.
 *
 * The reference image posts as multipart and lands in Shopify Files (then
 * the customer's custom.gallery metafield) — it never enters the email, so
 * EmailJS's 50Kb request cap that once forced this field's removal no
 * longer applies.
 */
export function CustomJewelryModal({
  triggerLabel = 'Start your design',
  triggerClassName = 'btn btn-primary svc-cta',
}: {
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [productType, setProductType] = useState('');
  const fetcher = useFetcher<ActionResult>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMounted(true), []);

  const submitting = fetcher.state !== 'idle';
  const result = fetcher.data;
  const succeeded = result?.ok === true;

  useTrackConversion(succeeded, 'generate_lead', 'custom_jewelry', 'Lead');
  const fieldErrors = result && !result.ok ? result.errors : undefined;
  const formError = result && !result.ok ? result.error : undefined;

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

  // Reset for the next time the modal opens, once a request actually succeeds.
  useEffect(() => {
    if (!succeeded) return;
    setProductType('');
    formRef.current?.reset();
  }, [succeeded]);

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
            aria-label="Request custom jewelry"
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
                    Your custom jewelry request has been received. A designer
                    will reach out to talk through your idea.
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
                    <span className="appt-eyebrow">Custom Order</span>
                    <h2>Request Custom Jewelry</h2>
                  </header>

                  <fetcher.Form
                    ref={formRef}
                    method="post"
                    action="/api/custom-jewelry"
                    encType="multipart/form-data"
                    noValidate
                  >
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
                      <span>Phone</span>
                      <input
                        type="tel"
                        name="contact"
                        autoComplete="tel"
                        placeholder="(201) 555-0123"
                        required
                        aria-invalid={Boolean(fieldErrors?.contact)}
                      />
                      {fieldErrors?.contact && (
                        <em className="appt-error">{fieldErrors.contact}</em>
                      )}
                    </label>

                    <div className="appt-field">
                      <span>What kind of custom piece are you wanting to make?</span>
                      <input type="hidden" name="productType" value={productType} />
                      <div
                        className="cj-type-grid"
                        role="radiogroup"
                        aria-invalid={Boolean(fieldErrors?.productType)}
                      >
                        {PRODUCT_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            role="radio"
                            aria-checked={productType === type}
                            className={`cj-type-btn${productType === type ? ' is-selected' : ''}`}
                            onClick={() => setProductType(type)}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                      {fieldErrors?.productType && (
                        <em className="appt-error">{fieldErrors.productType}</em>
                      )}
                    </div>

                    {/* key={productType} remounts the selects, so switching
                        category never carries over a stale selection. */}
                    {productType && (
                      <div className="cj-spec-grid" key={productType}>
                        {(CATEGORY_SPECS[productType] ?? []).map((field) => (
                          <label className="appt-field" key={field.key}>
                            <span>{field.label}</span>
                            <select
                              name={`spec_${field.key}`}
                              required
                              defaultValue=""
                              aria-invalid={Boolean(
                                fieldErrors?.[`spec_${field.key}`],
                              )}
                            >
                              <option value="" disabled>
                                Select…
                              </option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            {fieldErrors?.[`spec_${field.key}`] && (
                              <em className="appt-error">
                                {fieldErrors[`spec_${field.key}`]}
                              </em>
                            )}
                          </label>
                        ))}
                      </div>
                    )}

                    <label className="appt-field">
                      <span>Reference Image (optional)</span>
                      <input
                        type="file"
                        name="image"
                        accept="image/*"
                        aria-invalid={Boolean(fieldErrors?.image)}
                      />
                      {fieldErrors?.image && (
                        <em className="appt-error">{fieldErrors.image}</em>
                      )}
                    </label>

                    <label className="appt-field">
                      <span>Description</span>
                      <textarea
                        name="description"
                        rows={3}
                        placeholder="Metal, stones, size, inspiration — anything you have in mind…"
                        required
                        aria-invalid={Boolean(fieldErrors?.description)}
                      />
                      {fieldErrors?.description && (
                        <em className="appt-error">{fieldErrors.description}</em>
                      )}
                    </label>

                    {formError && <p className="appt-form-error">{formError}</p>}

                    <button
                      type="submit"
                      className="btn product-book-consult appt-submit"
                      disabled={submitting}
                    >
                      {submitting ? 'Sending…' : 'Submit Request'}
                    </button>
                    <p className="appt-fineprint">
                      A designer will reach out to talk through your idea.
                    </p>
                  </fetcher.Form>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
