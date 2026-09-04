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
  key:
    | 'kind'
    | 'style'
    | 'design'
    | 'font'
    | 'shape'
    | 'finish'
    | 'extra'
    | 'chain'
    | 'metal'
    | 'karat'
    | 'stones'
    | 'stonetype'
    | 'coverage'
    | 'carat'
    | 'construction'
    | 'width'
    | 'clasp'
    | 'pendant'
    | 'engraving'
    | 'size'
    | 'length'
    | 'weight'
    | 'budget';
  /** Step heading — "Pick your metal". */
  label: string;
  /** Short name for chips and the review table — "Metal". */
  short: string;
  options: SpecOption[];
  /** Branching: the field only applies when this earlier answer was given
   *  (a single value, or any one of a list of values). */
  when?: {key: SpecField['key']; value: string | string[]};
};

/** Does an answer satisfy a `when` condition? */
export function whenMatches(
  when: NonNullable<SpecField['when']>,
  answer: string,
): boolean {
  return Array.isArray(when.value)
    ? when.value.includes(answer)
    : when.value === answer;
}

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

/* The one stone vocabulary, used everywhere stones are asked — engagement
   rings, casual rings, earrings, chains. Photos live in /public; add a
   stone's photo by swapping its swatch for `image: '/file.jpg'`. */
const STONE_OPTIONS: SpecOption[] = [
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
];

const STONES: SpecField = {
  key: 'stones',
  label: 'Choose your stones',
  short: 'Stones',
  options: [...STONE_OPTIONS, {value: 'No stones'}, {value: 'Not sure'}],
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
    {value: 'Custom Length'},
  ],
};

const BRACELET_LENGTH: SpecField = {
  key: 'length',
  label: 'Your wrist size',
  short: 'Wrist',
  options: [
    {value: '6"'},
    {value: '6.5"'},
    {value: '7"', caption: 'Most popular'},
    {value: '7.5"'},
    {value: '8"'},
    {value: '8.5"'},
    {value: 'Custom Size'},
  ],
};

/** Solid vs hollow — the gold-value question, asked on chains and bracelets. */
const CONSTRUCTION: SpecField = {
  key: 'construction',
  label: 'Construction',
  short: 'Construction',
  options: [
    {value: 'Solid Gold', caption: 'Full gold value'},
    {value: 'Semi-Solid'},
    {value: 'Hollow', caption: 'Lightweight'},
  ],
};

/* Engagement center stones — same vocabulary, no "No stones" escape. */
const ENGAGEMENT_STONES: SpecField = {
  key: 'stones',
  label: 'Choose the center stone',
  short: 'Stone',
  options: STONE_OPTIONS,
};

const style = (label: string, options: SpecOption[]): SpecField => ({
  key: 'style',
  label,
  short: 'Style',
  options: [...options, {value: 'Other'}],
});

