import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import {useFetcher} from 'react-router';
import {useAnalytics} from '@shopify/hydrogen';
import {useTrackConversion} from '~/hooks/useTrackConversion';
import {BUDGETS, budgetForPrice, parseFinancingLead} from '~/lib/financingLead';

export type FinancingPartner = {name: string; href: string};
export type FinancingProduct = {
  title: string;
  variant?: string;
  price?: number;
};

type ActionResult =
  | {ok: true}
  | {ok: false; error?: string; errors?: Record<string, string>};

/** How long the thank-you stays up before this tab moves on to the lender. */
const CONTINUE_AFTER_MS = 1200;

// Once per visit. A shopper who has left their details — or chosen to skip —
// goes straight to the next lender they click, never through the form twice.
const SEEN_KEY = 'gc-financing-lead';
const seenThisVisit = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};
const rememberThisVisit = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode / blocked storage: the form simply shows again next time.
  }
};

/**
 * A financing partner's application link that first asks for name, phone and
 * budget, so a shopper who wanders off mid-application is still a lead the
 * team can call (/api/financing-lead → a "Financing" Customer record).
 *
 * Built for zero friction: three fields, the budget pre-chosen from the
 * piece's price, a visible "skip this step", and never asked twice in one
 * visit. Once the lead is saved the shopper sees a thank-you, then this same
 * tab continues to the lender's application. Without JavaScript it is the
 * plain link it replaces.
 */
