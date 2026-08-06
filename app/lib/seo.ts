import {getSeoMeta, type SeoConfig} from '@shopify/hydrogen';
// Relative, not `~/lib/cdnImage`: the self-checks in this folder run under bare
// `npx tsx`, which rejects the tsconfig's `paths` alias (no `baseUrl`). An
// aliased import here takes seoOffer.test.ts down with it.
import {cdnWidth} from './cdnImage';

// schema-dts is a transitive dep of @shopify/hydrogen, not a direct one — take
// the JSON-LD type from the SeoConfig contract so we don't import it directly.
type JsonLd = NonNullable<SeoConfig['jsonLd']>;

/**
 * Canonical identity for the storefront.
 *
 * `origin` is the www host, not the apex: goldcustom.com 301s to
 * www.goldcustom.com, and a canonical pointing at a redirect is one more hop
 * Google has to resolve before it will trust it.
 */
export const SITE = {
  name: 'Gold Custom',
  origin: 'https://www.goldcustom.com',
  description:
    'Shop 10K & 14K gold jewelry, rings, chains and charms. Free US shipping over $99, 14-day returns and 1-year warranty on every piece.',
  logo: 'https://www.goldcustom.com/favicon.png',
  /**
   * Fallback for any page with no image of its own — which was every share of
   * the home page, and is why those previews came back blank.
   *
   * NOT `logo`: that is a 150x134 favicon, far under the 600x315 every platform
   * needs before it will render a large card, so it would have swapped a blank
   * preview for a postage stamp. This is a brand shot asked for at 1200x630;
   * the source tops out around 1100px so the CDN returns 1100x619, which still
   * clears the threshold comfortably.
   *
   * Swap this for a purpose-made 1200x630 banner the moment there is one — this
   * is the one string to change.
   */
  ogImage:
    'https://cdn.shopify.com/s/files/1/0806/9568/9464/collections/Gold_Jewelry-1-757994.webp?v=1770959624&width=1200&height=630&crop=center&quality=80',
} as const;

type RootData = {
  header?: {
    shop?: {primaryDomain?: {url?: string | null} | null} | null;
  } | null;
  publicStoreDomain?: string | null;
};

/**
 * The canonical origin for every URL this storefront emits.
 *
 * A constant, and deliberately NOT `shop.primaryDomain.url`. Shopify documents
 * that field as the *online store's* URL, and this shop runs two storefronts:
 * the Online Store channel keeps goldcustomedo.myshopify.com as its primary
 * domain, while this Hydrogen storefront serves www.goldcustom.com. Reading
 * primaryDomain therefore stamped every canonical, og:url and JSON-LD @id on
 * this site with the other storefront's hostname — pointing all of our own
 * ranking signals at a duplicate site. `publicStoreDomain` is the same trap:
 * it is the API host, not this storefront.
 *
 * Preview deployments (*.o2.myshopify.dev) resolve to production here too,
 * which is correct — Oxygen serves them with a blanket robots disallow, so
 * they must never advertise themselves as canonical.
 *
 * The root-data argument is accepted but unread, so the 26 call sites stay as
 * they are. Nothing about the canonical host is runtime-derived any more.
 */
