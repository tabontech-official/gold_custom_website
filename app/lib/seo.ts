import {getSeoMeta, type SeoConfig} from '@shopify/hydrogen';

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
   * preview for a postage stamp. This one resolves to 1100x619.
   *
   * Stored BARE, with no transform params. `socialImage` adds them, so the
   * fallback goes through exactly the same sizing as every other share image —
   * an already-sized value here got a second `&width=&quality=` appended and
   * shipped a URL with each param twice.
   *
   * Swap this for a purpose-made 1200x630 banner the moment there is one — this
   * is the one string to change.
   */
  ogImage:
    'https://cdn.shopify.com/s/files/1/0806/9568/9464/collections/Gold_Jewelry-1-757994.webp?v=1770959624',
  /** Known size of `ogImage`, so it is never mistaken for a too-small source. */
  ogImageSize: {width: 1100, height: 619},
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
function firstMedia(
  media: SeoConfig['media'],
): {url: string; width?: number | null; height?: number | null} | null {
  for (const item of Array.isArray(media) ? media : [media]) {
    if (typeof item === 'string' && item) return {url: item};
    if (item && typeof item === 'object' && item.url) {
      return {url: item.url, width: item.width, height: item.height};
    }
  }
  return null;
}

const OG_IMAGE_WIDTH = 1200;

/**
 * Smallest image every major platform will still render as a large card. Below
 * this you get a thumbnail, or nothing.
 */
const OG_MIN_WIDTH = 600;
const OG_MIN_HEIGHT = 315;

type ImageSource = {url: string; width?: number | null; height?: number | null};

/**
 * Build the URL a social crawler is sent.
 *
 * `format=jpg` is the important one, and it is why category links showed no
 * image when shared from a phone. Collection images are whatever the merchant
 * uploaded: the Necklaces banner is a PNG, and `?width=1200&quality=70` on a
 * PNG returns a PNG — 1.6 MB of it, because `quality` is a lossy-codec setting
 * and does nothing to lossless output. Facebook and LinkedIn on desktop will
 * happily pull 1.6 MB; WhatsApp and iMessage cap the preview near 300 KB and
 * silently show no image. Forcing JPEG takes that same banner to 161 KB.
 *
 * NOT `cdnWidth`: that helper feeds real page images, where WebP negotiation is
 * a win. Here it would be the bug — `format=jpg` must not leak into the
 * storefront's own <img> tags.
 *
 * No crop. A centre crop to 1.91:1 cuts the ends off a chain, and it buys
 * nothing a crawler cares about: a 1200px square already clears the large-card
 * threshold on every platform.
 */
