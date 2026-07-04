export type StorefrontCategory = {
  label: string;
  handle: string;
};

/**
 * Static shop-by-category tiles shown on the homepage grid and the
 * collection-page category slider. Kept separate from MEGA_MENU (megaMenu.ts)
 * because these are simple label/handle pairs for tile links, not the
 * full nested department/column structure used by the header nav.
 */
export const CATEGORIES: StorefrontCategory[] = [
  {label: 'Rings', handle: 'rings'},
  {label: 'Chains', handle: 'chains'},
  {label: 'Bracelets', handle: 'bracelets'},
  {label: 'Earrings', handle: 'earrings'},
  {label: 'Pendants', handle: 'pendants'},
  {label: 'Necklaces', handle: 'necklaces'},
  {label: 'Diamond', handle: 'diamond'},
  {label: 'Engagement', handle: 'engagement-rings'},
];
