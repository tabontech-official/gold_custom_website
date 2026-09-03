/**
 * Step sheets for the custom-design builder. One source of truth for both
 * sides: CustomDesignBuilder renders these as tile steps, and
 * api.custom-jewelry validates every submitted value against the same lists —
 * so a request can only ever carry options the shop actually offers.
 *
 * The vocabulary is the store's own: karats/metals/stones from browseTags.ts
 * and the product option values, and every style option that names a live
 * collection carries its handle in `imageHandle` — the builder shows that
 * collection's photo in a circle, exactly like the header's circular sub-nav
 * (same /api/collection-products endpoint, same image fallback chain).
 * Handles verified against the live catalogue on 2026-09-03.
 */

export const PRODUCT_TYPES = ['Ring', 'Chain', 'Bracelet', 'Earrings', 'Pendant'];

export type SpecOption = {
  value: string;
  /** Small line under the value on the tile ("Our best seller"). */
  caption?: string;
  /** CSS background for the tile's swatch circle (metals, stones). */
  swatch?: string;
  /** Live collection whose image illustrates this option as a photo circle. */
  imageHandle?: string;
  /** Direct image URL (a file in /public) shown as the photo circle instead. */
  image?: string;
  /** Named line icon (see OPTION_ICONS in the builder) for icon-card options. */
  icon?: string;
};

export type SpecField = {
  /** Form field name is `spec_${key}`. */
  key: 'kind' | 'style' | 'metal' | 'karat' | 'stones' | 'size' | 'length' | 'weight' | 'budget';
  /** Step heading — "Pick your metal". */
  label: string;
  /** Short name for chips and the review table — "Metal". */
  short: string;
  options: SpecOption[];
  /** Branching: the field only applies when this earlier answer was given. */
  when?: {key: SpecField['key']; value: string};
};

const gold = (from: string, to: string) =>
  `radial-gradient(circle at 35% 30%, ${from}, ${to})`;

/**
 * Faceted-gem look from pure CSS: a center "table" facet, then alternating
 * light/mid/dark conic wedges around it — real stones read as many tones of
 * one color, never a flat fill. The builder's ball styling adds the gloss.
 */
const gem = (light: string, mid: string, dark: string) =>
  [
    `radial-gradient(circle at 50% 42%, ${light} 0 17%, rgba(255,255,255,0) 18%)`,
    `conic-gradient(from 15deg, ${mid} 0 28deg, ${light} 0 55deg, ${dark} 0 90deg,` +
      ` ${mid} 0 122deg, ${light} 0 150deg, ${dark} 0 185deg, ${mid} 0 215deg,` +
      ` ${light} 0 245deg, ${dark} 0 280deg, ${mid} 0 310deg, ${light} 0 335deg, ${dark} 0 360deg)`,
  ].join(', ');

const METAL: SpecField = {
  key: 'metal',
  label: 'Pick your metal',
  short: 'Metal',
  options: [
    {value: 'Yellow Gold', swatch: gold('#f9dd94', '#c8951f')},
    {value: 'White Gold', swatch: gold('#f4f4f2', '#a9adb3')},
    {value: 'Rose Gold', swatch: gold('#f6cdba', '#c87f62')},
    {
      value: 'Two-Tone',
      swatch: 'linear-gradient(105deg, #e9c56a 48%, #b9bdc3 52%)',
    },
  ],
};

const KARAT: SpecField = {
  key: 'karat',
  label: 'Choose the gold karat',
  short: 'Karat',
  options: [
    {value: '10K', caption: 'Durable · budget-friendly'},
    {value: '14K', caption: 'Our best seller'},
    {value: '18K', caption: 'Richest color'},
  ],
};

const STONES: SpecField = {
  key: 'stones',
  label: 'Choose your stones',
  short: 'Stones',
  options: [
    {value: 'Real Diamonds', swatch: gem('#ffffff', '#dde6ed', '#a9bcc9')},
    {value: 'Cubic Zirconia', swatch: gem('#fbfcfd', '#e3e6ea', '#b8bdc4')},
    {value: 'Gemstone', caption: 'Sapphire, ruby, emerald…', swatch: gem('#93c4ef', '#2f6cb4', '#123a70')},
    {value: 'No stones'},
    {value: 'Not sure'},
  ],
};

/* Eight brackets, low to high. The " – " separator is what the builder
   splits on to stack min over max on the card. */
const BUDGET: SpecField = {
  key: 'budget',
  label: 'Set your budget',
  short: 'Budget',
  options: [
    {value: '$200 – $500'},
    {value: '$500 – $1,000'},
    {value: '$1,000 – $1,500'},
    {value: '$1,500 – $2,500'},
    {value: '$2,500 – $5,000'},
    {value: '$5,000 – $10,000'},
    {value: '$10,000 – $20,000'},
    {value: '$20,000+'},
  ],
};

