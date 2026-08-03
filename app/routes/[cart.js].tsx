import type {Route} from './+types/[cart.js]';
import {toAjaxCart} from '~/lib/ajaxCart';

/**
 * Shopify's AJAX Cart API endpoint, which Liquid storefronts serve and Hydrogen
 * does not. Scripts written for a Shopify theme read it to see the shopper's
 * bag — Tidio's chat polls it so support agents can see the cart mid-conversation
 * — and 404 on every page without it. See lib/ajaxCart.ts for the mapping.
 */
export async function loader({context}: Route.LoaderArgs) {
  const cart = await context.cart.get();

  return Response.json(toAjaxCart(cart), {
    headers: {
      // Per-visitor, and it changes the moment the bag does.
      'Cache-Control': 'no-store',
    },
  });
}
