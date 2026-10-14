/**
 * Refuses any cart line whose variant is priced <= 0, or that the Storefront
 * API won't return (draft, unpublished from this channel, or a bad id). The
 * price is re-read here, never taken from the client — orders #1010/#1011 were
 * $0.00 lines.
 *
 * ponytail: covers every cart write that goes through context.cart (/cart,
 * /cart/add.js, /cart/<id>:<qty>). It cannot cover a direct Storefront API
 * cartCreate or the old Online Store theme; variant data and Flow cover those.
 */
const VARIANT_PRICES = `#graphql
  query ZeroPriceGuard($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        price {
          amount
        }
      }
    }
  }
` as const;

const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;

type Line = {merchandiseId?: string | null} | null | undefined;
type Storefront = {
  query: (q: string, o: {variables: {ids: string[]}; cache: unknown}) => Promise<any>;
  CacheNone: () => unknown;
};

/** The merchandise ids in `lines` that must not be sold. */
export async function unpricedVariants(storefront: Storefront, lines: Line[] = []) {
  const ids = [
    ...new Set(lines.map((l) => l?.merchandiseId).filter(Boolean) as string[]),
  ];
  const valid = ids.filter((id) => VARIANT_GID.test(id));
  if (!valid.length) return ids;

  const {nodes} = await storefront.query(VARIANT_PRICES, {
    variables: {ids: valid},
    cache: storefront.CacheNone(),
  });
  const priced = new Set(
    (nodes ?? [])
      .filter((n: any) => Number(n?.price?.amount) > 0)
      .map((n: any) => n.id),
  );
  return ids.filter((id) => !priced.has(id));
}

function refused(ids: string[]) {
  console.warn('zero-price guard refused', ids);
  const userErrors = [
    {code: 'INVALID', field: ['lines'], message: 'This item is not available for purchase.'},
  ];
  return {cart: null as any, errors: userErrors, userErrors};
}

/** Wraps every line-writing cart method, so no route can skip the check. */
export function guardZeroPrice(cart: any, storefront: Storefront) {
  const {addLines, updateLines, create} = cart;
  cart.addLines = async (lines: Line[], opts?: unknown) => {
    const bad = await unpricedVariants(storefront, lines);
    return bad.length ? refused(bad) : addLines(lines, opts);
  };
  // Only lines that set merchandiseId are checked; quantity changes pass.
  cart.updateLines = async (lines: Line[], opts?: unknown) => {
    const bad = await unpricedVariants(storefront, lines);
    return bad.length ? refused(bad) : updateLines(lines, opts);
  };
  cart.create = async (input: {lines?: Line[]}, opts?: unknown) => {
    const bad = await unpricedVariants(storefront, input?.lines);
    return bad.length ? refused(bad) : create(input, opts);
  };
}