/** A follow-up step that only shows for one pendant style. */
const styleAsk = (
  styleValue: string,
  key: SpecField['key'],
  label: string,
  short: string,
  values: string[],
): SpecField => ({
  key,
  label,
  short,
  options: values.map((value) => ({value})),
  when: {key: 'style', value: styleValue},
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

    // ── Engagement branch ──
    {
      ...style('Pick the cut / setting', [
        {value: 'Round', imageHandle: 'round-engagement-rings'},
        {value: 'Oval', imageHandle: 'oval-engagement-rings'},
        {value: 'Cushion', imageHandle: 'cushion-engagement-rings'},
        {value: 'Princess', imageHandle: 'princess-engagement-rings'},
        {value: 'Emerald', imageHandle: 'emerald-engagement-rings'},
        {value: 'Radiant', imageHandle: 'radiant-engagement-rings'},
        {value: 'Pear', imageHandle: 'pear-engagement-rings'},
        {value: 'Marquise', imageHandle: 'marquis-engagement-rings'},
        {value: 'Halo', imageHandle: 'halo-engagement-rings'},
      ]),
      when: {key: 'kind', value: 'Engagement'},
    },
    {
      key: 'design',
      label: 'Band style',
      short: 'Band',
      options: [
        {value: 'Solitaire Band'},
        {value: 'Pavé Band'},
        {value: 'Hidden Halo'},
        {value: 'Three-Stone'},
        {value: 'Vintage / Filigree'},
        {value: 'Twisted / Rope Band'},
        {value: 'Custom Band Design'},
      ],
      when: {key: 'kind', value: 'Engagement'},
    },
    {...ENGAGEMENT_STONES, when: {key: 'kind', value: 'Engagement'}},
    {
      key: 'carat',
      label: 'Center stone carat',
      short: 'Carat',
      options: [
        {value: '0.50 ct'},
        {value: '0.75 ct'},
        {value: '1.00 ct', caption: 'Most popular'},
        {value: '1.50 ct'},
        {value: '2.00 ct'},
        {value: '3.00 ct'},
        {value: '3.00 ct+'},
        {value: 'Not sure'},
      ],
      when: {key: 'kind', value: 'Engagement'},
    },
    // Only a diamond center raises the natural-vs-lab question.
    {
      key: 'stonetype',
      label: 'Natural or lab-grown?',
      short: 'Origin',
      options: [
        {value: 'Natural Diamond'},
        {value: 'Lab-Grown Diamond', caption: 'Same stone, better price'},
        {value: 'Not sure'},
      ],
      when: {key: 'stones', value: 'Diamond'},
    },

    // ── Casual branch ──
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
    styleAsk('Wedding Band', 'design', 'Band style', 'Design', [
      'Classic Band', 'Diamond Band', 'Two-Tone Band', 'Matte Band',
      'Custom Band',
    ]),
    styleAsk('Signet', 'design', 'Signet face', 'Design', [
      'Round Face', 'Square Face', 'Oval Face', 'Initial Engraved',
      'Custom Signet',
    ]),
    styleAsk('Cocktail', 'design', 'Cocktail style', 'Design', [
      'Large Center Stone', 'Multi-Stone Cluster', 'Colored Stone',
      'Custom Cocktail',
    ]),
    styleAsk('Eternity', 'design', 'Eternity style', 'Design', [
      'Full Eternity', 'Half Eternity', 'Baguette Eternity', 'Custom Eternity',
    ]),
    styleAsk('Stackable', 'design', 'Stack style', 'Design', [
      'Plain Band', 'Diamond Band', 'Mixed Metals Set', 'Custom Stack',
    ]),
    styleAsk('Heart', 'design', 'Heart style', 'Design', [
      'Solid Heart', 'Diamond Heart', 'Open Heart', 'Custom Heart',
    ]),
    styleAsk('Nugget', 'design', 'Nugget style', 'Design', [
      'Classic Nugget', 'Diamond Nugget', 'Custom Nugget',
    ]),
    styleAsk('Cuban Link', 'design', 'Cuban ring style', 'Design', [
      'Classic Cuban Ring', 'Diamond Cuban Ring', 'Custom Cuban Ring',
    ]),
    {...STONES, when: {key: 'kind', value: 'Casual'}},

    // ── Shared ──
    METAL,
    KARAT,
    RING_SIZE,
    {
      key: 'engraving',
      label: 'Engraving',
      short: 'Engraving',
      options: [
        {value: 'No Engraving'},
        {value: 'Initials'},
        {value: 'Name'},
        {value: 'Date'},
        {value: 'Custom Message'},
      ],
    },
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

    // Per-link-style follow-up.
    styleAsk('Cuban Link', 'design', 'Cuban style', 'Design', [
      'Classic Cuban Link', 'Miami Cuban', 'Diamond Cut Cuban', 'Hollow Cuban',
      'Solid Cuban', 'Custom Cuban Design',
    ]),
    styleAsk('Miami Cuban', 'design', 'Link structure', 'Design', [
      'Standard Miami Cuban', 'Heavyweight Cuban', 'Iced Cuban',
      'Diamond-Cut Cuban', 'Custom Link Design',
    ]),
    styleAsk('Rope', 'design', 'Rope style', 'Design', [
      'Classic Rope', 'Diamond Cut Rope', 'Twisted Rope', 'Heavy Rope',
      'Custom Rope',
    ]),
    styleAsk('Figaro', 'design', 'Figaro pattern', 'Design', [
      'Classic Figaro', 'Diamond Cut Figaro', 'Heavy Figaro', 'Custom Pattern',
    ]),
    styleAsk('Franco', 'design', 'Franco style', 'Design', [
      'Classic Franco', 'Diamond Franco', 'Heavy Franco', 'Custom Franco',
    ]),
    styleAsk('Curb', 'design', 'Curb style', 'Design', [
      'Classic Curb', 'Diamond Cut Curb', 'Heavy Curb', 'Custom Curb',
    ]),
    styleAsk('Box', 'design', 'Box style', 'Design', [
      'Classic Box', 'Diamond Box', 'Heavy Box', 'Custom Box',
    ]),
    styleAsk('Tennis', 'design', 'Tennis style', 'Design', [
      'Classic Diamond Tennis', 'Full Iced Tennis', 'Colored Stone Tennis',
      'Custom Tennis Design',
    ]),
    styleAsk('Ice', 'design', 'Iced style', 'Design', [
      'Full Iced', 'Partial Iced', 'Diamond Link', 'Custom Iced Design',
    ]),

    METAL,
    KARAT,
    CONSTRUCTION,
    {
      key: 'width',
      label: 'Chain width',
      short: 'Width',
      options: [
        {value: '2mm', caption: 'Everyday'},
        {value: '3mm', caption: 'Everyday'},
        {value: '4mm', caption: 'Everyday'},
        {value: '5mm', caption: 'Everyday'},
        {value: '6mm', caption: 'Bold'},
        {value: '8mm', caption: 'Bold'},
        {value: '10mm', caption: 'Bold'},
        {value: '12mm', caption: 'Bold'},
        {value: 'Custom Width'},
      ],
    },
    CHAIN_LENGTH,
    {
      key: 'stones',
      label: 'Diamond setting',
      short: 'Setting',
      options: [
        {value: 'No Diamonds'},
        {value: 'Diamond Cut Finish', caption: 'Sparkle cut, no stones'},
        {value: 'Diamond Accents'},
        {value: 'Partial Pavé'},
        {value: 'Full Pavé / Iced'},
      ],
    },
    // Only when actual stones were chosen.
    {
      key: 'stonetype',
      label: 'Choose the stone',
      short: 'Stone',
      options: STONE_OPTIONS,
      when: {
        key: 'stones',
        value: ['Diamond Accents', 'Partial Pavé', 'Full Pavé / Iced'],
      },
    },
    {
      key: 'coverage',
      label: 'Stone coverage',
      short: 'Coverage',
      options: [
        {value: 'Front Only'},
        {value: 'Half Chain'},
        {value: 'Full Chain'},
      ],
      when: {
        key: 'stones',
        value: ['Diamond Accents', 'Partial Pavé', 'Full Pavé / Iced'],
      },
    },
    {
      key: 'clasp',
      label: 'Clasp',
      short: 'Clasp',
      options: [
        {value: 'Lobster Clasp'},
        {value: 'Box Clasp'},
        {value: 'Hidden Box Lock'},
        {value: 'Safety Lock'},
        {value: 'Custom Clasp'},
      ],
    },
    {
      key: 'pendant',
      label: 'Will you wear a pendant?',
      short: 'Pendant',
      options: [
        {value: 'No Pendant'},
        {value: 'Small Pendant'},
        {value: 'Medium Pendant'},
        {value: 'Heavy Pendant', caption: 'We match the chain strength'},
      ],
    },
    {
      key: 'engraving',
      label: 'Engraving',
      short: 'Engraving',
      options: [
        {value: 'No Engraving'},
        {value: 'Initials'},
        {value: 'Name'},
        {value: 'Date'},
        {value: 'Custom Message'},
      ],
    },
    BUDGET,
  ],
  Bracelet: [
    style('Pick the bracelet type', [
      {value: 'Cuban Link', imageHandle: 'cuban-bracelets'},
      {value: 'Chain Bracelet', imageHandle: 'classic-link-bracelets'},
      {value: 'Tennis', imageHandle: 'tennis-bracelets'},
      {value: 'Bangle', imageHandle: 'womens-bracelets'},
      {value: 'Charm Bracelet', imageHandle: 'baby-bracelets'},
      {value: 'ID Bracelet', imageHandle: 'flat-link-bracelets'},
    ]),

    // Per-type follow-up.
    styleAsk('Cuban Link', 'design', 'Cuban style', 'Design', [
      'Classic Cuban Bracelet', 'Miami Cuban Bracelet', 'Diamond Cut Cuban',
      'Heavyweight Cuban', 'Iced Cuban', 'Custom Cuban Design',
    ]),
    styleAsk('Chain Bracelet', 'design', 'Link style', 'Design', [
      'Curb Bracelet', 'Rope Bracelet', 'Franco Bracelet', 'Figaro Bracelet',
      'Box Bracelet', 'Byzantine Bracelet', 'Custom Link Bracelet',
    ]),
    styleAsk('Tennis', 'design', 'Tennis style', 'Design', [
      'Classic Diamond Tennis', 'Full Diamond Tennis', 'Colored Stone Tennis',
      'Flexible Tennis', 'Custom Tennis Design',
    ]),
    styleAsk('Bangle', 'design', 'Bangle style', 'Design', [
      'Classic Gold Bangle', 'Diamond Bangle', 'Open Bangle',
      'Engraved Bangle', 'Custom Bangle',
    ]),
    styleAsk('Charm Bracelet', 'design', 'Charm style', 'Design', [
      'Classic Charm Bracelet', 'Initial Charm Bracelet',
      'Religious Charm Bracelet', 'Custom Charm Bracelet',
    ]),
    styleAsk('ID Bracelet', 'design', 'ID style', 'Design', [
      'Classic ID Bracelet', 'Diamond ID Bracelet', 'Engraved ID Bracelet',
      'Custom ID Bracelet',
    ]),

    METAL,
    KARAT,
    CONSTRUCTION,
    {
      key: 'width',
      label: 'Bracelet width',
      short: 'Width',
      options: [
        {value: '3mm', caption: 'Daily wear'},
        {value: '4mm', caption: 'Daily wear'},
        {value: '5mm', caption: 'Daily wear'},
        {value: '6mm', caption: 'Daily wear'},
        {value: '7mm', caption: 'Bold'},
        {value: '8mm', caption: 'Bold'},
        {value: '10mm', caption: 'Bold'},
        {value: '12mm', caption: 'Bold'},
        {value: 'Custom Width'},
      ],
    },
    BRACELET_LENGTH,
    {
      key: 'stones',
      label: 'Stone setting',
      short: 'Setting',
      options: [
        {value: 'No Stones'},
        {value: 'Diamond Cut Finish', caption: 'Sparkle cut, no stones'},
        {value: 'Diamond Accents'},
        {value: 'Partial Pavé'},
        {value: 'Full Pavé / Iced'},
      ],
    },
    // Only when actual stones were chosen.
    {
      key: 'stonetype',
      label: 'Choose the stone',
      short: 'Stone',
      options: STONE_OPTIONS,
      when: {
        key: 'stones',
        value: ['Diamond Accents', 'Partial Pavé', 'Full Pavé / Iced'],
      },
    },
    {
      key: 'coverage',
      label: 'Stone coverage',
      short: 'Coverage',
      options: [
        {value: 'Front Only'},
        {value: 'Half Bracelet'},
        {value: 'Full Bracelet'},
      ],
      when: {
        key: 'stones',
        value: ['Diamond Accents', 'Partial Pavé', 'Full Pavé / Iced'],
      },
    },
    // Cuban bracelets get their own lock family; everyone else the standard.
    {
      key: 'clasp',
      label: 'Lock type',
      short: 'Lock',
      options: [
        {value: 'Standard Lock'},
        {value: 'Diamond Lock'},
        {value: 'Custom Logo Lock'},
        {value: 'Hidden Box Lock'},
        {value: 'Double Safety Lock'},
      ],
      when: {key: 'style', value: 'Cuban Link'},
    },
    {
      key: 'clasp',
      label: 'Clasp type',
      short: 'Clasp',
      options: [
        {value: 'Lobster Clasp'},
        {value: 'Box Lock'},
        {value: 'Hidden Box Lock'},
        {value: 'Double Safety Lock'},
        {value: 'Custom Lock'},
      ],
      when: {
        key: 'style',
        value: ['Chain Bracelet', 'Tennis', 'Bangle', 'Charm Bracelet', 'ID Bracelet', 'Other'],
      },
    },
    // Link details, for the link bracelets only.
    {
      key: 'shape',
      label: 'Link style',
      short: 'Links',
      options: [
        {value: 'Flat Links'},
        {value: 'Rounded Links'},
        {value: 'Puffed Links'},
        {value: 'Hollow Links'},
        {value: 'Custom Links'},
      ],
      when: {key: 'style', value: ['Cuban Link', 'Chain Bracelet']},
    },
    {
      key: 'weight',
      label: 'Link thickness',
      short: 'Thickness',
      options: [
        {value: 'Standard'},
        {value: 'Medium'},
        {value: 'Heavy'},
        {value: 'Extra Heavy'},
      ],
      when: {key: 'style', value: ['Cuban Link', 'Chain Bracelet']},
    },
    {
      key: 'engraving',
      label: 'Engraving',
      short: 'Engraving',
      options: [
        {value: 'No Engraving'},
        {value: 'Initials'},
        {value: 'Name'},
        {value: 'Date'},
        {value: 'Custom Message'},
      ],
    },
    {
      key: 'extra',
      label: 'Custom elements',
      short: 'Extras',
      options: [
        {value: 'None'},
        {value: 'Logo'},
        {value: 'Symbol'},
        {value: 'Religious Design'},
        {value: 'Custom Pattern'},
      ],
    },
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

    // ── Studs ──
    styleAsk('Studs', 'design', 'Stud style', 'Design', [
      'Classic Round Stud', 'Square Stud', 'Heart Stud', 'Initial Stud',
      'Religious Stud', 'Cluster Stud', 'Custom Shape',
    ]),
    styleAsk('Studs', 'size', 'Stud size', 'Size', [
      'Small (daily wear)', 'Medium', 'Large', 'Statement Size', 'Custom Size',
    ]),
    styleAsk('Studs', 'finish', 'Finish', 'Finish', [
      'Plain Gold', 'Textured / Nugget Finish', 'Diamond Accent', 'Full Pavé',
    ]),

    // ── Diamond Studs ──
    styleAsk('Diamond Studs', 'design', 'Diamond shape', 'Shape', [
      'Round', 'Princess', 'Oval', 'Cushion', 'Emerald', 'Pear',
      'Custom Shape',
    ]),
    styleAsk('Diamond Studs', 'finish', 'Diamond setting', 'Setting', [
      'Solitaire', 'Halo', 'Hidden Halo', 'Cluster', 'Pavé', 'Bezel',
    ]),
    styleAsk('Diamond Studs', 'carat', 'Diamond size', 'Carat', [
      'Small', 'Medium', 'Large', 'Custom Carat',
    ]),
    styleAsk('Diamond Studs', 'stonetype', 'Diamond quality', 'Quality', [
      'Natural Diamond', 'Lab Diamond', 'Moissanite',
    ]),

    // ── Hoops ──
    styleAsk('Hoops', 'design', 'Hoop style', 'Design', [
      'Classic Hoop', 'Thick Hoop', 'Cuban Hoop', 'Twisted Hoop',
      'Diamond Hoop', 'Heart Hoop', 'Custom Hoop',
    ]),
    styleAsk('Hoops', 'width', 'Hoop diameter', 'Diameter', [
      '10mm', '15mm', '20mm', '25mm', '30mm+', 'Custom Size',
    ]),
    styleAsk('Hoops', 'weight', 'Hoop thickness', 'Thickness', [
      'Thin', 'Medium', 'Thick', 'Heavyweight',
    ]),
    styleAsk('Hoops', 'finish', 'Hoop finish', 'Finish', [
      'Smooth Polish', 'Diamond Cut', 'Textured', 'Pavé Diamond',
    ]),

    // ── Nugget ──
    styleAsk('Nugget', 'design', 'Nugget style', 'Design', [
      'Classic Nugget', 'Heavy Nugget', 'Textured Nugget', 'Diamond Nugget',
      'Custom Nugget Design',
    ]),
    styleAsk('Nugget', 'finish', 'Texture', 'Texture', [
      'Natural Nugget Texture', 'Smooth Nugget', 'Hammered Finish',
      'Custom Texture',
    ]),
    styleAsk('Nugget', 'size', 'Size', 'Size', [
      'Small', 'Medium', 'Large', 'Oversized Statement',
    ]),

    // ── Huggies ──
    styleAsk('Huggies', 'design', 'Huggie style', 'Design', [
      'Plain Gold Huggie', 'Diamond Huggie', 'Cuban Huggie', 'Twisted Huggie',
      'Custom Huggie',
    ]),
    styleAsk('Huggies', 'weight', 'Thickness', 'Thickness', [
      'Slim', 'Medium', 'Thick', 'Heavy',
    ]),
    styleAsk('Huggies', 'finish', 'Stone setting', 'Setting', [
      'No Stones', 'Diamond Accent', 'Full Pavé', 'Colored Stones',
    ]),

    // ── Drops / Dangle ──
    styleAsk('Drops / Dangle', 'design', 'Drop style', 'Design', [
      'Classic Drop', 'Diamond Drop', 'Chain Drop', 'Cross Drop',
      'Religious Drop', 'Custom Design',
    ]),
    styleAsk('Drops / Dangle', 'length', 'Drop length', 'Length', [
      'Short', 'Medium', 'Long', 'Custom Length',
    ]),
    styleAsk('Drops / Dangle', 'shape', 'Movement', 'Movement', [
      'Fixed Drop', 'Hanging Drop', 'Layered Drop',
    ]),

    // ── Shared for every earring ──
    METAL,
    KARAT,
    {
      key: 'clasp',
      label: 'Earring back',
      short: 'Back',
      options: [
        {value: 'Push Back'},
        {value: 'Screw Back', caption: 'Most secure'},
        {value: 'Butterfly Back'},
        {value: 'Hinged Closure'},
        {value: 'Latch Back'},
        {value: 'Custom Lock'},
      ],
    },
    STONES,
    {
      key: 'engraving',
      label: 'Personalization',
      short: 'Extras',
      options: [
        {value: 'None'},
        {value: 'Initial'},
        {value: 'Name'},
        {value: 'Logo'},
        {value: 'Symbol'},
        {value: 'Date'},
        {value: 'Custom Engraving'},
      ],
    },
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

    // ── Cross ──
    styleAsk('Cross', 'design', 'Cross style', 'Design', [
      'Classic Cross', 'Diamond Cross', 'Jesus / Crucifix', 'Iced Cross',
      'Gothic Cross', 'Orthodox Cross', 'Custom Cross Design',
    ]),
    styleAsk('Cross', 'stones', 'Stone setting', 'Stones', [
      'No stones', 'Diamond Accents', 'Full Diamond Pavé', 'Colored Stones',
    ]),
    styleAsk('Cross', 'extra', 'Personalization', 'Extras', [
      'None', 'Engraved Name', 'Engraved Date', 'Bible Verse', 'Custom Message',
    ]),

    // ── Religious ──
    styleAsk('Religious', 'design', 'Religious design', 'Design', [
      'Allah', 'Jesus', 'Virgin Mary', 'Saint Jude', 'Saint Michael',
      'Angel', 'Hamsa Hand', 'Custom Symbol',
    ]),
    styleAsk('Religious', 'finish', 'Design style & finish', 'Finish', [
      'Classic High Polish', 'Detailed 3D', 'Diamond Encrusted', 'Minimal',
      'Vintage', 'Matte Gold', 'Black Gold Accent',
    ]),
    styleAsk('Religious', 'stones', 'Stone setting', 'Stones', [
      'Plain Gold', 'Diamond Border', 'Full Pavé', 'Colored Stones',
    ]),

    // ── Initial / Letter ──
    styleAsk('Initial / Letter', 'design', 'Letter type', 'Letters', [
      'Single Initial', 'Multiple Letters', 'Full Name', 'Monogram',
    ]),
    styleAsk('Initial / Letter', 'font', 'Font style', 'Font', [
      'Classic', 'Gothic', 'Script', 'Block', 'Custom Font',
    ]),
    styleAsk('Initial / Letter', 'finish', 'Letter finish', 'Finish', [
      'Plain Gold', 'Diamond Outline', 'Full Diamond', 'Two Tone',
    ]),
    styleAsk('Initial / Letter', 'extra', 'Add-ons', 'Extras', [
      'None', 'Crown', 'Halo', 'Heart', 'Wings', 'Custom Symbol',
    ]),

    // ── Picture / Photo ──
    styleAsk('Picture / Photo', 'design', 'Photo style', 'Photo', [
      'Portrait', 'Family Photo', 'Memorial', 'Couple Photo', 'Pet Photo',
    ]),
    styleAsk('Picture / Photo', 'shape', 'Pendant shape', 'Shape', [
      'Round', 'Rectangle', 'Oval', 'Heart', 'Custom Shape',
    ]),
    styleAsk('Picture / Photo', 'finish', 'Photo treatment', 'Finish', [
      'Engraved', 'Printed Insert', 'Diamond Border', '3D Relief',
    ]),
    styleAsk('Picture / Photo', 'extra', 'Back design', 'Back', [
      'Plain Gold', 'Engraved Message', 'Engraved Date',
    ]),

    // ── Nameplate ──
    styleAsk('Nameplate', 'design', 'Name style', 'Name', [
      'Single Name', 'Two Names', 'Couple Names', 'Custom Word',
    ]),
    styleAsk('Nameplate', 'font', 'Font', 'Font', [
      'Script', 'Bubble', 'Gothic', 'Classic', 'Custom Font',
    ]),
    styleAsk('Nameplate', 'shape', 'Layout', 'Layout', [
      'Horizontal', 'Vertical', 'Curved', 'Stacked',
    ]),
    styleAsk('Nameplate', 'extra', 'Decoration', 'Extras', [
      'None', 'Crown', 'Heart', 'Diamond Border', 'Wings',
    ]),

    // ── Medallion ──
    styleAsk('Medallion', 'design', 'Medallion style', 'Design', [
      'Custom Face', 'Symbol', 'Family Logo', 'Zodiac', 'Cultural Design',
      'Custom Artwork',
    ]),
    styleAsk('Medallion', 'shape', 'Shape', 'Shape', [
      'Round', 'Oval', 'Shield', 'Coin Style', 'Custom Shape',
    ]),
    styleAsk('Medallion', 'finish', 'Detail & finish', 'Finish', [
      'Simple Polished', 'Detailed', 'Highly Detailed 3D', 'Antique Gold',
      'Two Tone', 'Diamond Accent',
    ]),

    // ── Angel ──
    styleAsk('Angel', 'design', 'Angel style', 'Design', [
      'Angel Wings', 'Guardian Angel', 'Angel Face', 'Baby Angel',
      'Custom Angel',
    ]),
    styleAsk('Angel', 'shape', 'Wing style', 'Wings', [
      'Open Wings', 'Folded Wings', 'Diamond Wings', 'Detailed Feather Wings',
    ]),
    styleAsk('Angel', 'stones', 'Stone setting', 'Stones', [
      'Plain Gold', 'Diamond Accent', 'Full Pavé',
    ]),

    // ── Shared for every pendant ──
    METAL,
    KARAT,
    {
      key: 'size',
      label: 'Pendant size',
      short: 'Size',
      options: [
        {value: 'Small', caption: 'Daily wear'},
        {value: 'Medium'},
        {value: 'Large', caption: 'Statement piece'},
        {value: 'Custom Dimensions'},
      ],
    },
    {
      key: 'chain',
      label: 'Include a chain?',
      short: 'Chain',
      options: [
        {value: 'Pendant only', caption: 'No chain'},
        {value: 'Cuban Chain', imageHandle: 'cuban-chains'},
        {value: 'Rope Chain', imageHandle: 'rope-chains'},
        {value: 'Franco Chain', imageHandle: 'franco-chains'},
        {value: 'Box Chain', imageHandle: 'cut-box-chains'},
        {value: 'Tennis Chain', imageHandle: 'tennis-chains'},
      ],
    },
    BUDGET,
  ],
};

/** The fields that apply given the answers so far (branching via `when`). */
export function activeFields(
  productType: string,
  get: (key: SpecField['key']) => string,
): SpecField[] {
  return (CATEGORY_SPECS[productType] ?? []).filter(
    (field) => !field.when || whenMatches(field.when, get(field.when.key)),
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
