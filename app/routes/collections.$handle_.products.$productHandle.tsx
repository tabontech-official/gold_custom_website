/**
 * `/collections/<collection>/products/<handle>` — the product page.
 *
 * This is the URL shape the Liquid storefront linked products with from every
 * grid and carousel, so it is the shape Google indexed and customers
 * bookmarked. It used to 301 here (on to `/products/<handle>`, which 301'd
 * again to the category path), which put every inbound link from the old site
 * behind a double redirect and threw a shopper browsing a collection out to an
 * unrelated branch of the site mid-session. It now renders.
 *
 * The collection segment is browsing context, not identity: the same product
 * is reachable under every collection it belongs to. `productCanonicalPath`
 * resolves the one indexed URL from the product's own category, so all of
 * those pages agree on a single canonical (see products.$handle.tsx).
 *
 * `$handle_` keeps this out of collections.$handle.tsx's tree — that route has
 * no Outlet, and nesting would run its full collection query for nothing.
 *
 * ponytail: the collection segment is validated for shape but not checked to
 * exist, so /collections/anything/products/<handle> serves the product with a
 * breadcrumb pointing at a collection that 404s. Verifying it would cost a
 * second query on every product view — the hottest page on the store — to
 * defend against a URL nothing links to, and the canonical tag already keeps
 * the invented ones out of the index. Query the collection here if that
 * breadcrumb ever gets clicked in anger.
 */
export {default, loader, meta} from './products.$handle';
