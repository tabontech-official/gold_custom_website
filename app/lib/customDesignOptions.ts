import {RING_SIZES} from './ringSizes';

/**
 * Per-category option sheets for the custom-design form. One source of truth
 * for both sides: CustomJewelryModal renders these as selects, and
 * api.custom-jewelry validates every submitted value against the same lists —
 * so a request can only ever carry options the shop actually offers.
 *
 * The vocabulary is the store's own: karats/metals/stones from browseTags.ts
 * and the product option values, chain/bracelet link styles from
 * categories.ts, ring sizes from ringSizes.ts.
 */

export const PRODUCT_TYPES = [
  'Rings',
  'Engagement Rings',
  'Chains',
  'Bracelets',
  'Pendants & Necklaces',
  'Earrings',
  'Name Necklaces',
  'Charms',
  'Religious Jewelry',
  'Birthstone Jewelry',
  'Zodiac Jewelry',
  'Military Jewelry',
  'Other',
];

export type SpecField = {
  /** Form field name is `spec_${key}`. */
  key: 'metal' | 'karat' | 'stones' | 'size' | 'length' | 'weight' | 'style' | 'budget';
  label: string;
  options: string[];
};

const METAL: SpecField = {
  key: 'metal',
  label: 'Metal color',
  options: ['Yellow Gold', 'White Gold', 'Rose Gold', 'Two-Tone'],
};

const KARAT: SpecField = {
  key: 'karat',
  label: 'Gold karat',
  options: ['10K', '14K', '18K'],
};

const STONES: SpecField = {
  key: 'stones',
  label: 'Stones',
  options: ['No stones', 'Real Diamonds', 'Cubic Zirconia', 'Birthstone / Gemstone', 'Not sure'],
};

const BUDGET: SpecField = {
  key: 'budget',
  label: 'Budget range',
  options: ['Under $500', '$500 – $1,000', '$1,000 – $2,500', '$2,500 – $5,000', '$5,000+', 'Not sure yet'],
};

const RING_SIZE: SpecField = {
  key: 'size',
  label: 'Ring size (US)',
  options: [...RING_SIZES, 'Not sure'],
};

const CHAIN_LENGTH: SpecField = {
  key: 'length',
  label: 'Chain length',
  options: ['16"', '18"', '20"', '22"', '24"', '26"', '28"', '30"', 'Not sure'],
};

const NECKLACE_LENGTH: SpecField = {
  ...CHAIN_LENGTH,
  options: ['Pendant only (no chain)', ...CHAIN_LENGTH.options],
};

const BRACELET_LENGTH: SpecField = {
  key: 'length',
  label: 'Bracelet length',
  options: ['6"', '6.5"', '7"', '7.5"', '8"', '8.5"', '9"', 'Not sure'],
};

/** Gold weight tier — how chains/bracelets are actually quoted. */
const WEIGHT: SpecField = {
  key: 'weight',
  label: 'Weight / thickness',
  options: ['Light (under 10g)', 'Medium (10–25g)', 'Heavy (25–50g)', 'Extra heavy (50g+)', 'Not sure'],
};

const LINK_STYLE: SpecField = {
  key: 'style',
  label: 'Link style',
  options: ['Cuban Link', 'Miami Cuban', 'Figaro', 'Rope', 'Box', 'Presidential', 'Franco', 'Herringbone', 'Other'],
};

const style = (label: string, options: string[]): SpecField => ({
  key: 'style',
  label,
  options: [...options, 'Other'],
});

