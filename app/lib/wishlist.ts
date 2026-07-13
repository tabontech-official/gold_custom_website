import type {HydrogenSession} from '@shopify/hydrogen';

// Wishlist = a list of product handles kept in the signed session cookie.
// ponytail: handles (not IDs) so the /wishlist page can query products
// straight from the storefront with one `nodes(handles:)`-style lookup.
const KEY = 'wishlist';

export function getWishlist(session: HydrogenSession): string[] {
  const value = session.get(KEY);
  return Array.isArray(value)
    ? value.filter((h): h is string => typeof h === 'string')
    : [];
}

/** Toggle a handle in/out of the wishlist. Returns the new list. */
export function toggleWishlist(
  session: HydrogenSession,
  handle: string,
): string[] {
  const current = getWishlist(session);
  const next = current.includes(handle)
    ? current.filter((h) => h !== handle)
    : [...current, handle];
  session.set(KEY, next);
  return next;
}
