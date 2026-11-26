/**
 * Karat / Carat / Style collection filters, worked out by the storefront.
 *
 * Shopify only filters on what its Search & Discovery app is configured for
 * (Availability, Price, Metal here) and silently ignores anything else passed
 * to `products(filters:)`. These three are derived instead, from data every
 * product already has, and applied in the collection loader:
 *
 *   Karat  every karat the product is sold in — the `metal` / `gold purity`
 *          option values (both exist, plus a " metal" with a stray space),
 *          else the title. Shopify's Metal filter only sees `metal`.
 *   Carat  diamond-weight band from the title ("0.24CT", "2.39 CT"). Bands,
 *          not weights: 0.24 / 0.245 / 0.25 as separate boxes is useless.
 *   Style  the merchant's own style collections the product is in
 *          (STYLE_COLLECTIONS) — their taxonomy, not guesses from titles.
 *   Length chain / bracelet length band from the title ("24-Inch", "22 Inches",
 *          "18in"), and
 *   Width  its link width band ("5mm", "3.8MM"). Every sized chain and
 *          bracelet states both in its title; diamond pieces that don't get
 *          neither, so they drop out under these two rather than guess.
 *
 * In the URL they ride the same `filter` param as Shopify's facets, as
 * {"karat":"14K"}, so the sidebar's links, chips and "Clear all" and the
 * robots rules treat both kinds alike. getFiltersFromParam keeps them away
 * from Shopify.
 *
 * Plain TS with no app imports, so `node app/lib/facets.test.ts` runs it.
 */

export type FacetKey =
  | 'metal'
  | 'karat'
  | 'carat'
  | 'length'
  | 'width'
  | 'style';

/** Sidebar order and labels. */
export const FACETS: {key: FacetKey; label: string}[] = [
  {key: 'metal', label: 'Metal'},
  {key: 'karat', label: 'Karat'},
  {key: 'carat', label: 'Carat'},
  {key: 'length', label: 'Length'},
  {key: 'width', label: 'Width'},
  {key: 'style', label: 'Style'},
];

/**
 * Style collection → Style value. Shared labels on purpose: Cuban chains,
 * Cuban bracelets and Cuban link rings are all "Cuban", so a value means the
 * same on every collection it appears on. Gender and material collections
 * ("Women's Necklaces", "Men's Diamond Rings") are not styles and are left
 * out; engagement-ring shapes are in, since on those pages the shape IS the
 * style a shopper picks by.
 */