export function siteOrigin(_root?: RootData | null): string {
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
  return (matches.find((m) => m?.id === 'root')?.data ??
    null) as RootData | null;
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
 * Pull the first usable image URL out of a `SeoConfig['media']`, which may be a
 * bare string, one object, or an array of either.
 */
function firstMediaUrl(media: SeoConfig['media']): string | null {
  for (const item of Array.isArray(media) ? media : [media]) {
    if (typeof item === 'string' && item) return item;
    if (item && typeof item === 'object' && item.url) return item.url;
  }
  return null;
}

/**
 * Normalise an image for social crawlers: absolute, and not a 3000px original.
 *
 * Absolute because a relative `og:image` is the single most reliable way to get
 * a blank preview — the crawler has no page context to resolve it against.
 * Capped at 1200px because crawlers download whatever you point them at, and
 * the product masters here are 3024x3024.
 *
 * Deliberately NOT cropped to 1.91:1. A centre crop of a chain photo cuts the
 * ends off the chain; a 1200px square still clears every platform's
 * large-card threshold, so there is nothing to buy by cropping.
 */
function socialImage(url: string): string {
  const absolute = url.startsWith('/') ? absoluteUrl(SITE.origin, url) : url;
  return absolute.includes('cdn.shopify.com')
    ? cdnWidth(absolute, 1200)
    : absolute;
}

/**
 * Wrapper around `getSeoMeta` that applies the sitewide defaults AND the social
 * tags Hydrogen does not emit.
 *
 * React Router replaces a parent's meta with the child's rather than merging,
 * so the root `titleTemplate` does NOT carry into routes that export their own
 * `meta`. Every route therefore has to restate it — this does that in one
 * place, and normalises `getSeoMeta`'s `| undefined` return to an array.
 *
 * THE OG IMAGE BUG THIS EXISTS TO FIX
 * -----------------------------------
 * `getSeoMeta` branches on the shape of `media`. Given a string it emits
 * `og:image`. Given an OBJECT — `{type: 'image', url}`, which is what every
 * route here passes — it emits only:
 *
 *     og:image:url · og:image:secure_url · og:image:type
 *
 * and never a plain `og:image`. The Open Graph spec calls `og:image:url`
 * "identical to og:image", and Facebook honours that, but LinkedIn, WhatsApp,
 * iMessage and Slack look for `og:image` and find nothing. Verified against the
 * live site: every product and collection page had the three sub-properties and
 * no `og:image`, and the home page had no image tag of any kind.
 *
 * `getSeoMeta` also never emits `og:type`, `og:site_name`, `twitter:card` or
 * `twitter:image` — without `twitter:card` X renders no card at all.
 *
 * So this appends those, and falls back to a brand image when a route has no
 * media of its own, because an absent image and an empty one look the same to a
 * crawler: a blank preview.
 */
export function pageSeo(
  config: SeoConfig & {
    noIndex?: boolean;
    /** `product` on PDPs, `article` on blog posts, `website` everywhere else. */
    ogType?: 'website' | 'product' | 'article';
  },
) {
  const {noIndex, ogType = 'website', ...seo} = config;

  // Shopify's own SEO titles often already end in the brand ("… | Gold
  // Custom"), and appending the template on top produced the doubled
  // "… | Gold Custom | Gold Custom" that was live on collection pages.
  const title = typeof seo.title === 'string' ? seo.title : '';
  const titleTemplate =
    seo.titleTemplate ??
    (title.trim().toLowerCase().endsWith(SITE.name.toLowerCase())
      ? '%s'
      : `%s | ${SITE.name}`);

  const tags =
    getSeoMeta({
      ...seo,
      titleTemplate,
      ...(noIndex ? {robots: {noIndex: true, noFollow: false}} : {}),
    }) ?? [];

  const image = socialImage(firstMediaUrl(seo.media) ?? SITE.ogImage);

  return [
    ...tags,
    // The tag every scraper actually looks for. `property`, not `name` — the
    // Open Graph spec is RDFa, and `name` is what Hydrogen uses for its
    // string-media branch, which is its own small bug.
    {property: 'og:image', content: image},
    {property: 'og:image:alt', content: title || SITE.name},
    {property: 'og:type', content: ogType},
    {property: 'og:site_name', content: SITE.name},
    // No card type means X renders no card. `name`, per the Twitter spec.
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:image', content: image},
    // Deliberately no og:image:width/height. The CDN silently returns the
    // source's own size when asked for more (the brand fallback resolves to
    // 1100x619, not the 1200x630 requested), so any number here would be a
    // claim we cannot keep — and a wrong one suppresses the card outright.
  ];
}

/**
 * The physical store, as the Liquid storefront published it. Keeping the same
 * name, phone, address and coordinates across the migration matters: Google
 * matches these against the Business Profile, and a changed NAP reads as a
 * different business and resets the local listing's history.
 *
 * Every value here is already visible on /contact and in the footer — except
 * the hours. Those are the ones the old storefront published; the contact page
 * only says "by appointment". If appointment-only is now the whole truth,
 * delete `openingHoursSpecification` rather than let the markup claim more
 * than the page does.
 */
const STORE = {
  name: 'Gold Custom LA',
  telephone: '+1-323-688-8837',
  email: 'mr10k@goldcustom.com',
  streetAddress: '550 S Hill Street Suite 660',
  addressLocality: 'Los Angeles',
  addressRegion: 'CA',
  postalCode: '90013',
  addressCountry: 'US',
  latitude: '34.04779037759987',
  longitude: '-118.25260717605978',
  sameAs: [
    'https://www.facebook.com/people/Gold-Custom-Los-Angeles/100090201579473/',
    'https://www.instagram.com/goldcustom_la',
    'https://www.youtube.com/@goldcustomla',
    'https://www.tiktok.com/@goldcustomla',
  ],
} as const;

// The three nodes below are emitted together inside a single `@graph` in
// root.tsx, which carries the `@context` for all of them. A bare top-level
// array parses under the spec but several validators only surface its first
// or last member — `@graph` is what the Liquid storefront used and what tools
// reliably read. Do not re-add `@context` here.
export function organizationJsonLd(origin: string): JsonLd {
  return {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: SITE.name,
    url: origin,
    logo: absoluteUrl(origin, '/favicon.png'),
    description: SITE.description,
    sameAs: [...STORE.sameAs],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      telephone: STORE.telephone,
      email: STORE.email,
      availableLanguage: 'English',
    },
  } as JsonLd;
}

/**
 * JewelryStore is a LocalBusiness subtype — this is what puts the shop in the
 * map pack and "jeweler near me" results. It is the one schema the storefront
 * lost in the migration that has nothing to do with the catalogue.
 */
export function localBusinessJsonLd(origin: string): JsonLd {
  return {
    '@type': 'JewelryStore',
    '@id': `${origin}/#localbusiness`,
    name: STORE.name,
    url: origin,
    image: absoluteUrl(origin, '/favicon.png'),
    telephone: STORE.telephone,
    email: STORE.email,
    priceRange: '$$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: STORE.streetAddress,
      addressLocality: STORE.addressLocality,
      addressRegion: STORE.addressRegion,
      postalCode: STORE.postalCode,
      addressCountry: STORE.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: STORE.latitude,
      longitude: STORE.longitude,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        opens: '12:00',
        closes: '17:00',
      },
    ],
    areaServed: {'@type': 'City', name: 'Los Angeles'},
    sameAs: [...STORE.sameAs],
    parentOrganization: {'@id': `${origin}/#organization`},
  } as JsonLd;
}

/**
 * WebSite + SearchAction: tells Google (and AI answer engines) that the store
 * has an internal search endpoint they can deep-link into.
 */
export function websiteJsonLd(origin: string): JsonLd {
  return {
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
