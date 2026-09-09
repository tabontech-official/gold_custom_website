import {NavLink} from 'react-router';
import type {HeaderQuery} from 'storefrontapi.generated';
import {
  departmentLinkState,
  getColumnItems,
  getDepartmentForCollectionHandle,
  toRelativeUrl,
  useDepartmentHint,
} from '~/lib/megaMenu';

function pillClassName({isActive}: {isActive: boolean}) {
  return isActive ? 'subnav-pill is-active' : 'subnav-pill';
}

export function CollectionSubNav({
  handle,
  header,
  publicStoreDomain,
}: {
  handle: string;
  header: HeaderQuery;
  publicStoreDomain: string;
}) {
  const primaryDomainUrl = header.shop.primaryDomain.url;
  const department = getDepartmentForCollectionHandle({
    handle,
    header,
    publicStoreDomain,
    preferDepartmentId: useDepartmentHint(),
  });

  if (!department) return null;

  const items = department.columns.flatMap((column) =>
    getColumnItems(header, column),
  );
  if (!items.length) return null;

  return (
    <nav className="subnav-pills" aria-label={`${department.label} subcategories`}>
      <NavLink to={department.to} end className={pillClassName}>
        All {department.label}
      </NavLink>
      {items.map((item) =>
        item.url ? (
          <NavLink
            key={item.id}
            to={toRelativeUrl(item.url, primaryDomainUrl, publicStoreDomain)}
            state={departmentLinkState(department.id)}
            className={pillClassName}
          >
            {item.title}
          </NavLink>
        ) : null,
      )}
    </nav>
  );
}