function socialImageUrl(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${OG_IMAGE_WIDTH}&quality=80&format=jpg`;
}

/** True when a source is too small to render as a large card — and the CDN
 *  cannot help, because it refuses to upscale. */
function tooSmallToShare({width, height}: ImageSource): boolean {
  if (!width || !height) return false; // unknown: give it the benefit of the doubt
  return width < OG_MIN_WIDTH || height < OG_MIN_HEIGHT;
}

function socialImage(media: ImageSource): {
  url: string;
  width?: number;
  height?: number;
} {
  // Absolute, because a relative og:image is the single most reliable way to
  // get a blank preview — a crawler has no page context to resolve it against.
  const absolute = media.url.startsWith('/')
    ? absoluteUrl(SITE.origin, media.url)
    : media.url;
  if (!absolute.includes('cdn.shopify.com')) return {url: absolute};

  const url = socialImageUrl(absolute);
  const {width: sourceWidth, height: sourceHeight} = media;
  // Dimensions are only published when they can be DERIVED, never assumed.
  // The number has to describe the resized copy above, not the master: the
  // Storefront API reports these product images as 3024x3024, but the URL we
  // hand the crawler is capped at 1200. And the cap is a ceiling, not a
  // promise — Shopify's CDN refuses to upscale, so a smaller master comes back
  // at its own size, which is why this takes the min rather than trusting it.
  if (!sourceWidth || !sourceHeight) return {url};
  const width = Math.min(OG_IMAGE_WIDTH, sourceWidth);
  return {url, width, height: Math.round((sourceHeight * width) / sourceWidth)};
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
    /**
     * Emits `og:price:*`. Pass the Storefront API's `price` straight through —
     * its `amount` is already a bare decimal ("2250.00"). Do NOT pass a
     * display-formatted price: the old Liquid storefront published
     * `og:price:amount` as "2,250.00", and the thousands separator makes it
     * unparseable as a number.
     */
    price?: {amount: string; currencyCode: string} | null;
  },
) {
  const {noIndex, ogType = 'website', price, ...seo} = config;

  // Shopify's own SEO titles often already end in the brand ("… | Gold
  // Custom"), and appending the template on top produced the doubled
  // "… | Gold Custom | Gold Custom" that was live on collection pages.
  const title = typeof seo.title === 'string' ? seo.title : '';
  const titleTemplate =
    seo.titleTemplate ??
    (title.trim().toLowerCase().endsWith(SITE.name.toLowerCase())
      ? '%s'
      : `%s | ${SITE.name}`);

  // A source too small to render as a large card is worse than the brand shot:
  // the Rings collection banner is 400x363, and no transform saves it because
  // Shopify's CDN will not upscale. Better a correct brand card than a broken
  // thumbnail. Unknown dimensions pass through — only a measured miss falls back.
  const routeMedia = firstMedia(seo.media);
  const media =
    routeMedia && !tooSmallToShare(routeMedia)
      ? routeMedia
      : {url: SITE.ogImage, ...SITE.ogImageSize};
  const image = socialImage(media);

  const tags =
    getSeoMeta({
      ...seo,
      // Width and height are stripped before `getSeoMeta` sees them. It emits
      // `og:image:<key>` for every truthy key on a media object, so passing the
      // `media` is withheld from getSeoMeta ENTIRELY, and the whole image block
      // is emitted below instead.
      //
      // Open Graph is RDFa: `og:image:url`, `:secure_url`, `:type`, `:width`,
      // `:height` and `:alt` are structured properties of the LAST `og:image`
      // declared above them. Given a media object, getSeoMeta emits
      // `og:image:url`/`:secure_url`/`:type` and never a bare `og:image` — so
      // those three arrived with no parent to attach to, and the real
      // `og:image` we appended landed after them. A lenient parser shrugs; a
      // strict one reads it as two images, or as one image with no source, and
      // a share card with an ambiguous image is a share card with no image.
      //
      // Withholding it also means the dimensions problem cannot come back:
      // getSeoMeta derived width/height from the ORIGINAL file (4284px) while
      // og:image points at a 1200px resize.
      media: undefined,
      titleTemplate,
      ...(noIndex ? {robots: {noIndex: true, noFollow: false}} : {}),
    }) ?? [];

  return [
    ...tags,
    // One image, its properties immediately after it, in spec order. `property`
    // not `name`, because Open Graph is RDFa.
    {property: 'og:image', content: image.url},
    {property: 'og:image:secure_url', content: image.url},
    // Always JPEG: socialImage forces `format=jpg`.
    {property: 'og:image:type', content: 'image/jpeg'},
    // Only when derived — see socialImage. Declaring them lets a platform lay
    // the card out before the image finishes downloading; declaring them WRONG
    // makes it drop the card entirely, so silence beats a guess.
    ...(image.width && image.height
      ? [
          {property: 'og:image:width', content: String(image.width)},
          {property: 'og:image:height', content: String(image.height)},
        ]
      : []),
    {property: 'og:image:alt', content: title || SITE.name},
    {property: 'og:type', content: ogType},
    {property: 'og:site_name', content: SITE.name},
    // Facebook's product extension, carried over from the Liquid storefront.
    ...(price && Number.isFinite(Number(price.amount))
      ? [
          // Two decimals, because the API hands back "440.0" and a price tag
          // reading "440.0" looks like a bug to anyone who sees it. Still a
          // bare decimal — no separator, no symbol — so it stays parseable.
          {
            property: 'og:price:amount',
            content: Number(price.amount).toFixed(2),
          },
          {property: 'og:price:currency', content: price.currencyCode},
        ]
      : []),
    // No card type means X renders no card. `name`, per the Twitter spec.
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:image', content: image.url},
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
