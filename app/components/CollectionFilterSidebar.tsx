import {useState} from 'react';
import {Link, useSearchParams} from 'react-router';
import {SORT_OPTIONS, getSortFromParam} from '~/lib/collectionFilter';

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

function isHiddenFilterParam(input: string) {
  try {
    const filter = JSON.parse(input);
    return (
      filter &&
      typeof filter === 'object' &&
      ('price' in filter || 'available' in filter)
    );
  } catch {
    return false;
  }
}

function stripPagination(params: URLSearchParams) {
  params.delete('cursor');
  params.delete('direction');
}

export function CollectionFilterSidebar({filters}: {filters: Filter[]}) {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const activeFilterParams = searchParams
    .getAll('filter')
    .filter((value) => !isHiddenFilterParam(value));
  const activeSet = new Set(activeFilterParams.map(normalize));
  const activeSort = getSortFromParam(searchParams.get('sort'));
  const filterGroups = filters.filter(
    (filter) =>
      filter.type !== 'PRICE_RANGE' &&
      filter.label.toLowerCase() !== 'availability' &&
      filter.values.length > 0,
  );
  const activeCount = activeFilterParams.length;

  function toggleHref(input: string) {
    const params = new URLSearchParams(searchParams);
    const target = normalize(input);
    const existing = params.getAll('filter');
    params.delete('filter');
    let removed = false;

    for (const value of existing) {
      if (normalize(value) === target) {
        removed = true;
        continue;
      }
      if (!isHiddenFilterParam(value)) params.append('filter', value);
    }

    if (!removed) params.append('filter', input);
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

  return (
    <div className="collection-filter-dropdown">
      <button
        type="button"
        className="filter-fab"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-label="Open filters"
        aria-expanded={open}
      >
        <FilterIcon />
        Filter
        {activeCount > 0 && <span className="filter-fab-badge">{activeCount}</span>}
      </button>

      <div className={`collection-filter-menu${open ? ' is-open' : ''}`}>
        <div className="filter-menu-head">
          <h2>Sort & Filter</h2>
          <button
            type="button"
            className="filter-menu-close"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          >
            x
          </button>
        </div>

        <div className="filter-menu-section">
          <h3>Sort by</h3>
          <ul className="filter-menu-options">
            {SORT_OPTIONS.map((option) => (
              <li key={option.value}>
                <Link
                  to={sortHref(option.value)}
                  preventScrollReset
                  className={`filter-menu-option${
                    activeSort.value === option.value ? ' is-checked' : ''
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <span className="filter-menu-check" aria-hidden="true" />
                  <span>{option.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {filterGroups.map((filter) => (
          <div className="filter-menu-section" key={filter.id}>
            <h3>{filter.label}</h3>
            <ul className="filter-menu-options">
              {filter.values.map((value) => {
                const checked = activeSet.has(normalize(value.input));
                return (
                  <li key={value.id}>
                    <Link
                      to={toggleHref(value.input)}
                      preventScrollReset
                      className={`filter-menu-option${
                        checked ? ' is-checked' : ''
                      }`}
                    >
                      <span className="filter-menu-check" aria-hidden="true" />
                      <span>{value.label}</span>
                      <span className="filter-menu-count">{value.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 5h18M6 12h12M10 19h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
