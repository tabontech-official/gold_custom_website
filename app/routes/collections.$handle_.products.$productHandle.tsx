import {redirect} from 'react-router';
import type {Route} from './+types/collections.$handle_.products.$productHandle';

/**
 * Shopify's nested product URL, `/collections/<collection>/products/<handle>`.
 *
 * Liquid themes link products this way from every grid and carousel, so the
 * old storefront had these indexed alongside the flat form. Hydrogen has no
 * such route and answered 404, stranding whatever Google still holds.
 *
 * The collection segment is dropped rather than mapped onto the hierarchical
 * path: the category in the canonical URL comes from the product's own
 * category match, not from whichever collection it was browsed through, and
 * those disagree often enough that guessing here would send some products to
 * a second redirect anyway. `/products/<handle>` then 301s on to the
 * canonical path, so both hops are permanent and Google consolidates.
 *
 * `$handle_` keeps this out of collections.$handle.tsx's tree — that route has
 * no Outlet, and nesting would run its full collection query for nothing.
 */
export async function loader({params, request}: Route.LoaderArgs) {
  const {search} = new URL(request.url);
  throw redirect(`/products/${params.productHandle}${search}`, 301);
}

export default function CollectionProductRedirect() {
  return null;
}