export const STYLE_COLLECTIONS: Record<string, string> = {
  // Chains & bracelets
  'rope-chains': 'Rope',
  'rope-bracelets': 'Rope',
  'classic-link-chains': 'Classic Link',
  'classic-link-bracelets': 'Classic Link',
  'squared-link-chains': 'Flat Link',
  'flat-link-bracelets': 'Flat Link',
  'cuban-chains': 'Cuban',
  'miami-cuban-links': 'Cuban',
  'diamond-cuban-link-chains': 'Cuban',
  'cuban-bracelets': 'Cuban',
  'cuban-link-rings': 'Cuban',
  'chino-link-chains': 'Chino Link',
  'ice-chains': 'Ice',
  'franco-chains': 'Franco',
  'franco-bracelets': 'Franco',
  'alexander-chain': 'Alexander',
  'cut-box-chains': 'Box',
  'figaro-chains': 'Figaro',
  'hollow-figaro-chains': 'Figaro',
  'tennis-chains': 'Tennis',
  'tennis-bracelets': 'Tennis',
  'curb-chains': 'Curb',
  'rollo-link-chains': 'Rollo',
  'flat-mariner-chains': 'Mariner',
  'paperclip-chain': 'Paperclip',
  'decorative-link-chains': 'Oriental',
  'french-link-chains': 'French Link',
  // Earrings
  'stud-earrings': 'Stud',
  'diamond-stud-earrings': 'Stud',
  'hoop-earrings': 'Hoop',
  'nugget-earrings': 'Nugget',
  // Pendants
  'picture-pendants': 'Picture',
  'cross-pendants': 'Cross',
  'last-supper-pendants': 'Last Supper',
  'jesus-pendants': 'Jesus',
  'virgin-mary-pendant': 'Virgin Mary',
  'saint-jude-pendant': 'Saint Jude',
  'angel-pendants': 'Angel',
  'angel-pendant': 'Angel',
  'santa-muerte-pendant': 'Santa Muerte',
  'buddha-pendant': 'Buddha',
  'initial-pendant': 'Initial',
  'diamond-initials': 'Initial',
  'egyptian-pendant': 'Egyptian',
  'world-is-yours-pendants': 'World Is Yours',
  'saint-benedict-pendants': 'Saint Benedict',
  'lady-fortuna-pendant': 'Lady Fortuna',
  'aztec-calendar-pendant': 'Aztec Calendar',
  medallions: 'Medallion',
  'hamsa-pendants': 'Hamsa',
  'lion-pendants': 'Lion',
  // Rings
  'nugget-rings': 'Nugget',
  'last-supper-rings': 'Last Supper',
  'money-rings': 'Money',
  'centenario-rings': 'Centenario',
  'saint-jude-rings': 'Saint Jude',
  'quinceanera-rings': 'Quinceañera',
  'cross-rings': 'Cross',
  'world-is-yours-rings': 'World Is Yours',
  'aztec-calendar-rings': 'Aztec Calendar',
  'heart-rings': 'Heart',
  'two-finger-rings': 'Two Finger',
  'mens-signet-rings': 'Signet',
  'solitaire-rings': 'Solitaire',
  'eternity-rings': 'Eternity',
  'cocktail-rings': 'Cocktail',
  'multi-stone-rings': 'Multi-Stone',
  'wedding-band-rings': 'Wedding Band',
  'stackable-rings': 'Stackable',
  'southwestern-inspired-rings': 'Southwestern',
  'halo-engagement-rings': 'Halo',
  'round-engagement-rings': 'Round',
  'oval-engagement-rings': 'Oval',
  'princess-engagement-rings': 'Princess',
  'emerald-engagement-rings': 'Emerald Cut',
  'cushion-engagement-rings': 'Cushion',
  'pear-engagement-rings': 'Pear',
  'marquis-engagement-rings': 'Marquise',
};

/** What the index query fetches per product. */
export type FacetSource = {
  id: string;
  handle: string;
  title: string;
  groupName?: {value?: string | null} | null;
  options: {name: string; optionValues: {name: string}[]}[];
  collections?: {nodes: {handle: string}[]} | null;
};

/** A product reduced to what filtering needs. */
export type IndexedProduct = {
  id: string;
  groupName?: {value?: string | null} | null;
  /** Option values by lower-cased option name, spaces kept (" metal" is not
   *  "metal" to Shopify's filter) — for counting Shopify's own option facets
   *  (Metal) per card; see groupedFacetCounts. */
  options: Record<string, string[]>;
} & Record<FacetKey, string[]>;

const KARAT = /\b(10|14|18|22|24)\s?k(?:t|arat)?\b/gi;
const KARAT_OPTION = /^(metal|gold purity|material)$/i;
const METAL =
  /\b(tri[ -]?color gold|two[ -]?tone gold|yellow gold|white gold|rose gold|platinum|sterling silver)\b/gi;

const METAL_LABELS: Record<string, string> = {
  'yellow gold': 'Yellow Gold',
  'white gold': 'White Gold',
  'rose gold': 'Rose Gold',
  'tri-color gold': 'Tri-Color Gold',
  'tri color gold': 'Tri-Color Gold',
  'two-tone gold': 'Two-Tone Gold',
  'two tone gold': 'Two-Tone Gold',
  platinum: 'Platinum',
  'sterling silver': 'Sterling Silver',
};

/** Every material/color offered, without repeating its karat in the label. */
export function metalsOf(product: Pick<FacetSource, 'title' | 'options'>) {
  const metals = (text: string) =>
    [...text.matchAll(METAL)].map(
      (match) => METAL_LABELS[match[1].toLowerCase()],
    );
  const fromOptions = product.options
    .filter((option) => KARAT_OPTION.test(option.name.trim()))
    .flatMap((option) => option.optionValues.map((value) => value.name));
  let found = metals(fromOptions.join(' '));
  if (!found.length) found = metals(product.title);
  const confirmedGold =
    /\bgold\b/i.test(product.title) || karatsOf(product).length > 0;
  if (!found.length && confirmedGold) {
    if (/\bsemi[ -]?solid\b/i.test(product.title)) {
      found = ['Semi-Solid Gold'];
    } else if (/\bhollow\b/i.test(product.title)) {
      found = ['Hollow Gold'];
    } else if (/\bsolid\b/i.test(product.title)) {
      found = ['Solid Gold'];
    }
  }
  // Some products confirm a gold karat but provide no color or construction.
  // Keep them available under a generic value rather than omitting them from
  // Metal while Karat continues to count them.
  if (!found.length && confirmedGold) found = ['Gold'];
  return [...new Set(found)].sort();
}

