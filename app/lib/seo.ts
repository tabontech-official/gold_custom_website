import {getSeoMeta, type SeoConfig, type WithCache} from '@shopify/hydrogen';
// Relative, with the extension: the self-checks beside this file run under
// bare `node`, which resolves neither the `~` alias nor an extensionless
// path. Same convention the test files themselves use.
import {toText} from './description.ts';

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
  /**
   * Kept under ~125 characters. This is the site-wide fallback, so it is what
   * shows on the home page, the root document and any page with no
   * description of its own — and social previews clip around 125 on mobile,
   * which was cutting the warranty clause mid-phrase. The previous wording
   * ran 132.
   */
  description:
    'Shop 10K & 14K gold jewelry, rings, chains and charms. Free US shipping over $99, 14-day returns, 1-year warranty.',
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
  // `toText`, not a whitespace collapse. Callers pass rich text straight from
  // Shopify — this only trimmed spaces, so the live refund and terms policies
  // published descriptions opening with a literal "&nbsp;", and because
  // pageSeo feeds this to getSeoMeta it reached og:description too.
  const text = toText(input ?? '') || fallback;
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

/**
 * Width requested for share images.
 *
 * 600, not the 1200 you would expect, and the reason is a hard CDN limitation:
 * Shopify REFUSES to transcode an image that has an alpha channel. On a
 * transparent PNG, `format=jpg`, `format=webp`, `pad_color` and no format at
 * all return byte-identical PNG. Measured on the Stud Earrings banner, all four
 * came back as the same 1,171,966-byte file.
 *
 * `quality` is equally inert there — it is a lossy-codec setting and PNG is
 * lossless — so pixel count is the ONLY lever left, and WhatsApp drops any
 * preview much past 300 KB. Measured across the three transparent collection
 * banners:
 *
 *              @1200px   @700px   @600px
 *   Rope Br.    ~712 KB   236 KB   172 KB
 *   Clover      ~1.08 MB  377 KB   280 KB
 *   Stud Earr.  ~1.17 MB  399 KB   292 KB
 *
 * 600 is the only width where all three clear the cap, and it is exactly
 * OG_MIN_WIDTH, so the card still renders large rather than as a thumbnail.
 *
 * THAT REASONING STILL HOLDS FOR TRANSPARENT PNGs, and they are still caught —
 * by `resolveShareImage` below, which measures the actual response and drops
 * anything over the cap. What changed is that the width no longer has to be
 * set low enough for the WORST source: an image that cannot transcode now
 * fails the probe and falls back to the brand shot, instead of every image on
 * the site being shrunk to protect three banners.
 *
 * Re-measured on the flat fallback at 1200x630: 119 KB as JPEG, comfortably
 * under the 300 KB cap.
 *
 * THE REAL FIX IS STILL IN SHOPIFY. Re-save those three banners without
 * transparency and they stop falling back. Transparency is wrong for a share
 * image regardless — WhatsApp and Facebook composite alpha onto a background
 * you do not control, often black, which can render gold jewellery nearly
 * invisible even when it fits.
 */
const OG_IMAGE_WIDTH = 1200;

/**
 * 1200x630 is the 1.91:1 card every platform lays out for; anything else gets
 * cropped or letterboxed by them, on their terms.
 *
 * Reached by PADDING, not cropping — `pad_color` fills the leftover edge
 * instead of cutting into the picture, which matters because these are chains
 * and necklaces shot long: a centre crop to 1.91:1 takes the ends off. Padding
 * also makes the output dimensions exact for ANY source shape, which is what
 * fixes the square collection banners that were being published as 600x600.
 *
 * Verified against the CDN: `crop=center` at this size returns the source's
 * own 1100x619 (Shopify refuses to upscale), while `pad_color` returns a true
 * 1200x630. Crop would not have fixed the ratio at all.
 *
 * White to match the storefront's own background, so the pad reads as the page
 * rather than as bars.
 */
const OG_IMAGE_HEIGHT = 630;
const OG_PAD_COLOR = 'fff';

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
 * `format=jpg` rescues every FLAT image: the Necklaces banner is a PNG, and
 * `?width=1200&quality=70` on it returned 1.6 MB of PNG, because `quality` is a
 * lossy-codec setting and does nothing to lossless output. Forcing JPEG took
 * that same banner to 161 KB. Desktop Facebook and LinkedIn will happily pull
 * 1.6 MB; WhatsApp and iMessage cap the preview near 300 KB and show nothing.
 *
 * It is a no-op on TRANSPARENT images — see OG_IMAGE_WIDTH, which is what
 * actually covers those. Both are kept: the format wins on flat images, the
 * width wins on the ones the CDN refuses to transcode.
 *
 * NOT `cdnWidth`: that helper feeds real page images, where WebP negotiation is
 * a win. Here it would be the bug — `format=jpg` must not leak into the
 * storefront's own <img> tags.
 *
 * No crop. A centre crop to 1.91:1 cuts the ends off a chain, and buys nothing
 * a crawler cares about: a square at OG_IMAGE_WIDTH already clears the
 * large-card threshold on every platform.
 */
