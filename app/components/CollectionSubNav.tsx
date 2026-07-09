import {NavLink} from 'react-router';
import type {HeaderQuery} from 'storefrontapi.generated';
import {
  getColumnItems,
  getMegaMenuDepartmentForHandle,
  MEGA_MENU,
  toRelativeUrl,
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
  const currentPath = `/collections/${handle}`;
  const department =
    getMegaMenuDepartmentForHandle(handle) ??
    MEGA_MENU.find((menuDepartment) =>
      menuDepartment.columns.some((column) =>
        getColumnItems(header, column).some((item) => {
          if (!item.url) return false;
          return (
            toRelativeUrl(item.url, primaryDomainUrl, publicStoreDomain) ===
            currentPath
          );
        }),
      ),
    );

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
            className={pillClassName}
          >
            {item.title}
          </NavLink>
        ) : null,
      )}
    </nav>
  );
}
