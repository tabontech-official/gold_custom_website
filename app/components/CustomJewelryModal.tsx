import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useFetcher} from 'react-router';
import {useTrackConversion} from '~/hooks/useTrackConversion';

type ActionResult =
  | {ok: true}
  | {ok: false; error?: string; errors?: Record<string, string>};

const PRODUCT_TYPES = [
  'Pendant',
  'Bridal',
  'Rings',
  'Chain',
  'Earrings',
  'Bracelet',
  'Watch',
  'Other',
];

/**
 * "Start your design" button + modal — a dedicated custom-piece inquiry,
 * separate from AppointmentModal's date-booking flow. Same shell/CSS
 * (.appt-*), same fetcher/success-state pattern, posts to
 * /api/custom-jewelry instead.
 *
 * multipart/form-data, not the plain POST AppointmentModal uses — the
 * optional reference photo needs it. fetcher.submit takes the raw FormData
 * directly rather than fetcher.Form, since a controlled file input has to be
 * read from the DOM at submit time either way.
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
  const [fileName, setFileName] = useState('');
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
    setFileName('');
    formRef.current?.reset();
  }, [succeeded]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetcher.submit(new FormData(event.currentTarget), {
      method: 'post',
      action: '/api/custom-jewelry',
      encType: 'multipart/form-data',
    });
  }

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

                  <form
                    ref={formRef}
                    onSubmit={handleSubmit}
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

                    <label className="appt-field">
                      <span>Supporting Document (optional)</span>
                      <span className="cj-file-row">
                        <input
                          type="file"
                          name="document"
                          accept="image/*,.pdf"
                          className="cj-file-input"
                          onChange={(e) =>
                            setFileName(e.currentTarget.files?.[0]?.name ?? '')
                          }
                        />
                        {fileName && (
                          <span className="cj-file-name">{fileName}</span>
                        )}
                      </span>
                      {fieldErrors?.document && (
                        <em className="appt-error">{fieldErrors.document}</em>
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
                  </form>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
