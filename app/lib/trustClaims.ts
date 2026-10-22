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
export type TrustClaimIcon =
  | 'shipping'
  | 'returns'
  | 'usa'
  | 'warranty'
  | 'support';

export type TrustClaim = {
  /** The promise, short enough to read at a glance. */
  title: string;
  /** The qualifier that keeps it honest. */
  sub: string;
  icon: TrustClaimIcon;
};

/**
 * Standard U.S. shipping is free from this order total up. Transcribed from
 * checkout — Settings → Shipping and delivery → United States: Standard free
 * on orders $70.00 and up, $8.00 below, Express $15 — because that is what a
 * shopper is actually charged. The site used to say $99 and the shipping
 * policy "all U.S. orders"; neither matched checkout. If the rate changes,
 * change this one number: the badges, announcement bar, homepage ticker, meta
 * description, contact page and product schema all read it.
 */
export const FREE_SHIPPING_THRESHOLD_USD = 70;

/**
 * Titles must be true on their own. On phones the announcement bar shows the
 * title alone (the qualifier is hidden for space), so a bare "Free U.S.
 * Shipping" promised it on every order and "14 Day Returns" read as a cash
 * refund the policy doesn't give.
 */
export const TRUST_CLAIMS: TrustClaim[] = [
  {
    title: `Free U.S. Shipping $${FREE_SHIPPING_THRESHOLD_USD}+`,
    sub: 'Standard, insured with tracking',
    icon: 'shipping',
  },
  // Matches the refund policy: 14 days, exchange or store credit, return
  // shipping on the customer.
  {title: '14-Day Exchanges', sub: 'Or store credit', icon: 'returns'},
  {title: 'Made in U.S.A', sub: 'From our factory to you', icon: 'usa'},
  // In the slot "1 Year Free Warranty" used to hold. That one sat on every
  // product page and in the announcement bar, but neither the refund policy
  // nor the terms of service mentions a warranty, so rule 1 above failed. This
  // is true as stated: the phone line and email are in the footer and the
  // chat widget is on every page. If the store does honour a warranty, publish
  // it in a policy first, then add back
  //   {title: '1 Year Free Warranty', sub: 'On all production defects', icon: 'warranty'},
  // (its icon is still in TrustClaimIconArt).
  {title: 'Free Customer Support', sub: 'Call, email or chat', icon: 'support'},
];

/** One claim on one line, for surfaces that can't split title and qualifier. */
export function claimLine(claim: TrustClaim) {
  return `${claim.title} — ${claim.sub}`;
}
