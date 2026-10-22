/**
 * Where a visit came from, written onto the cart so it survives the hop to
 * checkout.goldcustom.com and any payment window (Shop Pay, Afterpay, Affirm)
 * and lands on the order. GA4 lost the source on 5 orders ($6.7k) in the Sep–Oct
 * audit; the cart is the one thing every path to an order shares.
 *
 * Keys start with `_`, which checkout hides from the shopper; the order still
 * shows them in the admin.
 */
export type Attribute = {key: string; value: string};

const CAMPAIGN_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const;

export type Landing = {
  /** `location.search` of the first page of the visit. */
  search: string;
  /** `document.referrer` of the first page of the visit. */
  referrer: string;
  /** Path of the first page of the visit. */
  path: string;
  /** `document.cookie`, for the GA4 client and session IDs. */
  cookie: string;
};

/** `_ga=GA1.1.123.456` → `123.456`. */
function gaClientId(cookie: string) {
  return /(?:^|;\s*)_ga=GA\d\.\d\.(\d+\.\d+)/.exec(cookie)?.[1];
}

/** `_ga_XXXX=GS1.1.s1761234567$…` or `GS1.1.1761234567.…` → `1761234567`. */
function gaSessionId(cookie: string) {
  return /(?:^|;\s*)_ga_[A-Z0-9]+=GS\d\.\d\.s?(\d+)/.exec(cookie)?.[1];
}

/**
 * The cart's attributes with the visit's source added, or null when there is
 * nothing new to write. Never overwrites: the first touch that reached the cart
 * wins, and attributes other code set are kept as they are (updateAttributes
 * replaces the whole list, so they must be passed back in).
 */
export function withAttribution(
  existing: Attribute[] | null | undefined,
  landing: Landing,
): Attribute[] | null {
  const current = existing ?? [];
  if (current.some((a) => a.key.startsWith('_attribution'))) return null;

  const params = new URLSearchParams(landing.search);
  const add: Attribute[] = [];
  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key);
    if (value) add.push({key: `_${key}`, value: value.slice(0, 255)});
  }
  // Only an outside referrer is a source; our own hosts are just navigation.
  let host = '';
  try {
    host = landing.referrer ? new URL(landing.referrer).hostname : '';
  } catch {
    // Malformed referrer: treat as none.
  }
  if (host && !/(^|\.)goldcustom\.com$/.test(host)) {
    add.push({key: '_landing_referrer', value: landing.referrer.slice(0, 255)});
  }
  add.push({key: '_landing_page', value: landing.path.slice(0, 255)});
  const client = gaClientId(landing.cookie);
  const session = gaSessionId(landing.cookie);
  if (client) add.push({key: '_ga_client_id', value: client});
  if (session) add.push({key: '_ga_session_id', value: session});
  // Marker so the next add-to-cart doesn't write again.
  add.push({key: '_attribution', value: '1'});

  return [...current, ...add];
}
