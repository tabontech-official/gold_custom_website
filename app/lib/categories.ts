export type StorefrontCategory = {
  label: string;
  handle: string;
  tags?: string[];
};

/**
 * Static shop-by-category tiles shown on the homepage grid and the
 * collection-page category slider. Kept separate from MEGA_MENU (megaMenu.ts)
 * because these are simple label/handle pairs for tile links, not the
 * full nested department/column structure used by the header nav.
 */
export const CATEGORIES: StorefrontCategory[] = [
  {
    label: 'Rings',
    handle: 'rings',
    tags: [
      'All Products',
      'Gold Ring',
      'Gold Ring for Women',
      "Men's Gold Rings",
      'Yellow Gold',
      'Diamond Rings',
      'Engagement',
    ],
  },
  {
    label: 'Chains',
    handle: 'chains',
    tags: [
      'All Products',
      'Cuban Link',
      'Figaro Chain',
      'Rope Chain',
      'Box Chain',
      'Miami Cuban',
      'Presidential',
    ],
  },
  {
    label: 'Bracelets',
    handle: 'bracelets',
    tags: [
      'All Products',
      'Gold Bracelet',
      'Miami Bracelet',
      'Cuban Link Bracelet',
      'Figaro Bracelet',
    ],
  },
  {label: 'Earrings', handle: 'earrings'},
  {label: 'Pendants', handle: 'pendants'},
  {label: 'Necklaces', handle: 'necklaces'},
  {label: 'Diamond', handle: 'diamond'},
  {label: 'Engagement', handle: 'engagement-rings'},
];
