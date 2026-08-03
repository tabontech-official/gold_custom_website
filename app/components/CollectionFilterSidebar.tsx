import {useEffect, useState, type CSSProperties} from 'react';
import {Link, useLocation, useNavigate, useSearchParams} from 'react-router';
import {SORT_OPTIONS, getSortFromParam} from '~/lib/collectionFilter';
import {useDismissable} from '~/hooks/useDismissable';

type FilterValue = {
  id: string;
  label: string;
  count: number;
  input: string;
};

type Filter = {
  id: string;
  label: string;
  type: string;
  values: FilterValue[];
};

function normalize(input: string) {
  try {
    return JSON.stringify(JSON.parse(input));
  } catch {
    return input;
  }
}

function stripPagination(params: URLSearchParams) {
  params.delete('cursor');
  params.delete('direction');
}

function isPriceParam(value: string) {
  try {
    const filter = JSON.parse(value);
    return Boolean(filter && typeof filter === 'object' && 'price' in filter);
  } catch {
    return false;
  }
}

type GroupedValue = {
  id: string;
  label: string;
  count: number;
  inputs: string[];
};

/** Tags exist in case variants ("14k…" vs "14K…") — merge them into one row. */
function dedupeValues(values: FilterValue[]): GroupedValue[] {
  const byLabel = new Map<string, GroupedValue>();
  for (const value of values) {
    const key = value.label.trim().toLowerCase();
    const existing = byLabel.get(key);
    if (existing) {
      existing.count += value.count;
      existing.inputs.push(value.input);
    } else {
      byLabel.set(key, {
        id: value.id,
        label: value.label,
        count: value.count,
        inputs: [value.input],
      });
    }
  }
  return [...byLabel.values()];
}

export type SidebarCategory = {handle: string; title: string};

