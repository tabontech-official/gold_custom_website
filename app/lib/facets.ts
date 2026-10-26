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
 *
 * In the URL they ride the same `filter` param as Shopify's facets, as
 * {"karat":"14K"}, so the sidebar's links, chips and "Clear all" and the
 * robots rules treat both kinds alike. getFiltersFromParam keeps them away
 * from Shopify.
 *
 * Plain TS with no app imports, so `node app/lib/facets.test.ts` runs it.
 */

export type FacetKey = 'karat' | 'carat' | 'style';

/** Sidebar order and labels. */
export const FACETS: {key: FacetKey; label: string}[] = [
  {key: 'karat', label: 'Karat'},
  {key: 'carat', label: 'Carat'},
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
} & Record<FacetKey, string[]>;

const KARAT = /\b(10|14|18|22|24)\s?k(?:t|arat)?\b/gi;
const KARAT_OPTION = /^(metal|gold purity|material)$/i;

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

export const CARAT_BANDS: [below: number, label: string][] = [
  [0.5, 'Under 0.50 ct'],
  [1, '0.50–0.99 ct'],
  [2, '1.00–1.99 ct'],
  [3, '2.00–2.99 ct'],
  [Infinity, '3.00 ct & up'],
];

/** The diamond-weight band the title names, or null. */
export function caratBandOf(product: Pick<FacetSource, 'title'>) {
  const match = CARAT.exec(product.title);
  const weight = match ? Number(match[1]) : NaN;
  if (!(weight > 0 && weight <= MAX_CARAT)) return null;
  return CARAT_BANDS.find(([below]) => weight < below)![1];
}

export function indexProduct(product: FacetSource): IndexedProduct {
  const carat = caratBandOf(product);
  const styles = (product.collections?.nodes ?? [])
    .map((collection) => STYLE_COLLECTIONS[collection.handle])
    .filter(Boolean);
  return {
    id: product.id,
    groupName: product.groupName,
    karat: karatsOf(product),
    carat: carat ? [carat] : [],
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
      !wanted.some((filter) => product[key].includes(filter.value))
    ) {
      return false;
    }
  }
  return true;
}

const CARAT_ORDER = CARAT_BANDS.map(([, label]) => label);

/**
 * Sidebar groups, in the shape CollectionFilterSidebar takes for Shopify's
 * facets. Each facet counts against every OTHER active facet but not itself,
 * so ticking 14K never zeroes out 10K — the box stays a real choice.
 */
export function facetGroups(index: IndexedProduct[], active: FacetFilter[]) {
  return FACETS.map(({key, label}) => {
    const counts = new Map<string, number>();
    for (const product of index) {
      if (!matchesFacets(product, active, key)) continue;
      for (const value of product[key]) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    const values = [...counts.keys()].sort((a, b) =>
      key === 'carat'
        ? CARAT_ORDER.indexOf(a) - CARAT_ORDER.indexOf(b)
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
