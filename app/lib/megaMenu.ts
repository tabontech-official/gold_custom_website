import type {HeaderQuery} from 'storefrontapi.generated';

type CategoryMenuKey =
  | 'chainsGroup1'
  | 'chainsGroup2'
  | 'chainsGroup3'
  | 'braceletsMenu'
  | 'earringsMenu'
  | 'pendantsMenu'
  | 'chainWithPendantMenu'
  | 'necklacesMenu'
  | 'diamondMenu'
  | 'engagementRingsMenu';

export type MegaMenuColumn = {
  title?: string;
  menuKeys?: CategoryMenuKey[];
  /** Curated links, used instead of a Shopify menu for this column. */
  items?: Array<{title: string; handle: string}>;
};

/**
 * Shopify splits Miami Cuban across three menu links. `cuban-chains` is a
 * superset of the other two, so it backs the single "Miami Cuban Chains" link
 * on the Chains department below; the subsets are hidden from every menu and
 * their collection pages redirect here (see collections.$handle).
 */
export const MIAMI_CUBAN_HANDLE = 'cuban-chains';
export const MERGED_CUBAN_HANDLES = ['miami-cuban-links', 'miami-cuban-chains'];

export type MegaMenuDepartment = {
  id: string;
  label: string;
  to: string;
  columns: MegaMenuColumn[];
};

/**
 * Static mapping from Shopify's flat, independently-handled category menus
 * (rings-1, chains-copy, bracelets, etc.) to the mega-menu departments shown
 * in the header. The Storefront API has no way to fetch these as one nested
 * tree, so the grouping lives here instead of in Shopify's menu editor.
 */
export const MEGA_MENU: MegaMenuDepartment[] = [
  {
    id: 'bracelets',
    label: 'Bracelets',
    to: '/collections/bracelets',
    columns: [{menuKeys: ['braceletsMenu']}],
  },
  {
    id: 'chains',
    label: 'Chains',
    to: '/collections/chains',
    columns: [
      {items: [{title: 'Miami Cuban Chains', handle: MIAMI_CUBAN_HANDLE}]},
      {menuKeys: ['chainsGroup1']},
      {menuKeys: ['chainsGroup2']},
      {menuKeys: ['chainsGroup3']},
      {menuKeys: ['necklacesMenu']},
    ],
  },
  {
    id: 'necklaces',
    label: 'Necklaces',
    to: '/collections/necklaces',
    columns: [{menuKeys: ['chainWithPendantMenu']}],
  },
  {
    id: 'earrings',
    label: 'Earrings',
    to: '/collections/earrings',
    columns: [{menuKeys: ['earringsMenu']}],
  },
  {
    id: 'pendants',
    label: 'Pendants',
    to: '/collections/pendants',
    columns: [{menuKeys: ['pendantsMenu']}],
  },
  {
    id: 'rings',
    label: 'Rings',
    to: '/collections/rings',
    // Engagement rings are their own department, so they stay out of here.
    columns: [
      {
        items: [
          {title: "Men's Gold Rings", handle: 'men-rings'},
          {title: "Women's Gold Rings", handle: 'womens-rings'},
          {title: "Men's Diamond Rings", handle: 'mens-diamond-rings'},
          {title: "Women's Diamond Rings", handle: 'womens-diamond-ring'},
        ],
      },
    ],
  },
  {
    id: 'engagement-rings',
    label: 'Engagement Rings',
    to: '/collections/engagement-rings',
    columns: [{menuKeys: ['engagementRingsMenu']}],
  },
  {
    id: 'diamond',
    label: 'Diamond',
    to: '/collections/diamond',
    columns: [{menuKeys: ['diamondMenu']}],
  },
];

/**
 * Shopify menu handle behind each `CategoryMenuKey`, mirroring the aliases in
 * HEADER_QUERY. Lets the collection loader look up a child's parent department
 * without pulling the whole header query.
 */