export const CATEGORY_SPECS: Record<string, SpecField[]> = {
  Rings: [
    METAL,
    KARAT,
    STONES,
    RING_SIZE,
    style('Ring style', ['Statement', 'Everyday', 'Dainty', 'Pavé', 'Promise', 'Baguette Diamond', 'Signet']),
    BUDGET,
  ],
  'Engagement Rings': [
    METAL,
    KARAT,
    {...STONES, label: 'Center stone', options: ['Real Diamond', 'Lab-Grown Diamond', 'Cubic Zirconia', 'Gemstone', 'Not sure']},
    RING_SIZE,
    style('Setting style', ['Solitaire', 'Halo', 'Hidden Halo', 'Pavé', 'Three-Stone', 'Vintage']),
    BUDGET,
  ],
  Chains: [METAL, KARAT, LINK_STYLE, CHAIN_LENGTH, WEIGHT, BUDGET],
  Bracelets: [
    METAL,
    KARAT,
    {...LINK_STYLE, options: ['Cuban Link', 'Miami Cuban', 'Figaro', 'Rope', 'Tennis', 'Bangle', 'ID Bracelet', 'Other']},
    BRACELET_LENGTH,
    WEIGHT,
    BUDGET,
  ],
  'Pendants & Necklaces': [
    METAL,
    KARAT,
    STONES,
    style('Pendant style', ['Initial / Letter', 'Monogram', 'Cross', 'Crown', 'Butterfly', 'Picture / Photo', 'Iced Out']),
    NECKLACE_LENGTH,
    BUDGET,
  ],
  Earrings: [
    METAL,
    KARAT,
    STONES,
    style('Earring style', ['Studs', 'Hoops', 'Huggies', 'Drops / Dangle']),
    BUDGET,
  ],
  'Name Necklaces': [
    METAL,
    KARAT,
    style('Lettering style', ['Script name', 'Block letters', 'Diamond name', 'Monogram', 'Single initial']),
    CHAIN_LENGTH,
    BUDGET,
  ],
  Charms: [METAL, KARAT, STONES, BUDGET],
  'Religious Jewelry': [
    METAL,
    KARAT,
    STONES,
    style('Piece', ['Cross Pendant', 'Saint Pendant', 'Virgin Mary', 'Rosary', 'Angel', 'Praying Hands']),
    BUDGET,
  ],
  'Birthstone Jewelry': [
    METAL,
    KARAT,
    {
      key: 'stones',
      label: 'Birthstone month',
      options: [
        'January – Garnet', 'February – Amethyst', 'March – Aquamarine', 'April – Diamond',
        'May – Emerald', 'June – Pearl', 'July – Ruby', 'August – Peridot',
        'September – Sapphire', 'October – Opal', 'November – Topaz', 'December – Tanzanite',
      ],
    },
    style('Piece type', ['Ring', 'Pendant', 'Earrings', 'Bracelet']),
    BUDGET,
  ],
  'Zodiac Jewelry': [
    METAL,
    KARAT,
    STONES,
    {
      key: 'style',
      label: 'Zodiac sign',
      options: [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
      ],
    },
    BUDGET,
  ],
  'Military Jewelry': [METAL, KARAT, STONES, BUDGET],
  Other: [METAL, KARAT, STONES, BUDGET],
};

/**
 * Read and validate the spec selections for a chosen category. Every field in
 * the category's sheet is required and must be one of its listed options —
 * anything else (a tampered value, a stale form) comes back as a field error.
 */
export function readSpecSelections(
  productType: string,
  get: (name: string) => string,
): {selections: Array<[string, string]>; errors: Record<string, string>} {
  const selections: Array<[string, string]> = [];
  const errors: Record<string, string> = {};
  for (const field of CATEGORY_SPECS[productType] ?? []) {
    const value = get(`spec_${field.key}`).trim();
    if (!value) {
      errors[`spec_${field.key}`] = `Please choose a ${field.label.toLowerCase()}.`;
    } else if (!field.options.includes(value)) {
      errors[`spec_${field.key}`] = 'Please choose one of the listed options.';
    } else {
      selections.push([field.label, value]);
    }
  }
  return {selections, errors};
}

/** "Metal color: Yellow Gold · Gold karat: 14K · …" for the email/metafield. */
export function specSummary(selections: Array<[string, string]>): string {
  return selections.map(([label, value]) => `${label}: ${value}`).join(' · ');
}
