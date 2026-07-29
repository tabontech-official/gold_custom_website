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
  logo: 'https://goldcustom.com/favicon.svg',
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
 * Trim to a sane meta-description length. Google truncates around 155-160
 * chars; we cut on a word boundary so it doesn't end mid-word.
 */
export function metaDescription(
  input?: string | null,
  fallback: string = SITE.description,
): string {
  const text = (input ?? '').replace(/\s+/g, ' ').trim() || fallback;
  if (text.length <= 160) return text;
  return text.slice(0, 157).replace(/\s+\S*$/, '') + '…';
}

/**
 * Wrapper around `getSeoMeta` that applies the sitewide defaults.
 *
 * React Router replaces a parent's meta with the child's rather than merging,
 * so the root `titleTemplate` does NOT carry into routes that export their own
 * `meta`. Every route therefore has to restate it — this does that in one
 * place, and normalises `getSeoMeta`'s `| undefined` return to an array.
 */
export function pageSeo(
  config: Omit<SeoConfig, 'titleTemplate'> & {noIndex?: boolean},
) {
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
    logo: absoluteUrl(origin, '/favicon.svg'),
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