/** Filter rail: fixed left column on desktop, slide-in drawer on mobile. */
export function CollectionFilterSidebar({
  categories = [],
  filters,
}: {
  categories?: SidebarCategory[];
  filters: Filter[];
}) {
  const [drawer, setDrawer] = useState<null | 'filters'>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useDismissable<HTMLDivElement>(sortOpen, () =>
    setSortOpen(false),
  );
  const [searchParams] = useSearchParams();
  const activeFilterParams = searchParams.getAll('filter');
  const activeSet = new Set(activeFilterParams.map(normalize));
  const activeSort = getSortFromParam(searchParams.get('sort'));
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';
  const filterGroups = filters.filter(
    (filter) =>
      filter.type !== 'PRICE_RANGE' &&
      filter.values.length > 0 &&
      !/availability/i.test(filter.label),
  );
  const priceBounds = getPriceBounds(
    filters.find((filter) => filter.type === 'PRICE_RANGE'),
  );

  // Active filter chips: match each `filter` param back to its facet label
  // so the toolbar can show what's applied, e.g. "Metal: 14K Gold ×".
  const activeChips = activeFilterParams.map((param) => {
    if (isPriceParam(param)) {
      const price = getActivePrice(new URLSearchParams([['filter', param]]));
      return {
        key: param,
        label: price ? `Price: $${price.min}–$${price.max}` : 'Price',
        href: removeFilterHref(param),
      };
    }
    for (const filter of filters) {
      const match = filter.values.find(
        (value) => normalize(value.input) === normalize(param),
      );
      if (match) {
        return {
          key: param,
          label: `${filter.label}: ${match.label}`,
          href: removeFilterHref(param),
        };
      }
    }
    return {key: param, label: 'Filter', href: removeFilterHref(param)};
  });

  function removeFilterHref(target: string) {
    const params = new URLSearchParams(searchParams);
    const existing = params.getAll('filter');
    params.delete('filter');
    for (const value of existing) {
      if (normalize(value) === normalize(target)) continue;
      params.append('filter', value);
    }
    stripPagination(params);
    const query = params.toString();
    return query ? `?${query}` : '?';
  }

  function toggleHref(inputs: string[]) {
    const params = new URLSearchParams(searchParams);
    const targets = new Set(inputs.map(normalize));
    const existing = params.getAll('filter');
    const wasActive = existing.some((value) => targets.has(normalize(value)));
    params.delete('filter');

    for (const value of existing) {
      if (targets.has(normalize(value))) continue;
      params.append('filter', value);
    }

    if (!wasActive) {
      for (const input of inputs) params.append('filter', input);
    }
    stripPagination(params);
    const query = params.toString();
    return query ? `?${query}` : '?';
  }

  function sortHref(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === 'featured') params.delete('sort');
    else params.set('sort', value);
    stripPagination(params);
    const query = params.toString();
    return query ? `?${query}` : '?';
  }

  function clearHref() {
    const params = new URLSearchParams(searchParams);
    params.delete('filter');
    stripPagination(params);
    const query = params.toString();
    return query ? `?${query}` : '?';
  }

  function viewHref(nextView: 'grid' | 'list') {
    const params = new URLSearchParams(searchParams);
    if (nextView === 'grid') params.delete('view');
    else params.set('view', nextView);
    const query = params.toString();
    return query ? `?${query}` : '?';
  }

  return (
    <>
      <div className="collection-toolbar">
        <button
          type="button"
          className="collection-filter-trigger"
          onClick={() => setDrawer('filters')}
        >
          <FilterIcon />
          <span>Filters</span>
          {activeFilterParams.length > 0 && (
            <span className="collection-filter-count">
              {activeFilterParams.length}
            </span>
          )}
        </button>
        <div className="collection-view-switcher" aria-label="Product view">
          <Link
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            className={view === 'grid' ? 'is-active' : ''}
            preventScrollReset
            to={viewHref('grid')}
          >
            <GridIcon />
          </Link>
          <Link
            aria-label="List view"
            aria-pressed={view === 'list'}
            className={view === 'list' ? 'is-active' : ''}
            preventScrollReset
            to={viewHref('list')}
          >
            <ListIcon />
          </Link>
        </div>
        {activeFilterParams.length > 0 && (
          <Link
            aria-label={`Clear all filters (${activeFilterParams.length})`}
            className="collection-toolbar-clear"
            preventScrollReset
            title="Clear all filters"
            to={clearHref()}
          >
            <span aria-hidden="true">×</span>
            <span>Clear all</span>
          </Link>
        )}
        <div className="collection-sort-select" ref={sortRef}>
          <button
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            className="collection-sort-trigger"
            onClick={() => setSortOpen((open) => !open)}
            type="button"
          >
            <span className="collection-sort-label">
              <SortIcon />
              <span>Sort</span>
            </span>
            <span className="collection-sort-value">{activeSort.label}</span>
            <ChevronIcon />
          </button>
          {sortOpen && (
            <div className="collection-sort-popover" role="listbox">
              {SORT_OPTIONS.map((option) => (
                <Link
                  aria-selected={activeSort.value === option.value}
                  className={
                    activeSort.value === option.value ? 'is-active' : ''
                  }
                  key={option.value}
                  onClick={() => setSortOpen(false)}
                  preventScrollReset
                  role="option"
                  to={sortHref(option.value)}
                >
                  <span>{option.label}</span>
                  <CheckIcon />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="collection-active-filters">
          <span className="collection-active-filters-label">Applied:</span>
          <ul className="collection-chip-list">
            {activeChips.map((chip) => (
              <li key={chip.key}>
                <Link
                  className="collection-chip"
                  preventScrollReset
                  to={chip.href}
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {drawer && (
        <button
          type="button"
          className="collection-drawer-backdrop"
          aria-label="Close filters"
          onClick={() => setDrawer(null)}
        />
      )}

      <aside
        className={`collection-sidebar${drawer ? ` is-open mode-${drawer}` : ''}`}
        aria-label="Sort and filter products"
      >
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close filters"
          onClick={() => setDrawer(null)}
        >
          ×
        </button>
        <div className="sidebar-head">
          <FilterIcon />
          <span>Filter</span>
        </div>

        {priceBounds && (
          <details className="sidebar-group" open>
            <summary>Price</summary>
            <PriceRange bounds={priceBounds} />
          </details>
        )}

        {filterGroups.map((filter) => (
          <details
            className="sidebar-group"
            key={filter.id}
            open={!/tag/i.test(filter.label)}
          >
            <summary>{filter.label}</summary>
            <ul className="sidebar-options">
              {dedupeValues(filter.values).map((value) => {
                const checked = value.inputs.some((input) =>
                  activeSet.has(normalize(input)),
                );
                return (
                  <li key={value.id}>
                    <Link
                      to={toggleHref(value.inputs)}
                      preventScrollReset
                      className={`sidebar-option${checked ? ' is-checked' : ''}`}
                    >
                      <span className="sidebar-check" aria-hidden="true" />
                      <span>{value.label}</span>
                      <span className="sidebar-count">{value.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}

        <CategoryNav categories={categories} />
      </aside>
    </>
  );
}

/**
 * Browse rail for the collections the header nav doesn't carry — the nav only
 * has room for the departments, this lists the rest of the catalog.
 */
function CategoryNav({categories}: {categories: SidebarCategory[]}) {
  const {pathname} = useLocation();

  if (categories.length === 0) return null;

  return (
    <details className="sidebar-group sidebar-group-categories" open>
      <summary>Categories</summary>
      {/* The list is scrolled, not searched — the filter-a-filter box that
          used to sit here was a control for finding a control. */}
      <ul className="sidebar-categories">
        {categories.map((category) => {
          const to = `/collections/${category.handle}`;
          const isActive = pathname === to;
          return (
            <li key={category.handle}>
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`sidebar-category${isActive ? ' is-active' : ''}`}
                prefetch="intent"
                to={to}
              >
                {category.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

type PriceBounds = {min: number; max: number};

/** The PRICE_RANGE facet's input holds the collection's real min/max. */
function getPriceBounds(filter?: Filter): PriceBounds | null {
  const raw = filter?.values[0]?.input;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {price?: {min?: number; max?: number}};
    const min = Math.floor(parsed.price?.min ?? 0);
    const max = Math.ceil(parsed.price?.max ?? 0);
    return max > min ? {min, max} : null;
  } catch {
    return null;
  }
}

function getActivePrice(searchParams: URLSearchParams): PriceBounds | null {
  for (const value of searchParams.getAll('filter')) {
    try {
      const filter = JSON.parse(value) as {
        price?: {min?: number; max?: number};
      };
      if (filter?.price) {
        return {min: filter.price.min ?? 0, max: filter.price.max ?? 0};
      }
    } catch {
      // ignore malformed params
    }
  }
  return null;
}

/** Dual-handle price slider + min/max boxes. Applies on release / Enter. */
function PriceRange({bounds}: {bounds: PriceBounds}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const active = getActivePrice(searchParams);
  const [min, setMin] = useState(active?.min ?? bounds.min);
  const [max, setMax] = useState(active?.max ?? bounds.max);

  // Re-sync local state when the URL changes (Clear all, back button…)
  useEffect(() => {
    setMin(active?.min ?? bounds.min);
    setMax(active?.max ?? bounds.max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.min, active?.max, bounds.min, bounds.max]);

  function apply(nextMin: number, nextMax: number) {
    const lo = Math.max(bounds.min, Math.min(nextMin, nextMax));
    const hi = Math.min(bounds.max, Math.max(nextMin, nextMax));
    const params = new URLSearchParams(searchParams);
    const existing = params.getAll('filter').filter((v) => !isPriceParam(v));
    params.delete('filter');
    for (const value of existing) params.append('filter', value);
    if (lo > bounds.min || hi < bounds.max) {
      params.append('filter', JSON.stringify({price: {min: lo, max: hi}}));
    }
    stripPagination(params);
    void navigate(`?${params.toString()}`, {preventScrollReset: true});
  }

  const span = bounds.max - bounds.min;
  const pctLo = `${((min - bounds.min) / span) * 100}%`;
  const pctHi = `${((max - bounds.min) / span) * 100}%`;

  return (
    <div className="sidebar-price">
      <div
        className="price-slider"
        style={{'--lo': pctLo, '--hi': pctHi} as CSSProperties}
      >
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          value={min}
          aria-label="Minimum price"
          onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
          onPointerUp={() => apply(min, max)}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          value={max}
          aria-label="Maximum price"
          onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
          onPointerUp={() => apply(min, max)}
        />
      </div>
      <div className="price-inputs">
        <label className="price-box">
          <span>$</span>
          <input
            type="number"
            value={min}
            min={bounds.min}
            max={bounds.max}
            aria-label="Minimum price"
            onChange={(e) => setMin(Number(e.target.value))}
            onBlur={() => apply(min, max)}
            onKeyDown={(e) => e.key === 'Enter' && apply(min, max)}
          />
        </label>
        <label className="price-box">
          <span>$</span>
          <input
            type="number"
            value={max}
            min={bounds.min}
            max={bounds.max}
            aria-label="Maximum price"
            onChange={(e) => setMax(Number(e.target.value))}
            onBlur={() => apply(min, max)}
            onKeyDown={(e) => e.key === 'Enter' && apply(min, max)}
          />
        </label>
      </div>
    </div>
  );
}

/* iOS-style sliders glyph */
function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M3 6h18M3 12h18M3 18h18" />
      </g>
      <g fill="#fff" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="6" r="2.3" />
        <circle cx="15" cy="12" r="2.3" />
        <circle cx="8" cy="18" r="2.3" />
      </g>
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 4v15m0 0-3-3m3 3 3-3M17 20V5m0 0-3 3m3-3 3 3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="collection-sort-caret" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="collection-sort-check" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12.5 9.5 17 19 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
        fill="currentColor"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 6h2v2H5zM9 6h10v2H9zM5 11h2v2H5zM9 11h10v2H9zM5 16h2v2H5zM9 16h10v2H9z"
        fill="currentColor"
      />
    </svg>
  );
}
