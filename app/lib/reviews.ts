/**
 * One published Judge.me review, as its widget API returns it with
 * `json_request=true` — only the fields the carousel shows. `body` is plain
 * text, so nothing is injected as HTML.
 */
export type Review = {
  uuid: string;
  rating: number;
  title: string;
  body: string;
  reviewer_name: string;
  /** Customer photos: `small` is 160px wide, `huge` 1024px. */
  pictures_urls?: {small: string; huge: string}[];
};

export type ReviewCarouselData = {
  /** Average for the header stars, 1–5. */
  rating: number;
  /** "from {count} reviews". */
  count: number;
  reviews: Review[];
};

/** Most reviews the product page asks Judge.me for. */
export const REVIEWS_PER_PAGE = 20;

/**
 * What the product page's review carousel shows.
 *
 * The product's own reviews when it has any — that is what a shopper on the
 * page wants to read, low ratings included. Most products have none yet, so
 * otherwise the store's 4–5★ reviews, the same cut Judge.me's own featured
 * carousel makes, with the header carrying the store's real totals. Null when
 * there is nothing to show, so the section is left out rather than empty.
 *
 * ponytail: a product's count caps at REVIEWS_PER_PAGE; read its
 * reviews.rating_count metafield once one outgrows a page.
 */
export function carouselReviews(
  productReviews: Review[],
  storeReviews: Review[],
  storeTotals: {rating?: string | number; count?: number},
): ReviewCarouselData | null {
  if (productReviews.length) {
    return {
      // Totals count every review Judge.me holds; only the cards drop repeats.
      rating: average(productReviews),
      count: productReviews.length,
      reviews: uniqueReviews(productReviews),
    };
  }
  const best = storeReviews.filter((review) => review.rating >= 4);
  if (!best.length) return null;
  const rating = Number(storeTotals.rating);
  const count = Number(storeTotals.count);
  return {
    rating: rating >= 1 && rating <= 5 ? rating : average(best),
    count: count >= best.length ? count : best.length,
    reviews: uniqueReviews(best),
  };
}

/**
 * One card per reviewer per text. The same customer often reviews twice —
 * once in the Shop app, once from the review-request email — and two
 * identical "Nice quality — CJ" cards side by side read as a glitch. Keeps the
 * copy with more photos, in the first copy's (newest-first) position.
 */
export function uniqueReviews(reviews: Review[]): Review[] {
  const byKey = new Map<string, Review>();
  for (const review of reviews) {
    const key = `${review.reviewer_name}\n${review.body}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    const kept = byKey.get(key);
    if (!kept || photoCount(review) > photoCount(kept)) {
      byKey.set(key, review);
    }
  }
  return [...byKey.values()];
}

const photoCount = (review: Review) => review.pictures_urls?.length ?? 0;

function average(reviews: Review[]) {
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 100) / 100;
}