export function FinancingLink({
  partner,
  product,
  className,
  children,
}: {
  partner: FinancingPartner;
  product?: FinancingProduct;
  className?: string;
  children: ReactNode;
}) {
  const {publish} = useAnalytics();
  const [open, setOpen] = useState(false);
  // Stable, because the modal's focus/Escape effect depends on it: a fresh
  // function on every product-page re-render would re-run that effect and
  // throw the cursor back to "Full name" mid-way through typing a phone.
  const close = useCallback(() => setOpen(false), []);

  // The hand-off to the lender — the same `finance_link` / SubmitApplication
  // the bare logo link always sent, now fired when the lender actually opens,
  // so existing reports keep their meaning. `via` says how they got there.
  const handOff = (via: 'form' | 'skip' | 'returning') =>
    publish('custom_ga4', {
      event: 'finance_link',
      params: {method: partner.name, via},
      metaEvent: 'SubmitApplication',
    });

  return (
    <>
      <a
        href={partner.href}
        target="_blank"
        // Third-party lender: `noopener` for target=_blank, `nofollow` so a
        // commercial partner link reads as neither a link scheme nor a vote.
        rel="noopener noreferrer nofollow"
        className={className}
        onClick={(event) => {
          if (seenThisVisit()) {
            handOff('returning');
            return;
          }
          event.preventDefault();
          publish('custom_ga4', {
            event: 'finance_form_open',
            params: {method: partner.name},
          });
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open && (
        <FinancingLeadModal
          partner={partner}
          product={product}
          onHandOff={handOff}
          onClose={close}
        />
      )}
    </>
  );
}

function FinancingLeadModal({
  partner,
  product,
  onHandOff,
  onClose,
}: {
  partner: FinancingPartner;
  product?: FinancingProduct;
  onHandOff: (via: 'form' | 'skip') => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<ActionResult>();
  const [budget, setBudget] = useState(budgetForPrice(product?.price));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState('');

  const result = fetcher.data;
  const saving = fetcher.state !== 'idle';
  const saved = result?.ok === true;
  const failed = result && !result.ok;
  const fieldErrors = {...errors, ...(failed ? result.errors : undefined)};
  const formError = failed ? result.error : undefined;

  // GA4 only. Meta already gets SubmitApplication at the hand-off, and a new
  // `Lead` stream would change what any campaign optimising on Lead learns.
  useTrackConversion(saved, 'generate_lead', 'financing');

  // Latest props via a ref: the parent re-renders with a fresh onHandOff, and
  // the timer below must not restart when it does.
  const latest = useRef({onHandOff, href: partner.href});
  latest.current = {onHandOff, href: partner.href};

  // Thank-you first, then this tab continues to the lender's application.
  // Closing the modal unmounts it and cancels the timer.
  useEffect(() => {
    if (!saved) return;
    rememberThisVisit();
    const timer = window.setTimeout(() => {
      latest.current.onHandOff('form');
      window.location.assign(latest.current.href);
    }, CONTINUE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLInputElement>('input[name=name]')
      ?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = parseFinancingLead(data);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      event.currentTarget
        .querySelector<HTMLInputElement>(
          `[name=${Object.keys(parsed.errors)[0]}]`,
        )
        ?.focus();
      return;
    }
    setErrors({});
    setFirstName(parsed.lead.name.split(' ')[0]);
    // Same tab, so the save has to finish before anything navigates — the
    // thank-you (and its timer) only appear once Shopify has the lead.
    void fetcher.submit(data, {method: 'post', action: '/api/financing-lead'});
  };

  const productLine = product
    ? [
        product.title,
        product.variant && product.variant !== 'Default Title'
          ? product.variant
          : '',
        product.price ? `$${product.price.toFixed(2)}` : '',
      ]
        .filter(Boolean)
        .join(' — ')
    : '';

  return createPortal(
    <div
      className="appt-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="appt-overlay-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="appt-modal">
        <button
          type="button"
          className="appt-close"
          aria-label="Close"
          onClick={onClose}
        >
          &times;
        </button>

        {saved && (
          <div className="appt-success" role="status">
            <div className="appt-success-mark" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" fill="none" />
                <path fill="none" d="M15 27l7 7 15-16" />
              </svg>
            </div>
            <h2 id={titleId}>Thank you{firstName ? `, ${firstName}` : ''}</h2>
            <p>
              Your details are saved. Taking you to {partner.name}’s secure
              application…
            </p>
          </div>
        )}

        <div hidden={saved}>
          <header className="appt-head">
            <span className="appt-eyebrow">Financing</span>
            <h2 id={saved ? undefined : titleId}>Apply with {partner.name}</h2>
            <p className="fin-lede">
              Leave your details and our financing team will help you through
              approval.
            </p>
            {product && <p className="appt-piece">{product.title}</p>}
          </header>

          <form
            ref={formRef}
            method="post"
            action="/api/financing-lead"
            noValidate
            onSubmit={onSubmit}
          >
            <input type="hidden" name="partner" value={partner.name} />
            <input type="hidden" name="product" value={productLine} />

            <label className="appt-field">
              <span>Full name</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                required
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name && (
                <em className="appt-error">{fieldErrors.name}</em>
              )}
            </label>

            <label className="appt-field">
              <span>Mobile number</span>
              <input
                type="tel"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                required
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone && (
                <em className="appt-error">{fieldErrors.phone}</em>
              )}
            </label>

            <fieldset
              className="fin-budget"
              aria-invalid={Boolean(fieldErrors.budget)}
            >
              <legend>Your budget</legend>
              <div className="fin-budget-options">
                {BUDGETS.map(({label}) => (
                  <label
                    key={label}
                    className={budget === label ? 'is-selected' : undefined}
                  >
                    <input
                      type="radio"
                      name="budget"
                      value={label}
                      className="visually-hidden"
                      checked={budget === label}
                      onChange={() => setBudget(label)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {fieldErrors.budget && (
                <em className="appt-error">{fieldErrors.budget}</em>
              )}
            </fieldset>

            <label className="fin-consent">
              <input type="checkbox" name="consent" />
              <span>Gold Custom may call or text me about financing.</span>
            </label>

            {/* Honeypot — see /api/financing-lead. */}
            <div className="visually-hidden" aria-hidden="true">
              <label>
                Website
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            {formError && <p className="appt-form-error">{formError}</p>}

            <button
              type="submit"
              className="btn product-book-consult appt-submit"
              disabled={saving}
            >
              {saving ? 'Saving…' : `Continue to ${partner.name}`}
            </button>
            <p className="appt-fineprint">
              Next, you’ll continue to {partner.name}’s secure application.
              <br />
              <a
                href={partner.href}
                rel="nofollow"
                className="fin-text-link"
                onClick={() => {
                  onHandOff('skip');
                  rememberThisVisit();
                }}
              >
                Skip this step
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