/** US 4–12 in half steps — the printable chart's own granularity. */
const RING_SIZE: SpecField = {
  key: 'size',
  label: 'Your ring size (US)',
  short: 'Size',
  options: [
    ...Array.from({length: 17}, (_, i) => ({value: String(4 + i * 0.5)})),
    {value: 'Not sure'},
  ],
};

const CHAIN_LENGTH: SpecField = {
  key: 'length',
  label: 'Choose the length',
  short: 'Length',
  options: [
    {value: '16"'},
    {value: '18"', caption: 'Most popular'},
    {value: '20"'},
    {value: '22"'},
    {value: '24"'},
    {value: '26"'},
    {value: '28"'},
    {value: '30"'},
    {value: 'Not sure'},
  ],
};

const NECKLACE_LENGTH: SpecField = {
  ...CHAIN_LENGTH,
  options: [{value: 'Pendant only', caption: 'No chain'}, ...CHAIN_LENGTH.options],
};

const BRACELET_LENGTH: SpecField = {
  key: 'length',
  label: 'Choose the length',
  short: 'Length',
  options: [
    {value: '6"'},
    {value: '6.5"'},
    {value: '7"', caption: 'Most popular'},
    {value: '7.5"'},
    {value: '8"'},
    {value: '8.5"'},
    {value: '9"'},
    {value: 'Not sure'},
  ],
};

/** Gold weight tier — how chains and bracelets are actually quoted. */
const WEIGHT: SpecField = {
  key: 'weight',
  label: 'How heavy should it be?',
  short: 'Weight',
  options: [
    {value: 'Light', caption: 'Under 10g'},
    {value: 'Medium', caption: '10–25g'},
    {value: 'Heavy', caption: '25–50g'},
    {value: 'Extra heavy', caption: '50g+'},
    {value: 'Not sure'},
  ],
};

/* Engagement center stones — rendered as colored gem balls. */
const ENGAGEMENT_STONES: SpecField = {
  key: 'stones',
  label: 'Choose the center stone',
  short: 'Stone',
  // Real stone photos live in /public; the rest keep the CSS gem until
  // their photos are added — just set `image` and drop the swatch.
  options: [
    {value: 'Diamond', image: '/diamond.jpg'},
    {value: 'Emerald', image: '/emreld.jpg'},
    {value: 'Moissanite', image: '/moissanite.jpg'},
    {value: 'Sapphire', image: '/blue-sapphire.jpeg'},
    {value: 'Morganite', image: '/morganite.jpg'},
    {value: 'Ruby', image: '/ruby.jpg'},
    {
      // Opal is not faceted — soft iridescent play of color instead.
      value: 'Opal',
      swatch:
        'radial-gradient(circle at 35% 30%, #fdfdf4, rgba(255,255,255,0) 45%), ' +
        'radial-gradient(circle at 68% 62%, #f3cfe2, rgba(255,255,255,0) 55%), ' +
        'radial-gradient(circle at 30% 72%, #bcd9f2, rgba(255,255,255,0) 50%), ' +
        'radial-gradient(circle at 60% 25%, #c8ecd8, #dfe9f2)',
    },
    {value: 'Pearl', image: '/pearl.png'},
  ],
};

const style = (label: string, options: SpecOption[]): SpecField => ({
  key: 'style',
  label,
  short: 'Style',
  options: [...options, {value: 'Other'}],
});

