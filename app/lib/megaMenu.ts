import type {HeaderQuery} from 'storefrontapi.generated';

type CategoryMenuKey =
  | 'chainsGroup1'
  | 'chainsGroup2'
  | 'chainsGroup3'
  | 'braceletsMenu'
  | 'earringsMenu'
  | 'pendantsMenu'
  | 'chainWithPendantMenu'
  | 'diamondMenu'
  | 'engagementRingsMenu'
  | 'ringsMenu';

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
    // One column per Shopify menu ("Chains 1/2/3"), in menu order — the
    // dropdown mirrors the admin's own three-way split exactly.
    columns: [
      {menuKeys: ['chainsGroup1']},
      {menuKeys: ['chainsGroup2']},
      {menuKeys: ['chainsGroup3']},
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
    //
    // Sourced from the Shopify `rings` menu rather than a hardcoded list. The
    // hardcoded version drifted: its "Women's Gold Rings" pointed at
    // `womens-rings` ("Women's 10K & 14K Gold Rings"), a different collection
    // overlapping the intended one by 1 product of 250, and nothing in Shopify
    // could correct it. Adding or retargeting a ring category is now an edit to
    // the `rings` menu in the admin, and empty collections drop out on their
    // own via getColumnItems.
    columns: [{menuKeys: ['ringsMenu']}],
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
  diamondMenu: 'diamond',
  engagementRingsMenu: 'engagement-rings',
  ringsMenu: 'rings',
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
        MERGED_CUBAN_HANDLES.some((handle) =>
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
 * Every link in a department, grouped BY COLUMN — one entry per
 * `department.columns`, deduplicated across all of them.
 *
 * A department can be fed by more than one Shopify menu, and the same
 * collection may be linked from several of them under different wordings, so
 * dedupe by collection HANDLE — the only thing that can tell two
 * differently-typed links to the same collection apart.
 *
 * The LABEL is the menu item's own title — the name typed on the menu link in
 * Shopify — not `resource.title`, so merchants can word a nav entry
 * differently from the collection it points at.
 *
 * First occurrence wins, keeping the column order authors set up.
 */
export function getDepartmentColumns(
  header: HeaderQuery,
  department: MegaMenuDepartment,
): MenuItems[] {
  const seen = new Set<string>();

  return department.columns.map((column) =>
    getColumnItems(header, column)
      .filter((item) => item.url)
      .filter((item) => {
        const resource = item.resource;
        // Handle first; fall back to the URL path so non-collection links
        // (pages, external URLs) still dedupe sensibly instead of all
        // collapsing to one.
        const key =
          resource?.__typename === 'Collection' && resource.handle
            ? `collection:${resource.handle}`
            : `url:${item.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  );
}

/** The same links, flattened — for consumers that render one plain list. */
export function getDepartmentItems(
  header: HeaderQuery,
  department: MegaMenuDepartment,
): MenuItems {
  return getDepartmentColumns(header, department).flat();
}

/** Whether a department still has at least one product-backed submenu link. */
export function hasDepartmentItems(
  header: HeaderQuery,
  department: MegaMenuDepartment,
): boolean {
  return getDepartmentItems(header, department).length > 0;
}

/**
 * A department's SUB-category collection handles — its submenu links, and
 * deliberately NOT its own handle.
 *
 * Both halves of that matter when deciding which department a product belongs
 * to. The submenus are needed because a department collection is not a superset
 * of them in Shopify: a product can sit in `cuban-bracelets` without ever being
 * added to `bracelets`. The department's own handle is left out because it is
 * the opposite problem — `rings` and `diamond` are catch-alls that hold half
 * the catalog, so matching on them pulled pieces curated for one department
 * into another's panel.
 */
export function getDepartmentSubCollectionHandles(
  header: HeaderQuery,
  department: MegaMenuDepartment,
  publicStoreDomain: string,
): Set<string> {
  const primaryDomainUrl = header.shop.primaryDomain.url;
  const handles = new Set<string>();

  for (const item of getDepartmentItems(header, department)) {
    if (!item.url) continue;
    const path = toRelativeUrl(item.url, primaryDomainUrl, publicStoreDomain);
    const match = path.match(/\/collections\/([^/?#]+)/);
    if (match) handles.add(match[1]);
  }

  return handles;
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
