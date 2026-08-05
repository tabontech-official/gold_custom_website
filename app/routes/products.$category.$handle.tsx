import {redirect} from 'react-router';
import type {Route} from './+types/products.$category.$handle';

/**
 * `/products/<category>/<handle>` — the shape this storefront used before
 * product URLs moved back under `/collections/<collection>/products/<handle>`.
 *
 * The category segment is already the collection handle, so the destination is
 * built from the path alone: no product query, no second hop. Where that
 * category disagrees with the product's own, the destination page names the
 * right canonical anyway, so the disagreement costs nothing.
 *
 * 301 — this shape is retired, and a temporary redirect would leave Google
 * crawling it forever instead of consolidating onto the real URL.
 */
export async function loader({params, request}: Route.LoaderArgs) {
  const {search} = new URL(request.url);
  const category = encodeURIComponent(params.category);
  const handle = encodeURIComponent(params.handle);
  throw redirect(`/collections/${category}/products/${handle}${search}`, 301);
}

export default function ProductCategoryRedirect() {
  return null;
}
