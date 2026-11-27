import {Link, useSearchParams} from 'react-router';
import {parseFacetFilter, type SubType} from '~/lib/facets';

/** The type a `filter` param selects, or null for any other filter. */
function typeOfParam(value: string): string | null {
  try {
    const facet = parseFacetFilter(JSON.parse(value));
    return facet?.key === 'type' ? facet.value : null;
  } catch {
    return null;
  }
}

/**
 * A collection's own sub-types (facets SUB_TYPES) as one row of pills under
 * the filter bar: All Hoops, Twisted, Bamboo… A pill filters the grid via the
 * same `filter` param as the sidebar, so sort and the other filters keep
 * working alongside it. One type at a time; the active pill, or "All", clears
 * it. Native horizontal scroll, so phones get momentum and snap for free.
 */
export function CollectionSubTypes({
  types,
  allLabel,
}: {
  types: SubType[];
  allLabel: string;
}) {
  const [searchParams] = useSearchParams();
  if (!types.length) return null;

  const active = searchParams.getAll('filter').map(typeOfParam).find(Boolean);

  const hrefFor = (label: string | null) => {
    const params = new URLSearchParams(searchParams);
    const kept = params.getAll('filter').filter((value) => !typeOfParam(value));
    params.delete('filter');
    for (const value of kept) params.append('filter', value);
    if (label) params.append('filter', JSON.stringify({type: label}));
    // A different set of products: start from the first batch again (same as
    // the sidebar's stripPagination).
    for (const key of ['show', 'page', 'cursor', 'direction']) {
      params.delete(key);
    }
    const query = params.toString();
    return query ? `?${query}` : '?';
  };

  const pills = [
    {key: 'all', label: allLabel, to: hrefFor(null), isActive: !active},
    ...types.map(({label}) => ({
      key: label,
      label,
      to: hrefFor(active === label ? null : label),
      isActive: active === label,
    })),
  ];

  return (
    <nav className="collection-subtypes" aria-label="Shop by type">
      <ul className="subtype-pills">
        {pills.map((pill) => (
          <li key={pill.key}>
            <Link
              to={pill.to}
              preventScrollReset
              aria-current={pill.isActive ? 'true' : undefined}
              className={`subtype-pill${pill.isActive ? ' is-active' : ''}`}
            >
              {pill.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
