/**
 * Ask the Shopify CDN for a resized copy of an image. Local `/public` files
 * can't be transformed, so they pass through untouched.
 *
 * Collection images arrive as full-resolution originals. Anywhere a plain
 * `<img>` renders one at a known display size, cap it — nine multi-megapixel
 * bitmaps decoded and then 3D-transformed every frame is what made the category
 * carousel stutter on phones. (Hydrogen's `<Image>` does this for itself; this
 * is for the places that take a bare URL string.)
 */
export function cdnWidth(url: string, width: number): string {
  if (!url.includes('cdn.shopify.com')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
}
