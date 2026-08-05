import {redirect} from 'react-router';
import type {Route} from './+types/products.$category.$subcategory.$handle';

/**
 * `/products/<category>/<subcategory>/<handle>` — the retired three-segment
 * shape. See products.$category.$handle.tsx; the only difference is which
 * segment becomes the collection.
 *
 * The subcategory wins: it is the narrower collection and the one the shopper
 * was actually browsing when this URL was built.
 */
export async function loader({params, request}: Route.LoaderArgs) {
  const {search} = new URL(request.url);
  const collection = encodeURIComponent(params.subcategory);
  const handle = encodeURIComponent(params.handle);
  throw redirect(`/collections/${collection}/products/${handle}${search}`, 301);
}

export default function ProductSubcategoryRedirect() {
  return null;
}