function socialImageUrl(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${OG_IMAGE_WIDTH}&height=${OG_IMAGE_HEIGHT}&pad_color=${OG_PAD_COLOR}&quality=80&format=jpg`;
}

/**
 * Largest share image WhatsApp will still render. Past roughly this it shows
 * the link with no picture at all.
 */
const OG_MAX_BYTES = 300 * 1024;

/**
 * Decide, by actually asking the CDN, whether a collection image can be used as
 * a share image — and fall back to the brand shot when it cannot.
 *
 * This exists because the URL alone cannot tell you. Shopify refuses to
 * transcode any image carrying an alpha channel: on a transparent PNG,
 * `format=jpg`, `format=webp`, `pad_color` and no format at all return the
 * identical PNG. Measured across the collection banners, the ones that stay PNG
 * land at 261-605 KB even cropped to the bare 600x315 minimum — over WhatsApp's
 * cap, so the preview arrives with no image. Meanwhile plenty of other PNGs
 * here are flat and transcode to a 43 KB JPEG, so the file extension is not a
 * usable signal either. The only reliable test is the response itself.
 *
 * One request per collection per cache period, and it is a loader-side check
 * because a `meta` function cannot await anything.
 *
 * Delete this the day those images are re-saved without transparency — see
 * OG_IMAGE_WIDTH.
 */
export async function resolveShareImage(
  withCache: WithCache,
  imageUrl?: string | null,
): Promise<string | null> {
  if (!imageUrl) return null;
  const candidate = socialImageUrl(
    imageUrl.startsWith('/') ? absoluteUrl(SITE.origin, imageUrl) : imageUrl,
  );

  try {
    const {response} = await withCache.fetch<null>(
      candidate,
      // `Accept: */*` on purpose: it is what WhatsApp and Facebook send, so
      // this measures the exact bytes they will be served. Asking with a
      // browser's Accept would get WebP back and quietly pass an image the
      // crawlers still cannot use.
      {method: 'GET', headers: {Accept: '*/*'}},
      {
        displayName: 'share image probe',
        cacheKey: ['share-image', candidate],
        shouldCacheResponse: () => true,
      },
    );

    const type = response.headers.get('content-type') ?? '';
    const length = Number(response.headers.get('content-length') ?? '0');
    // Byte count is the gate; format gets no say. This was an OR —
    // `type.includes('jpeg') || under cap` — so ANY response that came back
    // JPEG passed no matter how heavy, which is the one thing the cap exists to
    // stop. A PNG that fits is perfectly usable: WhatsApp renders PNG, it is the
    // size it refuses. Content-length is always set by the Shopify CDN; if it
    // ever is not, fall back to "is this an image at all" rather than dropping a
    // collection's banner over a missing header.
    const usable =
      length > 0 ? length < OG_MAX_BYTES : type.startsWith('image/');
    // The RAW url is returned, never `candidate`. pageSeo runs every image
    // through socialImageUrl itself, so handing back the transformed one would
    // append `&width=&quality=&format=` a second time — the same duplicated
    // params the bare SITE.ogImage constant was fixed for. Probing the
    // transformed URL and publishing the raw one is safe precisely because
    // both sides derive it the same way.
    return usable ? imageUrl : null;
  } catch {
    // A probe failure must never take a page down, and must never silently
    // publish an image we could not verify.
    return null;
  }
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
  // Fixed, not derived from the master. This used to scale the source's own
  // dimensions and take a min, because the CDN refuses to upscale and a small
  // master came back at its own size — publishing a number the file did not
  // match. Padding removes that whole class of problem: every CDN image comes
  // back in exactly this box whatever shape it started, so these are facts.
  return {url, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT};
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
    // NO `og:image:type`. It used to be hardcoded `image/jpeg` on the reasoning
    // that socialImage forces `format=jpg` — but that is exactly the CDN call
    // `format=jpg` does NOT win (see OG_IMAGE_WIDTH). Any source with an alpha
    // channel comes back as unchanged PNG, and most of this store's jewellery
    // is shot on transparency, so the tag was declaring a MIME type that
    // contradicted the bytes served: measured live, 28 of 125 collection pages
    // and the product pages served `image/png` under a JPEG declaration.
    //
    // That single mismatch is the whole "works everywhere except Meta apps"
    // report. Twitter, Slack, Discord and iMessage sniff the response and never
    // read this tag, so they rendered the card fine; Meta's scraper trusts the
    // declared type and drops an image whose bytes disagree with it — WhatsApp
    // then falls all the way back to showing the bare domain.
    //
    // The tag is optional in Open Graph and a crawler that does not get it
    // sniffs the bytes, which is the path already proven to work here. Omitting
    // it is therefore strictly safer than guessing, and it cannot rot the way a
    // hardcoded constant did. Publish one again ONLY if it is the
    // content-type actually measured off the response — never a derived guess.
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
    // Was /favicon.png — a 150x134 icon. Google shows this image in the local
    // knowledge panel and map pack, and rejects anything that small, so the
    // business was effectively publishing no photo. SITE.ogImage is a
    // known-good 1100x619 already declared in this file. Replace with a real
    // photograph of the storefront when there is one; that is what this field
    // is meant to be.
    image: SITE.ogImage,
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
