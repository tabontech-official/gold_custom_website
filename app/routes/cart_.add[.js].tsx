import type {Route} from './+types/cart_.add[.js]';
import {toAjaxCart} from '~/lib/ajaxCart';

/**
 * Shopify's AJAX Cart add endpoint, the write half of the `/cart.js` shim next
 * door. Reputon's TikTok widget adds a tagged variant with a plain
 * `POST /cart/add.js` carrying `id` (numeric variant id) and `quantity`, then
 * re-reads `/cart.js`; without this the popup's Add to Cart button silently
 * fails. See lib/ajaxCart.ts for the response mapping.
 */
export async function action({request, context}: Route.ActionArgs) {
  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  const quantity = Number(formData.get('quantity') ?? 1);

  // The AJAX API speaks numeric variant ids; the Storefront API speaks gids.
  // Anything else is a malformed call, not an empty cart add.
  if (!/^\d+$/.test(id) || !Number.isInteger(quantity) || quantity < 1) {
    return Response.json(
      {status: 422, message: 'Invalid request', description: 'Bad variant id'},
      {status: 422},
    );
  }

  const result = await context.cart.addLines([
    {merchandiseId: `gid://shopify/ProductVariant/${id}`, quantity},
  ]);

  if (result.errors?.length || result.userErrors?.length) {
    return Response.json(
      {
        status: 422,
        message: 'Cart Error',
        description:
          result.userErrors?.[0]?.message ?? 'Could not add to cart',
      },
      {status: 422},
    );
  }

  // Hydrogen mints the cart id on first add — without this header the shopper
  // gets a fresh empty cart on the next request and the add appears to vanish.
  const headers = context.cart.setCartId(result.cart.id);
  headers.set('Cache-Control', 'no-store');

  // `addLines` answers with Hydrogen's minimal mutation fragment — an id and a
  // total quantity, no lines and no cost — so serializing that directly would
  // report `item_count: 1` next to an empty `items` array. Re-read by the id
  // the mutation just returned (the session cookie does not have it yet on a
  // first add) to answer with the whole cart, the way Liquid does.
  const cart = await context.cart.get({cartId: result.cart.id});

  return Response.json(toAjaxCart(cart ?? result.cart), {headers});
}