/** Every karat the product is sold in, e.g. ["10K", "14K"]. */
export function karatsOf(product: Pick<FacetSource, 'title' | 'options'>) {
  const karats = (text: string) =>
    [...text.matchAll(KARAT)].map((match) => `${match[1]}K`);
  const fromOptions = product.options
    .filter((option) => KARAT_OPTION.test(option.name.trim()))
    .flatMap((option) => option.optionValues.map((value) => value.name));
  // The options are what can actually be bought; a title names one of them.
  let found = karats(fromOptions.join(' '));
  if (!found.length) found = karats(product.title);
  return [...new Set(found)].sort();
}

// "0.24CT", "2.39 CT", ".040CT", "3CT". One number per title.
const CARAT = /(\d*\.\d+|\d+)\s?ct\b/i;
// Above this a parse is a typo ("074Ct" for 0.74), not a jewel — the largest
// real weight in the catalogue is a 10.79 ct picture pendant.
const MAX_CARAT = 25;

type Bands = [below: number, label: string][];

export const CARAT_BANDS: Bands = [
  [0.5, 'Under 0.50 ct'],
  [1, '0.50–0.99 ct'],
  [2, '1.00–1.99 ct'],
  [3, '2.00–2.99 ct'],
  [Infinity, '3.00 ct & up'],
];

/** The band `value` falls in, or null when it isn't a believable reading. */
function bandOf(value: number, bands: Bands, max: number, min = 0) {
  if (!(value > min && value <= max)) return null;
  return bands.find(([below]) => value < below)![1];
}

/** The diamond-weight band the title names, or null. */
export function caratBandOf(product: Pick<FacetSource, 'title'>) {
  const match = CARAT.exec(product.title);
  return bandOf(match ? Number(match[1]) : NaN, CARAT_BANDS, MAX_CARAT);
}

// Only titles naming the piece itself — a "32.51MM Star Pendant" is a pendant
// size, not a link width, and pendants are not shopped by it.
const SIZED_PIECE = /\b(chains?|bracelets?|necklaces?|anklets?|bangles?)\b/i;
// "24 Inch", "24-Inch", "22 Inches", "18in", "9.5-Inch". The catalogue also has
// "20 Inchhain" (a typo), so no word boundary after "inch".
const LENGTH = /(\d+(?:\.\d+)?)(?:\s*-?\s*inch|in\b)/i;
// "5mm", "3.8MM", "10.5mm". Real range: 1 mm box chain to 36 mm classic link.
const WIDTH = /(\d*\.\d+|\d+)\s?mm\b/i;

// Upper bounds exclusive; every label covers exactly what falls in it. The
// first three are wrist sizes (7–9.5 in), the rest neck sizes (14–40 in), so
// one list serves chains, bracelets and pages that mix both.
export const LENGTH_BANDS: Bands = [
  [8, 'Under 8 in'],
  [9, '8–8.5 in'],
  [10, '9–9.5 in'],
  [17, '10–16 in'],
  [21, '17–20 in'],
  [25, '21–24 in'],
  [29, '25–28 in'],
  [Infinity, '29 in & up'],
];

export const WIDTH_BANDS: Bands = [
  [3, 'Under 3 mm'],
  [5, '3–4.9 mm'],
  [7, '5–6.9 mm'],
  [10, '7–9.9 mm'],
  [15, '10–14.9 mm'],
  [Infinity, '15 mm & up'],
];

/** Chain / bracelet length band the title names, or null. */
export function lengthBandOf(product: Pick<FacetSource, 'title'>) {
  if (!SIZED_PIECE.test(product.title)) return null;
  const match = LENGTH.exec(product.title);
  return bandOf(match ? Number(match[1]) : NaN, LENGTH_BANDS, 60, 4);
}

