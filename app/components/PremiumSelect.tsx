import {useState} from 'react';
import {Link} from 'react-router';
import {useDismissable} from '~/hooks/useDismissable';

export type PremiumSelectOption = {
  /** Stable key + the value shown in the row. */
  key: string;
  name: string;
  selected: boolean;
  available: boolean;
  /**
   * Where picking this option goes, when it is a navigation.
   *
   * Set it and the row renders as a real `<Link>`, which is what lets React
   * Router prefetch on hover — a Karat or Length value lives on a *different
   * product*, so clicking one has to fetch that product's loader data, and
   * without prefetch the shopper waits for it after the click.
   *
   * Leave it undefined for choices that never navigate (ring size, which is
   * add-to-cart state) or that have no destination (an option value with no
   * matching variant); those keep the plain button and `onSelect`.
   */
  to?: string | null;
};

/**
 * Premium variant selector rendered as a custom listbox (native <select>
 * can't be styled to match). Presentation only — the parent decides what
 * selecting an option does, via `to` for navigations or `onSelect` otherwise.
 */
export function PremiumSelect({
  label,
  options,
  onSelect,
  hint,
}: {
  label: string;
  options: PremiumSelectOption[];
  /** Only called for options with no `to`. */
  onSelect?: (option: PremiumSelectOption) => void;
  /** Optional aside under the label, e.g. a sizing-guide link. */
  hint?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  if (options.length === 0) return null;

  const current = options.find((o) => o.selected) ?? options[0];
  const labelId = `select-label-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="product-options variant-select-field" ref={wrapRef}>
      <div className="product-options-header">
        <span className="product-options-label" id={labelId}>
          {label}
        </span>
        {hint}
      </div>
      <div className="variant-select">
        <button
          type="button"
          className={`variant-select-trigger${open ? ' is-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={labelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="variant-select-value">{current?.name}</span>
          <svg
            className="variant-select-caret"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Transparent shield under the open list. Without it the buttons the
            dropdown covers (Add to bag, Book Private Consultation) still take
            the click, so picking a size also fired whatever sat behind it. */}
        {open && (
          <button
            type="button"
            className="variant-select-shield"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
        )}
        {open && (
          <ul
            className="variant-select-list"
            role="listbox"
            aria-labelledby={labelId}
          >
            {options.map((option) => {
              // The option already showing needs no navigation, so it stays a
              // button — clicking the current value should do nothing, as it
              // did before, not re-enter the same URL.
              const href = option.selected ? null : option.to;
              const className = `variant-select-option${
                option.selected ? ' is-selected' : ''
              }${option.available ? '' : ' is-unavailable'}`;
              const body = (
                <>
                  <span>{option.name}</span>
                  {option.selected && (
                    <svg
                      className="variant-select-tick"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 12.5l4.5 4.5L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </>
              );

              return (
                <li key={option.key} role="none">
                  {href ? (
                    <Link
                      to={href}
                      role="option"
                      aria-selected={option.selected}
                      className={className}
                      // Every destination is worth prefetching on hover: a
                      // sibling product needs its whole loader, and even a
                      // same-page variant swap (`?Metal=…`) re-runs this
                      // route's loader — that refetch is what keeps the price
                      // and the cart line honest (see useOptimisticVariant in
                      // products.$handle.tsx). Warming it on hover is what
                      // makes the click land on data that has already arrived.
                      prefetch="intent"
                      preventScrollReset
                      onClick={() => setOpen(false)}
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.selected}
                      className={className}
                      onClick={() => {
                        setOpen(false);
                        if (!option.selected) onSelect?.(option);
                      }}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