export const CATEGORY_MENU_HANDLES: Record<CategoryMenuKey, string> = {
  chainsGroup1: 'chains-copy-copy-1',
  chainsGroup2: 'chains-copy-copy',
  chainsGroup3: 'chains-copy',
  braceletsMenu: 'bracelets-1',
  earringsMenu: 'earrings',
  pendantsMenu: 'pendants',
  chainWithPendantMenu: 'chain-with-pendant',
  necklacesMenu: 'necklaces',
  diamondMenu: 'diamond',
  engagementRingsMenu: 'engagement-rings',
};

type MenuItems = NonNullable<HeaderQuery['braceletsMenu']>['items'];

export function getColumnItems(
  header: HeaderQuery,
  column: MegaMenuColumn,
): MenuItems {
  if (column.items) {
    return column.items.map((item) => ({
      id: item.handle,
      title: item.title,
      url: `/collections/${item.handle}`,
    })) as unknown as MenuItems;
  }

  return (column.menuKeys ?? [])
    .flatMap((key) => header[key]?.items ?? [])
    .filter((item) => {
      if (
        [MIAMI_CUBAN_HANDLE, ...MERGED_CUBAN_HANDLES].some((handle) =>
          item.url?.endsWith(`/collections/${handle}`),
        )
      )
        return false;
      // Keep non-collection links (such as informational pages), but omit a
      // collection whenever Shopify reports that it has no products.
      if (item.resource?.__typename !== 'Collection') return true;
      return item.resource.products.nodes.length > 0;
    });
}

/**
 * Every link in a department, across all its columns — deduplicated, and titled
 * from the collection rather than the menu link.
 *
 * Both corrections exist because of the same real breakage. The Chains
 * department is fed by four separate Shopify menus, and `clover-necklace` is
 * linked from more than one of them, so it rendered TWICE in one dropdown. The
 * two copies did not even agree: one menu item had been retitled to "Clover
 * Necklaces" and the other still read "Women Necklaces", because renaming a
 * collection in Shopify does not touch the hand-typed title on a menu link
 * pointing at it.
 *
 * So:
 *  - the key is the collection HANDLE, which is the only thing that can tell
 *    two differently-typed links to the same collection apart;
 *  - the label prefers `resource.title`, the collection's live name, so a
 *    rename in Shopify shows up here without anyone editing a menu.
 *
 * First occurrence wins, keeping the column order authors set up.
 */
