/**
 * "Frequently Bought Together" pairing across the whole catalog.
 *
 * Two rules, in this order:
 *
 * 1. WHAT to offer — the piece a shopper buying this one also buys. A chain
 *    needs a pendant and a pendant needs a chain; rings and earrings are
 *    bought as a set; a bracelet goes with a ring, the other thing worn on
 *    the hand. That is a category rule, not a per-product list someone has
 *    to maintain in admin. See PAIRS for which collection each half comes
 *    from — women's rings for earrings, men's for bracelets.
 *
 * 2. WHICH one to offer — the one that MATCHES. A 10K Miami Cuban bracelet
 *    should pull the 10K Miami Cuban chain, not whichever chain happens to
 *    sell best, because "the same type" is the whole reason the pair is worn
 *    together. That is `matchScore` below, run over the partner collection's
 *    best-sellers. It can also return NOTHING: a piece in a different karat,
 *    a different gold colour or a wildly different price is not a pair, and
 *    an empty section beats a filler suggestion.
 *
 * ponytail: catalog-wide rule + title scoring, not Shopify's COMPLEMENTARY
 * recommendations. Those need every product wired up by hand in Search &
 * Discovery; this needs nothing and covers the whole catalog on day one.
 */

export type PieceKind = 'chain' | 'pendant' | 'ring' | 'bracelet' | 'earrings';

/**
 * What each kind is offered with, and the collection that half comes from.
 *
 * Ordered deliberately, and the FIRST match wins: "Pendant Necklace" is a
 * pendant, "Charm" is a pendant, and `earrings` must be read before `ring`
 * even though the word boundary already separates them. Only collections
 * that exist on the storefront appear here — there is no `grillz`,
 * `watches` or `anklets` collection to pull from, so those products simply
 * get no block rather than a link to a 404.
 */
const KINDS: Array<{kind: PieceKind; match: RegExp}> = [
  {kind: 'pendant', match: /\b(pendants?|charms?)\b/},
  {kind: 'earrings', match: /\b(earrings?|studs?|hoops?|huggies?)\b/},
  {kind: 'bracelet', match: /\b(bracelets?|bangles?)\b/},
  {kind: 'ring', match: /\b(rings?|bands?)\b/},
  {kind: 'chain', match: /\b(chains?|necklaces?)\b/},
];

export const PAIRS: Record<
  PieceKind,
  {kind: PieceKind; collection: string; label: string}
> = {
  chain: {kind: 'pendant', collection: 'pendants', label: 'Pendant'},
  pendant: {kind: 'chain', collection: 'chains', label: 'Chain'},
  // A bracelet goes with a RING — the other thing worn on the hand, and the
  // half of the ring catalog the earrings pairing does not use. `mens-gold-
  // rings` rather than the flat `rings` because that is what a bracelet
  // buyer here wears: the catalog's bracelets are Cuban, rope and link
  // pieces that sit in `mens-bracelets`, and the women's rings are already
  // spoken for by earrings. Which ring, within that, is the style match —
  // a nugget bracelet pulls a nugget ring.
  // ponytail: not split by the bracelet's own gender, because it cannot be
  // read — nearly every bracelet is filed in BOTH mens-bracelets and
  // womens-bracelets, so the collections say "unisex", not "men's".
  bracelet: {kind: 'ring', collection: 'mens-gold-rings', label: 'Ring'},
  // Rings and earrings are the set bought together; neither reads as a
  // partner for a chain.
  ring: {kind: 'earrings', collection: 'earrings', label: 'Earrings'},
  // `womens-rings`, not `rings`: earrings are bought by and for women here,
  // and the flat `rings` collection is mostly men's signet and nugget rings —
  // so a pair of studs was being sold a ring its buyer would never wear.
  // ponytail: the mirror case (a men's ring offering men's earrings) would
  // need the ring's own gender, which no field on the product states
  // reliably; `mens-rings`/`mens-earrings` collections exist if it ever
  // matters enough to look up.
  earrings: {kind: 'ring', collection: 'womens-rings', label: 'Ring'},
};

