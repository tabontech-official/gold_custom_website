import {Link} from 'react-router';

export type Crumb = {
  /** Text shown for this level. */
  label: string;
  /** Destination. Omit for the current (last) page — it renders as plain text. */
  to?: string;
};

/**
 * Reusable breadcrumb trail. Every level with a `to` is a clickable link that
 * navigates directly to that page; the last item is always the current page.
 * Pass the crumbs deepest-last, e.g.
 *   [{label:'Home',to:'/'}, {label:'Rings',to:'/collections/rings'}, {label:title}]
 */
export function Breadcrumb({
  items,
  className,
}: {
  items: Array<Crumb | null | undefined>;
  className?: string;
}) {
  const crumbs = items.filter(
    (item): item is Crumb => Boolean(item?.label),
  );
  if (crumbs.length === 0) return null;

  return (
    <nav
      className={className ? `breadcrumb ${className}` : 'breadcrumb'}
      aria-label="Breadcrumb"
    >
      <ol className="breadcrumb-list">
        {crumbs.map((item, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li className="breadcrumb-item" key={`${item.label}-${item.to ?? 'current'}`}>
              {item.to && !isLast ? (
                <Link to={item.to} prefetch="intent">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'is-current' : undefined}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="breadcrumb-sep" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
