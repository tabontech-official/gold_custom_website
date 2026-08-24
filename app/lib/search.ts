import type {
  CollectionIndexQuery,
  QuickSearchQuery,
  RegularSearchQuery,
} from 'storefrontapi.generated';

type ResultWithItems<Type extends 'predictive' | 'regular', Items> = {
  type: Type;
  term: string;
  error?: string;
  result: {total: number; items: Items};
};

/** What the dropdown renders: the matching products, and query suggestions. */
export type QuickSearchItems = {
  products: QuickSearchQuery['products']['nodes'];
  queries: NonNullable<QuickSearchQuery['predictiveSearch']>['queries'];
};

export type SearchCollection =
  CollectionIndexQuery['collections']['nodes'][number];

export type RegularSearchReturn = ResultWithItems<
  'regular',
  RegularSearchQuery
>;
export type PredictiveSearchReturn = ResultWithItems<
  'predictive',
  QuickSearchItems
> & {result: {totalCount?: number; collection?: SearchCollection | null}};

/**
 * Returns the empty state of a predictive search result to reset the search state.
 */
export function getEmptyPredictiveSearchResult(): PredictiveSearchReturn['result'] {
  return {
    total: 0,
    totalCount: 0,
    collection: null,
    items: {products: [], queries: []},
  };
}

interface UrlWithTrackingParams {
  /** The base URL to which the tracking parameters will be appended. */
  baseUrl: string;
  /** The trackingParams returned by the Storefront API. */
  trackingParams?: string | null;
  /** Any additional query parameters to be appended to the URL. */
  params?: Record<string, string>;
  /** The search term to be appended to the URL. */
  term: string;
}

/**
 * A utility function that appends tracking parameters to a URL. Tracking parameters are
 * used internally by Shopify to enhance search results and admin dashboards.
 * @example
 * ```ts
 * const baseUrl = 'www.example.com';
 * const trackingParams = 'utm_source=shopify&utm_medium=shopify_app&utm_campaign=storefront';
 * const params = { foo: 'bar' };
 * const term = 'search term';
 * const url = urlWithTrackingParams({ baseUrl, trackingParams, params, term });
 * console.log(url);
 * // Output: 'https://www.example.com?foo=bar&q=search%20term&utm_source=shopify&utm_medium=shopify_app&utm_campaign=storefront'
 * ```
 */
export function urlWithTrackingParams({
  baseUrl,
  trackingParams,
  params: extraParams,
  term,
}: UrlWithTrackingParams) {
  let search = new URLSearchParams({
    ...extraParams,
    q: encodeURIComponent(term),
  }).toString();

  if (trackingParams) {
    search = `${search}&${trackingParams}`;
  }

  return `${baseUrl}?${search}`;
}

/** Words of a string, lowercased, punctuation dropped. */
const searchWords = (value: string) =>
  value.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * Crude singular form, so "earrings" and "earring" unify.
 *
 * The -es case is not optional padding: chain lengths are titled "18 Inches",
 * and stripping only the -s leaves "inche", which never matches a shopper
 * typing "18 inch".
 *
 * ponytail: suffix strip, not a stemmer. Every word this catalogue pluralises
 * is regular, so a real stemmer would be a dependency earning nothing.
 */
const singular = (word: string) => {
  if (word.length > 4 && /(ch|sh|s|x|z)es$/.test(word))
    return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss'))
    return word.slice(0, -1);
  return word;
};

const normalizeWords = (value: string) => searchWords(value).map(singular);

/**
 * Does `word` appear in `haystack`, allowing the last word of a search to be a
 * prefix?
 *
 * A shopper reaches "oval" by typing "ova", and nothing about "ova" is a whole
 * word — so the final word is always treated as unfinished. Only the final one:
 * matching every word by prefix would let "ring" hit "ringlet" and undo the
 * whole-word rule that keeps "ring" away from "earrings". Prefixes are anchored
 * at the start of a word, which is why "ring" still cannot reach "earrings".
 */
const wordInHaystack = (word: string, haystack: Set<string>, partial: boolean) =>
  haystack.has(word) ||
  (partial &&
    word.length >= 2 &&
    [...haystack].some((candidate) => candidate.startsWith(word)));