/** Chain / bracelet link-width band the title names, or null. */
export function widthBandOf(product: Pick<FacetSource, 'title'>) {
  if (!SIZED_PIECE.test(product.title)) return null;
  const match = WIDTH.exec(product.title);
  return bandOf(match ? Number(match[1]) : NaN, WIDTH_BANDS, 40);
}

export function indexProduct(product: FacetSource): IndexedProduct {
  const carat = caratBandOf(product);
  const length = lengthBandOf(product);
  const width = widthBandOf(product);
  const styles = (product.collections?.nodes ?? [])
    .map((collection) => STYLE_COLLECTIONS[collection.handle])
    .filter(Boolean);
  const options: Record<string, string[]> = {};
  for (const option of product.options) {
    const name = option.name.toLowerCase();
    options[name] = [
      ...(options[name] ?? []),
      ...option.optionValues.map((value) => value.name),
    ];
  }
  return {
    id: product.id,
    groupName: product.groupName,
    options,
    metal: metalsOf(product),
    karat: karatsOf(product),
    carat: carat ? [carat] : [],
    length: length ? [length] : [],
    width: width ? [width] : [],
    style: [...new Set(styles)].sort(),
  };
}

export type FacetFilter = {key: FacetKey; value: string};

/** `{"karat":"14K"}` → {key, value}; null for anything else (Shopify's). */
export function parseFacetFilter(filter: unknown): FacetFilter | null {
  if (!filter || typeof filter !== 'object') return null;
  for (const {key} of FACETS) {
    const value = (filter as Record<string, unknown>)[key];
    if (typeof value === 'string' && value) return {key, value};
  }
  return null;
}

/**
 * OR within a facet, AND across facets — Shopify's own rule, so mixing these
 * with Metal or Price behaves the way the rest of the sidebar does. `except`
 * leaves one facet out, for that facet's own counts.
 */
export function matchesFacets(
  product: IndexedProduct,
  active: FacetFilter[],
  except?: FacetKey,
) {
  for (const {key} of FACETS) {
    if (key === except) continue;
    const wanted = active.filter((filter) => filter.key === key);
    if (
      wanted.length &&
      !wanted.some((filter) => (product[key] ?? []).includes(filter.value))
    ) {
      return false;
    }
  }
  return true;
}

/** Banded facets list smallest first, not alphabetically. */
const BAND_ORDER: Partial<Record<FacetKey, string[]>> = {
  carat: CARAT_BANDS.map(([, label]) => label),
  length: LENGTH_BANDS.map(([, label]) => label),
  width: WIDTH_BANDS.map(([, label]) => label),
};

/**
 * Sidebar groups, in the shape CollectionFilterSidebar takes for Shopify's
 * facets. Each facet counts against every OTHER active facet but not itself,
 * so ticking 14K never zeroes out 10K — the box stays a real choice.
 *
 * `group` turns the matching products into what the grid shows for them (the
 * route's groupForGrid), so a count is the number of CARDS ticking that box
 * yields, not products. Without it each product counts once.
 */
export function facetGroups(
  index: IndexedProduct[],
  active: FacetFilter[],
  group: (products: IndexedProduct[]) => unknown[] = (products) => products,
) {
  return FACETS.map(({key, label}) => {
    const matching = new Map<string, IndexedProduct[]>();
    for (const product of index) {
      if (!matchesFacets(product, active, key)) continue;
      for (const value of product[key] ?? []) {
        const list = matching.get(value);
        if (list) list.push(product);
        else matching.set(value, [product]);
      }
    }
    const counts = new Map(
      [...matching].map(([value, products]) => [value, group(products).length]),
    );
    const order = BAND_ORDER[key];
    const values = [...counts.keys()].sort((a, b) =>
      order
        ? order.indexOf(a) - order.indexOf(b)
        : a.localeCompare(b, 'en', {numeric: true}),
    );
    return {
      id: `facet.${key}`,
      label,
      type: 'LIST',
      values: values.map((value) => ({
        id: `facet.${key}.${value}`,
        label: value,
        count: counts.get(value)!,
        input: JSON.stringify({[key]: value}),
      })),
    };
  }).filter((group) => group.values.length > 0);
}
