import {useEffect, useRef, useState} from 'react';

export type PremiumSelectOption = {
  /** Stable key + the value shown in the row. */
  key: string;
  name: string;
  selected: boolean;
  available: boolean;
};

/**
 * Premium variant selector rendered as a custom listbox (native <select>
 * can't be styled to match). Presentation only — the parent decides what
 * selecting an option does via `onSelect`.
 */
export function PremiumSelect({
  label,
  options,
  onSelect,
  hint,
}: {
  label: string;
  options: PremiumSelectOption[];
  onSelect: (option: PremiumSelectOption) => void;
  /** Optional aside under the label, e.g. a sizing-guide link. */
  hint?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (options.length === 0) return null;

  const current = options.find((o) => o.selected) ?? options[0];
  const labelId = `select-label-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="product-options variant-select-field" ref={wrapRef}>
      <span className="product-options-label" id={labelId}>
        {label}
      </span>
      {hint}
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

        {open && (
          <ul
            className="variant-select-list"
            role="listbox"
            aria-labelledby={labelId}
          >
            {options.map((option) => (
              <li key={option.key} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.selected}
                  className={`variant-select-option${
                    option.selected ? ' is-selected' : ''
                  }${option.available ? '' : ' is-unavailable'}`}
                  onClick={() => {
                    setOpen(false);
                    if (!option.selected) onSelect(option);
                  }}
                >
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
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
