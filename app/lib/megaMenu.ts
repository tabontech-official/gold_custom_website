import type {HeaderQuery} from 'storefrontapi.generated';

type CategoryMenuKey =
  | 'ringsPrimary'
  | 'ringsSecondary'
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
  menuKeys: CategoryMenuKey[];
};

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
      {menuKeys: ['chainsGroup1']},
      {menuKeys: ['chainsGroup2']},
      {menuKeys: ['chainsGroup3']},
    ],
  },
  {
    id: 'necklaces',
    label: 'Necklaces',
    to: '/collections/necklaces',
    columns: [{menuKeys: ['chainWithPendantMenu', 'necklacesMenu']}],
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
    columns: [{menuKeys: ['ringsPrimary']}, {menuKeys: ['ringsSecondary']}],
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

export function getColumnItems(
  header: HeaderQuery,
  column: MegaMenuColumn,
): NonNullable<HeaderQuery['ringsPrimary']>['items'] {
  return column.menuKeys.flatMap((key) => header[key]?.items ?? []);
}

/** Finds the mega-menu department whose `to` matches a given collection path. */
export function getMegaMenuDepartmentForHandle(
  handle: string,
): MegaMenuDepartment | undefined {
  return MEGA_MENU.find((department) => department.to === `/collections/${handle}`);
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
