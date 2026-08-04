import {redirect} from 'react-router';
import type {Route} from './+types/collections.$handle_.$tag';

/**
 * Shopify's tag-filtered collection URL, `/collections/<handle>/<tag>`.
 *
 * The old storefront served these as real filtered pages, so they carry inbound
 * links and index presence; Hydrogen has no tag routing and answered 404.
 *
 * The tag is dropped and the visitor lands on the unfiltered collection, which
 * holds a superset of what the tag page showed — the products are all still
 * there, just not pre-filtered. Better than a dead end, and 301 so the ranking
 * consolidates onto the collection rather than sitting on a URL we cannot
 * reproduce.
 *
 * This also catches the bare `/collections/<handle>/products`, which lands on
 * the same collection. Harmless: nothing links there without a product handle.
 */
export async function loader({params, request}: Route.LoaderArgs) {
  const {search} = new URL(request.url);
  throw redirect(`/collections/${params.handle}${search}`, 301);
}

export default function CollectionTagRedirect() {
  return null;
}
