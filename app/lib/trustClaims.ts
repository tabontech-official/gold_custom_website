/**
 * The promises this store makes on the storefront.
 *
 * One list, because these are policy claims and not decoration. A badge here
 * once said "30 Day Returns / No questions asked" while the refund policy gave
 * 14 days, exchange or store credit — a promise the business could not keep,
 * sitting on the highest-intent surface on the site. Copy that lives in two
 * components drifts from the policy the moment one of them is edited, so the
 * product page and the collection strip both read from here.
 *
 * Rules for anything added:
 *  - it must be written down in a policy page, or be true of every product,
 *  - it must be stated in the policy's own terms, not marketing's,
 *  - if it stops being true it is deleted here, and disappears everywhere.
 *
 * Deliberately NOT here: a gold-authenticity guarantee. No published policy
 * backs one yet. Add it once one exists, in that policy's wording.
 */
export type TrustClaimIcon = 'shipping' | 'returns' | 'usa' | 'warranty';

export type TrustClaim = {
  /** The promise, short enough to read at a glance. */
  title: string;
  /** The qualifier that keeps it honest. */
  sub: string;
  icon: TrustClaimIcon;
};

export const TRUST_CLAIMS: TrustClaim[] = [
  {title: 'Free U.S. Shipping', sub: 'On orders over $99', icon: 'shipping'},
  // Matches the refund policy: 14 days, exchange or store credit, return
  // shipping on the customer.
  {
    title: '14 Day Returns',
    sub: 'Exchange or store credit · Return shipping fees apply',
    icon: 'returns',
  },
  {title: 'Made in U.S.A', sub: 'From our factory to you', icon: 'usa'},
  // Already published on every product page before this list existed. Kept
  // verbatim rather than dropped — removing a live promise is a business
  // decision, not a refactor.
  {
    title: '1 Year Free Warranty',
    sub: 'On all production defects',
    icon: 'warranty',
  },
];