export const CATEGORY_SPECS: Record<string, SpecField[]> = {
  Ring: [
    {
      key: 'kind',
      label: 'What kind of ring?',
      short: 'Type',
      options: [
        {value: 'Engagement', caption: 'The question ring', icon: 'engagement'},
        {value: 'Casual', caption: 'Everyday & statement', icon: 'casual'},
      ],
    },
    {
      ...style('Pick your setting', [
        {value: 'Round', imageHandle: 'round-engagement-rings'},
        {value: 'Oval', imageHandle: 'oval-engagement-rings'},
        {value: 'Cushion', imageHandle: 'cushion-engagement-rings'},
        {value: 'Princess', imageHandle: 'princess-engagement-rings'},
        {value: 'Emerald', imageHandle: 'emerald-engagement-rings'},
        {value: 'Radiant', imageHandle: 'radiant-engagement-rings'},
        {value: 'Pear', imageHandle: 'pear-engagement-rings'},
        {value: 'Marquise', imageHandle: 'marquis-engagement-rings'},
        {value: 'Halo', imageHandle: 'halo-engagement-rings'},
        {value: 'Solitaire', imageHandle: 'solitaire-rings'},
      ]),
      when: {key: 'kind', value: 'Engagement'},
    },
    {
      ...style('Pick the ring style', [
        {value: 'Wedding Band', imageHandle: 'wedding-band-rings'},
        {value: 'Signet', imageHandle: 'mens-signet-rings'},
        {value: 'Cocktail', imageHandle: 'cocktail-rings'},
        {value: 'Eternity', imageHandle: 'eternity-rings'},
        {value: 'Stackable', imageHandle: 'stackable-rings'},
        {value: 'Heart', imageHandle: 'heart-rings'},
        {value: 'Nugget', imageHandle: 'nugget-rings'},
        {value: 'Cuban Link', imageHandle: 'cuban-link-rings'},
      ]),
      when: {key: 'kind', value: 'Casual'},
    },
    METAL,
    KARAT,
    {...ENGAGEMENT_STONES, when: {key: 'kind', value: 'Engagement'}},
    {...STONES, when: {key: 'kind', value: 'Casual'}},
    RING_SIZE,
    BUDGET,
  ],
  Chain: [
    style('Pick the link style', [
      {value: 'Cuban Link', imageHandle: 'cuban-chains'},
      {value: 'Miami Cuban', imageHandle: 'miami-cuban-links'},
      {value: 'Rope', imageHandle: 'rope-chains'},
      {value: 'Figaro', imageHandle: 'figaro-chains'},
      {value: 'Franco', imageHandle: 'franco-chains'},
      {value: 'Curb', imageHandle: 'curb-chains'},
      {value: 'Box', imageHandle: 'cut-box-chains'},
      {value: 'Tennis', imageHandle: 'tennis-chains'},
      {value: 'Ice', imageHandle: 'ice-chains'},
    ]),
    METAL,
    KARAT,
    CHAIN_LENGTH,
    WEIGHT,
    BUDGET,
  ],
  Bracelet: [
    style('Pick the bracelet style', [
      {value: 'Cuban Link', imageHandle: 'cuban-bracelets'},
      {value: 'Rope', imageHandle: 'rope-bracelets'},
      {value: 'Tennis', imageHandle: 'tennis-bracelets'},
      {value: 'Classic Link', imageHandle: 'classic-link-bracelets'},
      {value: 'Flat Link', imageHandle: 'flat-link-bracelets'},
      {value: 'Diamond', imageHandle: 'diamond-bracelets'},
      {value: 'Baby Bracelet', imageHandle: 'baby-bracelets'},
    ]),
    METAL,
    KARAT,
    BRACELET_LENGTH,
    WEIGHT,
    BUDGET,
  ],
  Earrings: [
    style('Pick the earring style', [
      {value: 'Studs', imageHandle: 'stud-earrings'},
      {value: 'Hoops', imageHandle: 'hoop-earrings'},
      {value: 'Diamond Studs', imageHandle: 'diamond-stud-earrings'},
      {value: 'Nugget', imageHandle: 'nugget-earrings'},
      {value: 'Huggies'},
      {value: 'Drops / Dangle'},
    ]),
    METAL,
    KARAT,
    STONES,
    BUDGET,
  ],
  Pendant: [
    style('Pick the pendant style', [
      {value: 'Cross', imageHandle: 'cross-pendants'},
      {value: 'Religious', imageHandle: 'religious-pendants'},
      {value: 'Initial / Letter', imageHandle: 'initial-pendant'},
      {value: 'Picture / Photo', imageHandle: 'picture-pendants'},
      {value: 'Nameplate', imageHandle: 'name-necklaces'},
      {value: 'Medallion', imageHandle: 'medallions'},
      {value: 'Angel', imageHandle: 'angel-pendants'},
    ]),
    METAL,
    KARAT,
    STONES,
    NECKLACE_LENGTH,
    BUDGET,
  ],
};

/** The fields that apply given the answers so far (branching via `when`). */
export function activeFields(
  productType: string,
  get: (key: SpecField['key']) => string,
): SpecField[] {
  return (CATEGORY_SPECS[productType] ?? []).filter(
    (field) => !field.when || get(field.when.key) === field.when.value,
  );
}

/**
 * Read and validate the spec selections for a chosen category. Every
 * applicable field in the category's sheet is required and must be one of its
 * listed options — anything else (a tampered value, a stale form) comes back
 * as a field error.
 */
export function readSpecSelections(
  productType: string,
  get: (name: string) => string,
): {selections: Array<[string, string]>; errors: Record<string, string>} {
  const selections: Array<[string, string]> = [];
  const errors: Record<string, string> = {};
  for (const field of activeFields(productType, (key) =>
    get(`spec_${key}`).trim(),
  )) {
    const value = get(`spec_${field.key}`).trim();
    if (!value) {
      errors[`spec_${field.key}`] = `Please choose a ${field.short.toLowerCase()}.`;
    } else if (!field.options.some((option) => option.value === value)) {
      errors[`spec_${field.key}`] = 'Please choose one of the listed options.';
    } else {
      selections.push([field.short, value]);
    }
  }
  return {selections, errors};
}

/** "Metal: Yellow Gold · Karat: 14K · …" for the email/metafield. */
export function specSummary(selections: Array<[string, string]>): string {
  return selections.map(([label, value]) => `${label}: ${value}`).join(' · ');
}