/**
 * What kind of piece this is, or undefined when it is none of them (grillz,
 * watches, a gift card).
 *
 * The TITLE wins over the merchant's filing, and that is the point: the
 * best-selling product in the `pendants` collection is a "10K Bamboo Heart
 * Ring" — typed Pendants in admin, a ring on the page — and offering a ring
 * as the pendant to hang on a chain is worse than offering nothing. What the
 * shopper reads is what they are buying. productType and category are the
 * fallback for a title that names no piece at all ("10K Bamboo Heart").
 */
export function pieceKind(product: {
  title?: string | null;
  productType?: string | null;
  category?: {name?: string | null} | null;
}): PieceKind | undefined {
  const title = (product.title ?? '').toLowerCase();
  const filed = [product.productType, product.category?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    KINDS.find((entry) => entry.match.test(title))?.kind ??
    KINDS.find((entry) => entry.match.test(filed))?.kind
  );
}

/** 10K / 14K / 18K — two pieces in different karats are different golds. */
const KARAT = /\b(10|14|18|22|24)\s?k(?:t|arat)?\b/;
/** Yellow, white or rose. Two colours worn together is a deliberate look. */
const COLOR = /\b(yellow|white|rose)\b/;

/**
 * The words that make two pieces the SAME TYPE: link style, cut, stone work.
 * A shared one of these is what the shopper actually sees — a Cuban bracelet
 * beside a Cuban chain, a nugget ring beside nugget studs — so they outweigh
 * the free-text motif words below.
 */
const STYLE = new Set([
  'miami',
  'cuban',
  'rope',
  'figaro',
  'franco',
  'byzantine',
  'herringbone',
  'curb',
  'wheat',
  'moon',
  'mariner',
  'anchor',
  'tennis',
  'nugget',
  'signet',
  'presidential',
  'baguette',
  'pave',
  'pavé',
  'iced',
  'diamond',
  'diamonds',
  'hollow',
  'braided',
  'flat',
  'round',
  'square',
]);

/**
 * Title words that describe nothing about the piece: the metal everything
 * here is made of, sizing, packaging and grammar. Left in, they score
 * "10K Gold 8 Inch" against "10K Gold 22 Inch" as a design match.
 */
const NOISE = new Set([
  'gold',
  'the',
  'and',
  'with',
  'for',
  'inch',
  'inches',
  'mens',
  'womens',
  'men',
  'women',
  'ladies',
  'real',
  'new',
  'set',
  'size',
  'small',
  'medium',
  'large',
  'one',
  'two',
  'three',
  'solid',
  'semi',
  'piece',
  'pcs',
  'style',
  'custom',
  'plated',
  'finish',
  'free',
  'made',
  // Scored on their own below — counting them here as well would let two
  // unrelated pieces clear the floor on karat and colour alone.
  'yellow',
  'white',
  'rose',
  // The names of the PIECES themselves. A pendant titled "...with Chain-Link
  // Halo" is not a better match for a chain than any other pendant, but it
  // used to score for the word "chain" — and since only a handful of pendant
  // titles mention a chain at all, those few outscored the entire catalog and
  // got served to hundreds of chains between them. Nineteen pendants covered
  // 120 chains, measured, which is exactly the duplication this removes.
  'chain',
  'chains',
  'necklace',
  'necklaces',
  'pendant',
  'pendants',
  'charm',
  'charms',
  'ring',
  'rings',
  'band',
  'bands',
  'bracelet',
  'bracelets',
  'bangle',
  'bangles',
  'earring',
  'earrings',
  'stud',
  'studs',
  'hoop',
  'hoops',
]);

/**
 * A title split into the two things worth comparing: its style words, and
 * its motif words ("last supper", "jesus", "crown", "bamboo"). Karat and
 * colour are scored separately, so they are noise here — counting them twice
 * would let two unrelated pieces clear the floor on metal alone.
 */
