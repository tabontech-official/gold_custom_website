import {useEffect, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {useTrackConversion} from '~/hooks/useTrackConversion';
import {
  activeFields,
  CATEGORY_SPECS,
  PRODUCT_TYPES,
  type SpecField,
  type SpecOption,
} from '~/lib/customDesignOptions';

type ActionResult =
  | {ok: true}
  | {ok: false; error?: string; errors?: Record<string, string>};

/**
 * In-page custom-design builder, three phases: Design (guided tile steps),
 * Details (contact), Review (summary + description + submit). Posts to the
 * existing /api/custom-jewelry action.
 *
 * All three phase sections stay mounted inside one multipart form — hidden
 * with the `hidden` attribute rather than unmounted — so the contact inputs
 * and the file input keep their values while the shopper moves around.
 */

/**
 * Collection photos for the option circles, from the same endpoint the
 * header's circular sub-nav uses (collection image, else first product
 * image). Module-level cache: each handle is fetched once per page life,
 * shared across category switches. '' = fetched, nothing there.
 */
const imageCache: Record<string, string> = {};

function useCollectionImages(handles: string[]) {
  const [, bump] = useState(0);
  const key = handles.join(',');

  useEffect(() => {
    const missing = handles.filter((h) => !(h in imageCache));
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (handle) => {
        try {
          const res = await fetch(
            `/api/collection-products?handle=${encodeURIComponent(handle)}`,
          );
          const data = (await res.json()) as {products?: any[]; image?: any};
          const url =
            data?.image?.url ??
            data?.products?.find((product: any) => product?.featuredImage?.url)
              ?.featuredImage?.url ??
            '';
          // Shopify CDN resize — the circles are ~7rem, full-size is waste.
          imageCache[handle] = url
            ? `${url}${url.includes('?') ? '&' : '?'}width=320`
            : '';
        } catch {
          imageCache[handle] = '';
        }
      }),
    ).then(() => {
      if (!cancelled) bump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return imageCache;
}

/**
 * Outline icons for the five pieces. The dashed round-cap strokes read as
 * chain links / beads, matching the reference card set.
 */
function PieceIcon({piece}: {piece: string}) {
  // Inline style, not presentation attributes — the stylesheet's stroke-width
  // on .cdz-piece-icon would override an attribute, but not an inline style.
  const link = {
    style: {
      strokeWidth: 3.2,
      strokeDasharray: '0.5 5.4',
      strokeLinecap: 'round' as const,
    },
  };
  const drawings: Record<string, React.ReactNode> = {
    Ring: (
      <>
        <circle cx="17" cy="29" r="10.5" />
        <circle cx="31.5" cy="29" r="10.5" />
        <path d="M12.8 14.2 17 9l4.2 5.2L17 18.6z" />
      </>
    ),
    Chain: <path d="M12 7c0 19 4.5 27 12 27s12-8 12-27" {...link} />,
    Bracelet: (
      <>
        <circle cx="24" cy="27" r="14" {...link} />
        <circle cx="24" cy="13" r="3" />
      </>
    ),
    Earrings: (
      <>
        <circle cx="14.5" cy="25" r="8.5" {...link} />
        <circle cx="33.5" cy="25" r="8.5" {...link} />
        <path d="M14.5 13v3.2M33.5 13v3.2" />
      </>
    ),
    Pendant: (
      <>
        <circle cx="24" cy="9.5" r="3.4" />
        <path d="M22 12.6h4v3h-4z" />
        <rect x="13" y="15.5" width="22" height="25" rx="4.5" />
      </>
    ),
  };
  return (
    <svg className="cdz-piece-icon" viewBox="0 0 48 48" aria-hidden="true">
      {drawings[piece]}
    </svg>
  );
}

/** Named icons for icon-card options (SpecOption.icon). */
const OPTION_ICONS: Record<string, React.ReactNode> = {
  engagement: (
    <svg className="cdz-piece-icon" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="30" r="11" />
      <path d="M18 13.5 24 7l6 6.5-6 5z" />
    </svg>
  ),
  casual: (
    <svg className="cdz-piece-icon" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="18.5" cy="27" r="11" />
      <circle cx="31.5" cy="29" r="9" />
    </svg>
  ),
};

/**
 * One selectable tile. Photo steps (`photo`) drop the card box entirely —
 * just the circle with the label under it, like the header's circular
 * sub-nav; selection is the gold ring on the circle itself.
 */
function OptionTile({
  selected,
  onClick,
  image,
  fallbackIcon,
  option,
  photo = false,
  stackedRange = false,
}: {
  selected: boolean;
  onClick: () => void;
  image?: string;
  fallbackIcon?: React.ReactNode;
  option: SpecOption;
  photo?: boolean;
  /** Budget cards: min price on top, "to" in the middle, max below. */
  stackedRange?: boolean;
}) {
  return (
    <button
      type="button"
      className={`cdz-tile${selected ? ' is-selected' : ''}${
        photo
          ? ' cdz-tile-photo'
          : image || option.icon || fallbackIcon
            ? ' cdz-tile-media'
            : ''
      }`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {image ? (
        <span className="cdz-photo">
          <img src={image} alt="" loading="lazy" />
        </span>
      ) : option.swatch ? (
        <span
          className="cdz-swatch"
          style={{background: option.swatch}}
          aria-hidden="true"
        />
      ) : photo ? (
        <span className="cdz-photo cdz-photo-empty" aria-hidden="true">
          {option.value === 'Other'
            ? '+'
            : option.value === 'Not sure'
              ? '?'
              : option.value === 'No stones'
                ? '∅'
                : option.value.charAt(0)}
        </span>
      ) : option.icon ? (
        OPTION_ICONS[option.icon]
      ) : (
        fallbackIcon ?? null
      )}
      {stackedRange && option.value.includes(' – ') ? (
        <span className="cdz-range">
          <b>{option.value.split(' – ')[0]}</b>
          <i>to</i>
          <b>{option.value.split(' – ')[1]}</b>
        </span>
      ) : (
        <span className="cdz-tile-value">{option.value}</span>
      )}
      {option.caption && (
        <span className="cdz-tile-caption">{option.caption}</span>
      )}
      <span className="cdz-tile-check" aria-hidden="true">
        ✓
      </span>
    </button>
  );
}

export function CustomDesignBuilder() {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);

  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** 0 = "choose your piece"; 1..n = the category's spec steps. */
  const [stepIndex, setStepIndex] = useState(0);
  /** Set while editing a single answer from the review screen. */
  const [returnToReview, setReturnToReview] = useState(false);
  const [details, setDetails] = useState({name: '', email: '', contact: ''});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  /** Local preview of the chosen reference image (object URL + filename). */
  const [imagePreview, setImagePreview] = useState('');
  const [imageName, setImageName] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : '');
    setImageName(file?.name ?? '');
  };

  const clearImage = () => {
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview('');
    setImageName('');
  };

  const fullSpec = CATEGORY_SPECS[category] ?? [];
  /** Only the fields that apply under the current branch answers. */
  const spec = activeFields(category, (key) => answers[key] ?? '');
  const totalSteps = 1 + spec.length;
  const field: SpecField | undefined = spec[stepIndex - 1];

  // Photos for the style step (the piece step stays icon-only), prefetched
  // from the FULL sheet — both ring branches — so a branch opens dressed.
  const images = useCollectionImages(
    fullSpec.flatMap((f) =>
      f.options.flatMap((o) => (o.imageHandle ? [o.imageHandle] : [])),
    ),
  );

  const submitting = fetcher.state !== 'idle';
  const result = fetcher.data;
  const succeeded = result?.ok === true;
  useTrackConversion(succeeded, 'generate_lead', 'custom_jewelry', 'Lead');
  const serverErrors = result && !result.ok ? result.errors : undefined;
  const formError = result && !result.ok ? result.error : undefined;

  // A details error from the server belongs on the Details screen.
  useEffect(() => {
    if (!serverErrors) return;
    if (
      serverErrors.name ||
      serverErrors.email ||
      serverErrors.contact ||
      serverErrors.consent
    ) {
      setPhase(2);
    }
  }, [serverErrors]);

  const pickCategory = (value: string) => {
    if (value !== category) {
      setCategory(value);
      setAnswers({});
    }
    setStepIndex(1);
    if (returnToReview) {
      // A new category empties the sheet, so review would be blank — walk the
      // (new) steps instead. Same category → straight back to review.
      if (value === category) setPhase(3);
      setReturnToReview(value !== category);
    }
  };

  const pickOption = (key: string, value: string) => {
    const next = {...answers, [key]: value};
    // Changing a branch answer (Engagement ↔ Casual) orphans the other
    // branch's answers — drop them so they can't be submitted stale.
    if (answers[key] !== value) {
      for (const f of fullSpec) {
        if (f.when?.key === key && f.when.value !== value) delete next[f.key];
      }
    }
    setAnswers(next);
    // Forward to the next unanswered step, so back-jump edits fall through
    // already-answered steps instead of replaying them. Nothing left to ask →
    // review when this was an edit from there, details on the first run.
    const nextSpec = activeFields(category, (k) => next[k] ?? '');
    const unanswered = nextSpec.findIndex((f) => !next[f.key]);
    if (unanswered === -1) {
      setPhase(returnToReview ? 3 : 2);
      setReturnToReview(false);
    } else {
      setStepIndex(unanswered + 1);
    }
  };

  const jumpTo = (index: number, fromReview = false) => {
    setPhase(1);
    setStepIndex(index);
    setReturnToReview(fromReview);
  };

  const goBack = () => {
    if (phase === 3) return setPhase(2);
    if (phase === 2) return jumpTo(spec.length);
    if (returnToReview) {
      setReturnToReview(false);
      return setPhase(3);
    }
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  // Mirrors the server checks so the shopper hears about a typo on the
  // Details screen, not after submitting the whole request.
  const continueToReview = () => {
    const errors: Record<string, string> = {};
    if (details.name.trim().length < 2) errors.name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim()))
      errors.email = 'Please enter a valid email address.';
    if (!/^\d{7,15}$/.test(details.contact.replace(/\D/g, '')))
      errors.contact = 'Please enter a valid phone number.';
    if (!consent)
      errors.consent = 'Please agree so we can store your details and reply.';
    setDetailErrors(errors);
    if (!Object.keys(errors).length) setPhase(3);
  };

  const setDetail = (key: 'name' | 'email' | 'contact') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setDetails((d) => ({...d, [key]: e.target.value}));

  /** Wipe everything — back to "Choose your piece" with a blank form. */
  const resetAll = () => {
    setPhase(1);
    setCategory('');
    setAnswers({});
    setStepIndex(0);
    setReturnToReview(false);
    setDetails({name: '', email: '', contact: ''});
    setDetailErrors({});
    setConsent(false);
    clearImage();
    formRef.current?.reset();
  };

  const masthead = (
    <header className="cdz-masthead">
      <h1 className="cdz-title">
        Generate Your <span>Custom Design</span>
      </h1>
      <p className="cdz-tagline">Made to order · Los Angeles</p>
    </header>
  );

  if (succeeded) {
    return (
      <div className="cdz">
        {masthead}
        <div className="cdz-panel cdz-success">
          <div className="cdz-success-mark" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" fill="none" />
              <path fill="none" d="M15 27l7 7 15-16" />
            </svg>
          </div>
          <h2>Design request received</h2>
          <p>
            A designer will review your {category.toLowerCase()} and reach out
            within one business day with ideas and a quote.
          </p>
        </div>
      </div>
    );
  }

  const showBack = phase > 1 || stepIndex > 0;
  const heading =
    phase === 2
      ? 'Your contact information'
      : phase === 3
        ? 'Review your design'
        : stepIndex === 0
          ? 'Choose your piece'
          : field?.label ?? '';

  return (
    <div className="cdz">
      {masthead}

      {/* Phase rail */}
      <ol className="cdz-phases" aria-label="Progress">
        {(['Design', 'Details', 'Review'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const state = n === phase ? 'current' : n < phase ? 'done' : 'todo';
          return (
            <li key={label} className={`cdz-phase is-${state}`}>
              <span className="cdz-phase-dot">{state === 'done' ? '✓' : n}</span>
              <span className="cdz-phase-label">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="cdz-panel">
        {/* Back on the left, the step's question inline beside it. */}
        <div className="cdz-toolbar">
          {showBack ? (
            <button
              type="button"
              className="cdz-back"
              onClick={goBack}
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 5.5 8 12l6.5 6.5" />
              </svg>
              <span className="cdz-back-label">Back</span>
            </button>
          ) : (
            <span className="cdz-toolbar-spacer" aria-hidden="true" />
          )}
          <h2 className="cdz-question">{heading}</h2>
          {/* Anything picked yet? Then reset stays available — even back on
              the first step, where the back button itself is gone. */}
          {category || phase > 1 ? (
            <button
              type="button"
              className="cdz-reset"
              onClick={resetAll}
              title="Start over"
              aria-label="Reset the form and start over"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 9A8 8 0 1 1 4 13.5" />
                <path d="M4.5 4v5H9.5" />
              </svg>
            </button>
          ) : (
            <span className="cdz-toolbar-spacer" aria-hidden="true" />
          )}
        </div>


        <fetcher.Form
          ref={formRef}
          method="post"
          action="/api/custom-jewelry"
          encType="multipart/form-data"
          noValidate
        >
          <input type="hidden" name="productType" value={category} />
          {spec.map((f) =>
            answers[f.key] ? (
              <input
                key={f.key}
                type="hidden"
                name={`spec_${f.key}`}
                value={answers[f.key]}
              />
            ) : null,
          )}

          {/* ── Phase 1 · Design ─────────────────────────────────── */}
          <section hidden={phase !== 1}>
            {/* Keyed so each step re-enters with the fade-up animation. */}
            <div className="cdz-step" key={`${category}-${stepIndex}`}>
              {stepIndex === 0 ? (
                <>
                  <div className="cdz-grid cdz-grid-pieces">
                    {PRODUCT_TYPES.map((piece) => (
                      <OptionTile
                        key={piece}
                        selected={category === piece}
                        onClick={() => pickCategory(piece)}
                        fallbackIcon={<PieceIcon piece={piece} />}
                        option={{value: piece}}
                      />
                    ))}
                  </div>
                </>
              ) : field ? (
                (() => {
                  const photoStep = field.options.some(
                    (o) => o.imageHandle || o.image,
                  );
                  // Swatch steps (metals, stones) drop the boxes too — big
                  // glossy balls instead of cards.
                  const ballStep =
                    !photoStep && field.options.some((o) => o.swatch);
                  return (
                    <div
                      className={`cdz-grid${
                        photoStep
                          ? ' cdz-grid-photos'
                          : ballStep
                            ? ' cdz-grid-balls'
                            : field.options.length > 9
                              ? ' cdz-grid-dense'
                              : ''
                      }`}
                    >
                      {field.options.map((option) => (
                        <OptionTile
                          key={option.value}
                          selected={answers[field.key] === option.value}
                          onClick={() => pickOption(field.key, option.value)}
                          image={
                            option.imageHandle
                              ? images[option.imageHandle] || undefined
                              : option.image
                          }
                          option={option}
                          photo={photoStep || ballStep}
                          stackedRange={field.key === 'budget'}
                        />
                      ))}
                    </div>
                  );
                })()
              ) : null}
            </div>
          </section>

          {/* ── Phase 2 · Details ────────────────────────────────── */}
          <section hidden={phase !== 2}>
            <div className="cdz-step">
              <div className="cdz-details">
                {(
                  [
                    ['name', 'Full Name', 'text', 'name'],
                    ['email', 'Email Address', 'email', 'email'],
                    ['contact', 'Phone', 'tel', 'tel'],
                  ] as const
                ).map(([key, label, type, autoComplete]) => {
                  const error = detailErrors[key] ?? serverErrors?.[key];
                  return (
                    <label className="cdz-field" key={key}>
                      <span>{label}</span>
                      <input
                        type={type}
                        name={key}
                        autoComplete={autoComplete}
                        value={details[key]}
                        onChange={setDetail(key)}
                        placeholder={
                          key === 'contact' ? '(201) 555-0123' : undefined
                        }
                        aria-invalid={Boolean(error)}
                      />
                      {error && <em className="cdz-error">{error}</em>}
                    </label>
                  );
                })}
                <label className="cdz-consent">
                  <input
                    type="checkbox"
                    name="consent"
                    value="yes"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      if (e.target.checked)
                        setDetailErrors(({consent: _, ...rest}) => rest);
                    }}
                  />
                  <span>
                    I agree that Gold Custom may store my contact details to
                    respond to this design request.
                  </span>
                </label>
                {(detailErrors.consent ?? serverErrors?.consent) && (
                  <em className="cdz-error">
                    {detailErrors.consent ?? serverErrors?.consent}
                  </em>
                )}

                <button
                  type="button"
                  className="cdz-next"
                  onClick={continueToReview}
                >
                  Continue to review
                </button>
              </div>
            </div>
          </section>

          {/* ── Phase 3 · Review & submit ────────────────────────── */}
          <section hidden={phase !== 3}>
            <div className="cdz-step">
              <div className="cdz-review">
                <dl className="cdz-summary">
                  <div className="cdz-summary-row">
                    <dt>Piece</dt>
                    <dd>{category}</dd>
                    <button
                      type="button"
                      className="cdz-edit"
                      onClick={() => jumpTo(0, true)}
                    >
                      Edit
                    </button>
                  </div>
                  {spec.map((f, i) => (
                    <div className="cdz-summary-row" key={f.key}>
                      <dt>{f.short}</dt>
                      <dd>{answers[f.key] ?? '—'}</dd>
                      <button
                        type="button"
                        className="cdz-edit"
                        onClick={() => jumpTo(i + 1, true)}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                  <div className="cdz-summary-row">
                    <dt>Contact</dt>
                    <dd>
                      {details.name} · {details.email}
                    </dd>
                    <button
                      type="button"
                      className="cdz-edit"
                      onClick={() => setPhase(2)}
                    >
                      Edit
                    </button>
                  </div>
                </dl>

                <div className="cdz-review-extras">
                  <div className="cdz-field">
                    <span>Reference Image (optional)</span>
                    <label className="cdz-upload">
                      <input
                        ref={imageInputRef}
                        type="file"
                        name="image"
                        accept="image/*"
                        onChange={onImageChange}
                      />
                      {imagePreview ? (
                        <span className="cdz-upload-picked">
                          <img
                            className="cdz-upload-thumb"
                            src={imagePreview}
                            alt="Reference preview"
                          />
                          <span className="cdz-upload-name">{imageName}</span>
                        </span>
                      ) : (
                        <>
                          <svg
                            className="cdz-upload-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M12 15.5V4.5" />
                            <path d="M7.5 8.5 12 4l4.5 4.5" />
                            <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
                          </svg>
                          <span className="cdz-upload-cta">
                            Click to add an image
                          </span>
                          <span className="cdz-upload-hint">
                            A photo, sketch or screenshot · up to 10MB
                          </span>
                        </>
                      )}
                    </label>
                    {imagePreview && (
                      <button
                        type="button"
                        className="cdz-upload-clear"
                        onClick={clearImage}
                      >
                        Remove image
                      </button>
                    )}
                    {serverErrors?.image && (
                      <em className="cdz-error">{serverErrors.image}</em>
                    )}
                  </div>

                  <label className="cdz-field">
                    <span>Describe your design (optional)</span>
                    <textarea
                      name="description"
                      rows={5}
                      placeholder="Tell us the details — engraving, inspiration, a deadline, anything on your mind…"
                      aria-invalid={Boolean(serverErrors?.description)}
                    />
                    {serverErrors?.description && (
                      <em className="cdz-error">{serverErrors.description}</em>
                    )}
                  </label>

                  {formError && <p className="cdz-form-error">{formError}</p>}

                  <button
                    type="submit"
                    className="cdz-next"
                    disabled={submitting}
                  >
                    {submitting ? 'Sending…' : 'Submit design request'}
                  </button>
                  <p className="cdz-fineprint">
                    Free consultation — a designer reaches out within one
                    business day.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </fetcher.Form>

        {/* Bottom line: the selection trail from the left, the step counter
            on the right. Tap a chip to change that answer. */}
        {phase === 1 && category && (
          <div className="cdz-footer">
            <div className="cdz-trail" aria-label="Your selections">
              <button
                type="button"
                className="cdz-chip"
                onClick={() => jumpTo(0)}
              >
                <span className="cdz-chip-key">Piece</span>
                {category}
              </button>
              {spec.map((f, i) =>
                answers[f.key] ? (
                  <button
                    key={f.key}
                    type="button"
                    className="cdz-chip"
                    onClick={() => jumpTo(i + 1)}
                  >
                    <span className="cdz-chip-key">{f.short}</span>
                    {answers[f.key]}
                  </button>
                ) : null,
              )}
            </div>
            <p className="cdz-counter">
              Step {stepIndex + 1} of {totalSteps}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
