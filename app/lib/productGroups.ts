/**
 * Collapses products sharing a `custom.group_name` metafield to one card.
 *
 * Shopify has no way to group a product connection by a metafield, so this
 * runs on the fetched list, after Shopify's own filtering and sorting. The
 * first product of each group in that order is the one kept; everything else
 * keeps its position. Products with no group name (null, empty, whitespace)
 * are never grouped with each other.
 *
 * Group names compare trimmed and case-insensitively: "FB-03", " fb-03 " and
 * "Fb-03" are one group.
 *
 * Queries alias the metafield as `groupName`:
 *   groupName: metafield(namespace: "custom", key: "group_name") { value }
 */
type Groupable = {groupName?: {value?: string | null} | null};

/** The normalized group, or '' for a product that belongs to none. */
export function productGroupKey(product: Groupable | null | undefined) {
  return product?.groupName?.value?.trim().toLowerCase() ?? '';
}

/**
 * `alreadyShown` seeds the groups that are taken before the list starts — the
 * product a PDP is about, so its rail never recommends another version of it.
 */
export function groupProducts<T extends Groupable>(
  products: T[],
  alreadyShown: Groupable[] = [],
): T[] {
  const seen = new Set(alreadyShown.map(productGroupKey).filter(Boolean));
  return products.filter((product) => {
    const key = productGroupKey(product);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