function titleWords(title: string) {
  const words = new Set(title.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  return {
    style: new Set([...words].filter((word) => STYLE.has(word))),
    motif: new Set(
      [...words].filter((word) => !STYLE.has(word) && !NOISE.has(word)),
    ),
  };
}

function first(title: string, pattern: RegExp): string | undefined {
  return title.toLowerCase().match(pattern)?.[1];
}

/**
 * How well two pieces go together, or `null` when they do not go together at
 * all — which is the important half. A suggestion has to be one a shopper
 * would actually wear with the piece they are looking at, so anything that
 * fails a hard rule is dropped rather than ranked last:
 *
 * - different karat, or different gold colour: two different metals side by
 *   side, which is the single most visible way a pair can look wrong;
 * - more than 3x apart in price: a $200 pendant is not sold by a $4,000
 *   chain, in either direction.
 *
 * What survives is scored on what the two titles SHARE: a style word (Cuban,
 * nugget, pavé) is worth 3, any other motif word 1, matching karat 2 and
 * matching colour 1. The floor of 3 is exactly "same karat, same colour" —
 * below that there is no reason to believe the two belong together, and no
 * suggestion is better than a filler one.
 */
export function matchScore(
  product: {title?: string | null; price?: number | null},
  candidate: {title?: string | null; price?: number | null},
): number | null {
  const a = product.title ?? '';
  const b = candidate.title ?? '';

  const karatA = first(a, KARAT);
  const karatB = first(b, KARAT);
  if (karatA && karatB && karatA !== karatB) return null;

  // Unstated means yellow. Most titles here name the colour only when it is
  // NOT yellow ("10K 2.2mm Miami Cuban Chain" is yellow gold), so treating a
  // silent title as "unknown" let white-gold pieces through as matches and,
  // worse, left the whole comparison resting on karat alone.
  // ponytail: if a white-gold line ever ships without saying so in the title,
  // read the colour off the variant option instead of defaulting here.
  const colorA = first(a, COLOR) ?? 'yellow';
  const colorB = first(b, COLOR) ?? 'yellow';
  if (colorA !== colorB) return null;

  const priceA = product.price ?? 0;
  const priceB = candidate.price ?? 0;
  if (priceA > 0 && priceB > 0) {
    const ratio = priceA > priceB ? priceA / priceB : priceB / priceA;
    if (ratio > 3) return null;
  }

  const wordsA = titleWords(a);
  const wordsB = titleWords(b);
  const sharedStyle = [...wordsB.style].filter((word) =>
    wordsA.style.has(word),
  ).length;
  const sharedMotif = [...wordsB.motif].filter((word) =>
    wordsA.motif.has(word),
  ).length;

  const score =
    sharedStyle * 3 +
    sharedMotif +
    (karatA && karatA === karatB ? 2 : 0) +
    (colorA === colorB ? 1 : 0);

  return score >= 3 ? score : null;
}

/**
 * Stable 32-bit hash of a string (FNV-1a). Same input, same number, forever —
 * which is the point: the pick has to survive a re-render, a cache hit and a
 * deploy, so it cannot come from `Math.random()`.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * How far below the best score a candidate can still be offered: one style
 * word's worth.
 *
 * This is the difference between "show the matching piece" and "show the
 * whole matching catalog", and both are wanted. Where a genuinely close
 * partner exists — a Cuban bracelet and the Cuban chain from the same line —
 * it scores several points clear, and only its equals stay on the shortlist.
 * Where the best is barely above the floor, which is every chain looking for
 * a pendant (pendants have motifs, not link styles), the shortlist opens up
 * to the hundreds of pendants that fit the metal and the price, and they get
 * spread across the chains instead of the same two dozen "Cuban link border"
 * pendants being served to all 353 of them.
 */
const SHORTLIST_TOLERANCE = 3;

/**
 * The best partner among the candidates, or undefined when none of them is a
 * real match.
 *
 * Score picks the shortlist; the product's own handle picks from it. That
 * second half is what stops one best-selling pendant being bolted to every
 * chain in the catalog: the choice is stable per product (same chain, same
 * pendant, every load and every cache hit) but different between products.
 */
export function bestMatch<
  T extends {title?: string | null; price?: number | null},
>(
  product: {title?: string | null; price?: number | null; handle?: string},
  candidates: T[],
) {
  const scored: Array<{candidate: T; score: number}> = [];
  let top = 0;
  for (const candidate of candidates) {
    const score = matchScore(product, candidate);
    if (score === null) continue;
    if (score > top) top = score;
    scored.push({candidate, score});
  }

  const shortlist = scored.filter(
    (entry) => entry.score >= top - SHORTLIST_TOLERANCE,
  );
  if (!shortlist.length) return undefined;

  const key = product.handle || product.title || '';
  return shortlist[hash(key) % shortlist.length].candidate;
}
