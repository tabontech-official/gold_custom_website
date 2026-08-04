import {getSeoMeta, type SeoConfig} from '@shopify/hydrogen';

// schema-dts is a transitive dep of @shopify/hydrogen, not a direct one — take
// the JSON-LD type from the SeoConfig contract so we don't import it directly.
type JsonLd = NonNullable<SeoConfig['jsonLd']>;

/**
 * Canonical identity for the storefront. `origin` is the fallback used when
 * root loader data isn't reachable (error boundaries, the odd static route);
 * everywhere else we prefer the live `shop.primaryDomain.url` so a domain
 * change doesn't silently strand every canonical tag on the old host.
 */
export const SITE = {
  name: 'Gold Custom',
  origin: 'https://goldcustom.com',
  description:
    'Shop 10K & 14K gold jewelry, rings, chains and charms. Free US shipping over $99, 14-day returns and 1-year warranty on every piece.',
  logo: 'https://goldcustom.com/favicon.png',
} as const;

type RootData = {
  header?: {shop?: {primaryDomain?: {url?: string | null} | null} | null} | null;
  publicStoreDomain?: string | null;
};

/** Resolve the production origin, preferring the shop's own primary domain. */
export function siteOrigin(root?: RootData | null): string {
  const primary = root?.header?.shop?.primaryDomain?.url;
  if (primary) return primary.replace(/\/$/, '');

  const publicDomain = root?.publicStoreDomain;
  if (publicDomain) {
    return publicDomain.startsWith('http')
      ? publicDomain.replace(/\/$/, '')
      : `https://${publicDomain.replace(/\/$/, '')}`;
  }

  return SITE.origin;
}

/** Absolute URL for `path`. Canonicals and JSON-LD must never be relative. */
export function absoluteUrl(origin: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${origin.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/**
 * Pull root loader data out of a meta function's `matches`, so route meta can
 * resolve the real origin without another query.
 */
export function rootDataFrom(
  matches: readonly ({id: string; data?: unknown} | undefined)[],
) {
  return (matches.find((m) => m?.id === 'root')?.data ?? null) as RootData | null;
}

/**
 * Trim to a sane meta-description length, cutting on a word boundary so it
 * doesn't end mid-word.
 *
 * The limit is 155, not the 160 Google truncates at, because `getSeoMeta`
 * rejects anything longer: its message reads "should not be longer than 160
 * characters" but the check behind it is `value.length > 155`. Descriptions of
 * 156-160 chars therefore pass every human reading of the rule and still log
 * `Error in SEO input` on every render.
 */
const MAX_DESCRIPTION = 155;

export function metaDescription(
  input?: string | null,
  fallback: string = SITE.description,
): string {
  const text = (input ?? '').replace(/\s+/g, ' ').trim() || fallback;
  if (text.length <= MAX_DESCRIPTION) return text;
  // -3 leaves room for the ellipsis; the word-boundary cut only shortens it.
  return text.slice(0, MAX_DESCRIPTION - 3).replace(/\s+\S*$/, '') + '…';
}

/**
 * Wrapper around `getSeoMeta` that applies the sitewide defaults.
 *
 * React Router replaces a parent's meta with the child's rather than merging,
 * so the root `titleTemplate` does NOT carry into routes that export their own
 * `meta`. Every route therefore has to restate it — this does that in one
 * place, and normalises `getSeoMeta`'s `| undefined` return to an array.
 *
 * A route may pass its own `titleTemplate` to opt out: the homepage title is
 * authored in Shopify with the brand already in it, so it uses `%s`.
 */
export function pageSeo(config: SeoConfig & {noIndex?: boolean}) {
  const {noIndex, ...seo} = config;

  return (
    getSeoMeta({
      titleTemplate: `%s | ${SITE.name}`,
      ...seo,
      ...(noIndex ? {robots: {noIndex: true, noFollow: false}} : {}),
    }) ?? []
  );
}

export function organizationJsonLd(origin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: SITE.name,
    url: origin,
    logo: absoluteUrl(origin, '/favicon.png'),
    description: SITE.description,
  } as JsonLd;
}

/**
 * WebSite + SearchAction: tells Google (and AI answer engines) that the store
 * has an internal search endpoint they can deep-link into.
 */
export function websiteJsonLd(origin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: SITE.name,
    url: origin,
    publisher: {'@id': `${origin}/#organization`},
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  } as JsonLd;
}

/**
 * Free U.S. shipping kicks in at $99. Schema has no way to express "free above
 * a threshold" that Google reads, so a flat `shippingRate: 0` on a $40 charm
 * would simply be a false claim. The node is therefore attached only to items
 * that individually clear the threshold, where it is unconditionally true;
 * cheaper items get no `shippingDetails` rather than a wrong one.
 *
 * Mirrors the on-page trust badge in ProductTrustBadges. If that promise
 * changes both must change — Google cross-checks structured data against the
 * visible page, and a mismatch is worse than an omission.
 */
export const FREE_SHIPPING_THRESHOLD_USD = 99;

export function offerShippingDetails(price: {
  amount: string;
  currencyCode: string;
}) {
  const amount = Number(price.amount);
  const qualifies =
    price.currencyCode === 'USD' &&
    Number.isFinite(amount) &&
    amount >= FREE_SHIPPING_THRESHOLD_USD;
  if (!qualifies) return undefined;

  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {'@type': 'MonetaryAmount', value: 0, currency: 'USD'},
    shippingDestination: {'@type': 'DefinedRegion', addressCountry: 'US'},
  };
}

/**
 * Transcribed from the store's actual refund policy, not the generous default
 * these snippets usually carry: returns run 14 days, settled as an exchange or
 * store credit, with shipping and handling deducted.
 *
 * Deliberately NOT `FullRefund` — advertising a cash refund the policy does
 * not honour is the kind of mismatch that costs a Merchant Center account.
 */
export const MERCHANT_RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/ReturnShippingFees',
  refundType: [
    'https://schema.org/ExchangeRefund',
    'https://schema.org/StoreCreditRefund',
  ],
} as const;

/**
 * Google treats an `Offer` whose `priceValidUntil` has passed as stale and can
 * drop the price from rich results, so this rolls a year ahead of each render
 * rather than being a fixed date that silently expires.
 *
 * Call this in a loader, never at render time: it is evaluated on both server
 * and client, and a `new Date()` that straddles UTC midnight yields two
 * different strings for the same markup — a hydration mismatch.
 */
export function priceValidUntilDate(now: Date = new Date()) {
  const date = new Date(now);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/** BreadcrumbList from `[{name, path}]`, ordered root → current page. */
export function breadcrumbJsonLd(
  origin: string,
  crumbs: {name: string; path: string}[],
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(origin, crumb.path),
    })),
  } as JsonLd;
}
