/**
 * Shopify CDN image URLs.
 *
 * Two things are asked for here, and both are asked for everywhere:
 *
 * `width`, because collection images arrive as full-resolution originals and
 * anywhere a plain `<img>` renders one at a known display size it has to be
 * capped — nine multi-megapixel bitmaps decoded and then 3D-transformed every
 * frame is what made the category carousel stutter on phones.
 *
 * `quality`, because the CDN's own default lands around q85, which on a
 * photograph is well past what anyone can see and is roughly twice the bytes.
 * Measured against this store's own files:
 *
 *   800px product shot   123 KB -> 66 KB
 *   400px gallery thumb   35 KB -> 18 KB  (and flips JPEG output to WebP)
 *   152px header logo     12 KB ->  9 KB
 *   200px partner logo   9.5 KB -> 7.8 KB (AVIF)
 *
 * On a Slow-4G product page the image bytes are the LCP, so this is the single
 * largest lever on the page.
 *
 * ponytail: one number, judged by eye against gold-on-white jewellery, which
 * is the hardest case here — fine engraved lettering on a bright field. Move it
 * if the pieces start to look mushy on a retina phone.
 */
const CDN_QUALITY = 70;

/**
 * Ask the Shopify CDN for a resized copy of an image. Local `/public` files
 * can't be transformed, so they pass through untouched.
 *
 * For bare `<img>` tags that take a URL string. Hydrogen's `<Image>` builds its
 * own URLs — give that `loader={cdnLoader}` instead.
 */
export function cdnWidth(url: string, width: number): string {
  if (!url.includes('cdn.shopify.com')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${width}&quality=${CDN_QUALITY}`;
}

/** Matches Hydrogen's `Loader` — not re-exported from `@shopify/hydrogen`. */
type LoaderParams = {
  src?: string;
  width?: number;
  height?: number;
  crop?: 'center' | 'top' | 'bottom' | 'left' | 'right';
};

/**
 * Hydrogen's `<Image>` builds every srcset entry through a `loader`, and its
 * built-in one never asks for a quality — so every `<Image>` on the site ships
 * the CDN default. This is that loader with `quality` added.
 *
 * Pass it explicitly: `loader={cdnLoader}`. Hydrogen has no global default to
 * override, so a new `<Image>` that forgets it silently doubles its own bytes.
 * The placeholder origin is Hydrogen's own trick for running relative and
 * absolute srcs through `URL` alike, and is stripped back off.
 */
export function cdnLoader({src, width, height, crop}: LoaderParams): string {
  if (!src) return '';
  const PLACEHOLDER = 'https://placeholder.shopify.com';
  const url = new URL(src, PLACEHOLDER);
  if (width) url.searchParams.append('width', String(Math.round(width)));
  if (height) url.searchParams.append('height', String(Math.round(height)));
  if (crop) url.searchParams.append('crop', crop);
  url.searchParams.append('quality', String(CDN_QUALITY));
  return url.href.replace(PLACEHOLDER, '');
}
