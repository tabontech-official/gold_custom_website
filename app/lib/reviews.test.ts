/**
 * Self-check for carouselReviews.
 * No test runner in this project, so: `node app/lib/reviews.test.ts`
 */
import assert from 'node:assert/strict';
import {carouselReviews, uniqueReviews, type Review} from './reviews.ts';

// Distinct text per review, or uniqueReviews rightly folds them into one.
const rated = (...ratings: number[]) =>
  ratings.map(
    (rating, i) =>
      ({uuid: String(i), rating, reviewer_name: 'R', body: `#${i}`}) as Review,
  );

// The product's own reviews win, low ratings included — the user's test
// review on the Aztec Calendar Pendant must show on that page.
const own = carouselReviews(rated(4), rated(5, 5), {rating: '3.13', count: 8});
assert.deepEqual(own, {rating: 4, count: 1, reviews: rated(4)});
assert.deepEqual(carouselReviews(rated(5, 5, 3), [], {}), {
  rating: 4.33,
  count: 3,
  reviews: rated(5, 5, 3),
});

// No reviews of its own: the store's 4–5★ ones, under the store's totals.
const store = carouselReviews([], rated(4, 1, 5, 3, 5), {
  rating: '3.13',
  count: 8,
});
assert.deepEqual(
  store?.reviews.map((review) => review.rating),
  [4, 5, 5],
);
assert.equal(store?.rating, 3.13);
assert.equal(store?.count, 8);

// Totals missing or nonsense: fall back to what is on screen.
assert.deepEqual(carouselReviews([], rated(4, 5), {}), {
  rating: 4.5,
  count: 2,
  reviews: rated(4, 5),
});
assert.equal(
  carouselReviews([], rated(5), {rating: 'x', count: -1})?.rating,
  5,
);

// Nothing worth showing: no section at all.
assert.equal(carouselReviews([], [], {}), null);
assert.equal(carouselReviews([], rated(1, 3), {rating: '2', count: 2}), null);

// ── Repeats ────────────────────────────────────────────────────────────────
// The live case on the nugget studs: CJ left "Nice quality" twice (Shop app,
// then web with a photo), plus one other review.
const photo = {small: 's.jpg', huge: 'h.jpg'};
const cjApp = {
  uuid: 'app',
  rating: 5,
  title: '',
  body: 'Nice quality',
  reviewer_name: 'CJ',
  pictures_urls: [],
} as Review;
const cjWeb = {
  ...cjApp,
  uuid: 'web',
  body: 'Nice quality ',
  pictures_urls: [photo],
};
const other = {
  ...cjApp,
  uuid: 'anon',
  rating: 3,
  body: 'Damaged',
  reviewer_name: 'Anonymous',
};

// One CJ card, the one with the photo, still first; the other review stays.
assert.deepEqual(
  uniqueReviews([cjApp, cjWeb, other]).map((review) => review.uuid),
  ['web', 'anon'],
);
// Case and spacing don't make it a different review.
assert.equal(
  uniqueReviews([cjApp, {...cjApp, uuid: 'x', body: '  NICE   quality'}])
    .length,
  1,
);
// Same words from someone else is someone else's review.
assert.equal(
  uniqueReviews([cjApp, {...cjApp, uuid: 'y', reviewer_name: 'Sam'}]).length,
  2,
);
// The header still counts all three: Judge.me holds three reviews.
const studs = carouselReviews([cjApp, cjWeb, other], [], {});
assert.equal(studs?.count, 3);
assert.equal(studs?.reviews.length, 2);

console.log('reviews.test.ts: ok');