type RelatableCollection = {
  handle: string;
  title: string;
  products?: {nodes: Array<unknown>};
};

/**
 * Pick the ONE collection a search term is actually about.
 *
 * Shopify's predictive ordering ranks by title similarity alone, which gets the
 * answer wrong in two ways we hit constantly: it puts empty novelty collections
 * first ("rope chain" returns the empty `rope-chain-with-pendants` ahead of
 * `rope-chains`; "earring" returns `baby-earrings` ahead of `earrings`), and any
 * substring counts as a hit — so "ring" looks like a match on "ea-rring-s" and
 * would send someone shopping for rings to the earrings page.
 *
 * Hence: match whole WORDS (killing the substring trap), require every word of
 * the term to be present, drop empty collections, and among the survivors prefer
 * the least specific one — the canonical category rather than a niche subset.
 */
export function mostRelatedCollection<T extends RelatableCollection>(
  term: string,
  collections: T[] | undefined,
): {collection: T; exact: boolean} | null {
  const termWords = normalizeWords(term ?? '');
  if (!termWords.length || !collections?.length) return null;

  let best: {collection: T; score: number; extra: number} | null = null;

  for (const collection of collections) {
    // A suggestion that opens onto "no products" is worse than no suggestion.
    if (collection.products && !collection.products.nodes.length) continue;

    const handleWords = normalizeWords(collection.handle);
    const haystack = new Set([
      ...handleWords,
      ...normalizeWords(collection.title),
    ]);
    const handleSet = new Set(handleWords);
    const isLast = (index: number) => index === termWords.length - 1;
    if (!termWords.some((word, i) => wordInHaystack(word, handleSet, isLast(i))))
      continue;
    if (!termWords.every((word, i) => wordInHaystack(word, haystack, isLast(i))))
      continue;

    // `rings` beats `womens-gold-rings`: fewest words that aren't the term wins,
    // and saying exactly the term and nothing else wins outright.
    const extra = handleWords.filter(
      (word) => !termWords.includes(word),
    ).length;
    const score =
      100 - extra * 10 + (handleWords.length === termWords.length ? 50 : 0);

    if (!best || score > best.score) best = {collection, score, extra};
  }

  // Beyond one qualifying word the collection stops being about what was asked:
  // "cuban" → `cuban-chains` still holds, "gold" → `men-gold-pendants` does not.
  if (!best || best.extra > 1) return null;

  // `exact` means the collection says precisely what the shopper said, give or
  // take a plural — "women diamond ring" → `womens-diamond-ring`. That is a
  // strong enough signal to let the collection define the whole result set.
  // Anything looser ("gold" → `men-gold-pendants`) is only a suggestion.
  return {collection: best.collection, exact: best.extra === 0};
}

/**
 * Keep only the products a shopper would accept as an answer.
 *
 * Shopify ORs the words of a query together, so "18 inch chain" comes back as
 * 629 things that are a chain OR mention 18 — four of the first forty actually
 * being 18-inch. Requiring every word in the title (or product type) is what
 * turns that back into a result list, with the last word allowed to be a prefix
 * so results hold steady while it is still being typed. Tags are deliberately
 * not searched: they are so broadly applied here that matching against them
 * keeps 248 of any 250.
 *
 * Genuinely empty if nothing survives — NOT Shopify's unfiltered order. This
 * runs per fetched batch (regularSearch pages 48 at a time), and Shopify's OR
 * ranking runs dry well before its cursor does: "oval" stays 100% on-title
 * through two pages, then batch 4 has zero oval-titled products in it. Falling
 * back to "show the batch anyway" there means the shopper searching oval rings
 * gets served Figaro chains — the exact dishonesty this filter exists to
 * prevent, just deferred to whichever batch runs out of real matches.
 */
export function productsMatchingTerm<
  T extends {title: string; productType?: string | null},
>(term: string, products: T[]): T[] {
  const termWords = normalizeWords(term ?? '');
  if (!termWords.length) return products;

  return products.filter((product) => {
    const words = new Set(
      normalizeWords(`${product.title} ${product.productType ?? ''}`),
    );
    return termWords.every((word, index) =>
      wordInHaystack(word, words, index === termWords.length - 1),
    );
  });
}