export function getDepartmentItems(
  header: HeaderQuery,
  department: MegaMenuDepartment,
): MenuItems {
  const seen = new Set<string>();

  return department.columns
    .flatMap((column) => getColumnItems(header, column))
    .filter((item) => item.url)
    .map((item) => {
      const resource = item.resource;
      const title =
        resource?.__typename === 'Collection' && resource.title
          ? resource.title
          : item.title;
      return title === item.title ? item : {...item, title};
    })
    .filter((item) => {
      const resource = item.resource;
      // Handle first; fall back to the URL path so non-collection links (pages,
      // external URLs) still dedupe sensibly instead of all collapsing to one.
      const key =
        resource?.__typename === 'Collection' && resource.handle
          ? `collection:${resource.handle}`
          : `url:${item.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Whether a department still has at least one product-backed submenu link. */
export function hasDepartmentItems(
  header: HeaderQuery,
  department: MegaMenuDepartment,
): boolean {
  return getDepartmentItems(header, department).length > 0;
}

/**
 * Every collection handle already reachable from the header nav (departments
 * plus their submenu links). Used to show only the *rest* of the catalog's
 * collections in the collection-page sidebar.
 */
export function getNavCollectionHandles(
  header: HeaderQuery,
  publicStoreDomain: string,
): Set<string> {
  const primaryDomainUrl = header.shop.primaryDomain.url;
  const handles = new Set<string>(MERGED_CUBAN_HANDLES);

  for (const department of MEGA_MENU) {
    handles.add(department.to.replace('/collections/', ''));
    for (const column of department.columns) {
      for (const item of getColumnItems(header, column)) {
        const path = item.url
          ? toRelativeUrl(item.url, primaryDomainUrl, publicStoreDomain)
          : '';
        const match = path.match(/\/collections\/([^/?#]+)/);
        if (match) handles.add(match[1]);
      }
    }
  }

  return handles;
}

/** Finds the mega-menu department whose `to` matches a given collection path. */
export function getMegaMenuDepartmentForHandle(
  handle: string,
): MegaMenuDepartment | undefined {
  return MEGA_MENU.find(
    (department) => department.to === `/collections/${handle}`,
  );
}

/**
 * The department crumb that sits above a collection in the trail — "Pendants"
 * for `religious-pendants`.
 *
 * Lives here rather than in a route because BOTH the collection page and the
 * product page need it, and they disagreed while it was private to the
 * collection route: a category page showed Home / Shop / Pendants / Religious
 * Pendants, and the product under it showed Home / Shop / Religious Pendants /
 * <product>, silently dropping a level on the deepest page of the funnel.
 *
 * Resolves against the LIVE header rather than MEGA_MENU's curated items,
 * because most departments source their children from Shopify menus — matching
 * only the static table would miss those. `getMegaMenuParentHandle` is the
 * handle-only equivalent for loaders, which have no header in scope.
 *
 * Returns null for a department itself (nothing sits above it) and whenever
 * the header has not loaded, so callers can pass the result straight into a
 * crumb list — <Breadcrumb> already drops nullish entries.
 */
export function getMegaMenuParentCrumb({
  handle,
  header,
  publicStoreDomain,
}: {
  handle?: string | null;
  header?: HeaderQuery | null;
  publicStoreDomain?: string | null;
}): {label: string; to: string} | null {
  if (!handle || !header || !publicStoreDomain) return null;
  if (getMegaMenuDepartmentForHandle(handle)) return null;

  const currentPath = `/collections/${handle}`;
  const primaryDomainUrl = header.shop.primaryDomain.url;
  const parent = MEGA_MENU.find((department) =>
    department.columns.some((column) =>
      getColumnItems(header, column).some(
        (item) =>
          Boolean(item.url) &&
          toRelativeUrl(item.url!, primaryDomainUrl, publicStoreDomain) ===
            currentPath,
      ),
    ),
  );

  return parent ? {label: parent.label, to: parent.to} : null;
}

/**
 * The department handle a child collection sits under, for inheriting the
 * parent's FAQ/cover metaobjects on child category pages.
 *
 * Checks the statically-curated `columns[].items` first, then the Shopify menus
 * behind `menuKeys` — most departments source their children from those, so the
 * static table alone would miss them. Pass `menuItemHandles` (menu key -> the
 * collection handles in that menu) to cover the latter; without it only curated
 * children resolve.
 */
export function getMegaMenuParentHandle(
  handle: string,
  menuItemHandles?: Partial<Record<CategoryMenuKey, string[]>>,
): string | undefined {
  if (getMegaMenuDepartmentForHandle(handle)) return undefined;

  const normalized = handle.toLowerCase();
  const parent = MEGA_MENU.find((department) =>
    department.columns.some(
      (column) =>
        (column.items ?? []).some(
          (item) => item.handle.toLowerCase() === normalized,
        ) ||
        (column.menuKeys ?? []).some((key) =>
          (menuItemHandles?.[key] ?? []).some(
            (menuHandle) => menuHandle.toLowerCase() === normalized,
          ),
        ),
    ),
  );

  return parent?.to.replace('/collections/', '');
}

/** Pulls `/collections/<handle>` out of each item URL in a fetched menu. */
export function collectionHandlesFromMenu(
  menu?: {items?: Array<{url?: string | null}> | null} | null,
): string[] {
  return (menu?.items ?? []).flatMap((item) => {
    const match = item.url?.match(/\/collections\/([^/?#]+)/);
    return match ? [match[1]] : [];
  });
}

export function toRelativeUrl(
  url: string,
  primaryDomainUrl: string,
  publicStoreDomain: string,
): string {
  return url.includes('myshopify.com') ||
    url.includes(publicStoreDomain) ||
    url.includes(primaryDomainUrl)
    ? new URL(url).pathname
    : url;
}
