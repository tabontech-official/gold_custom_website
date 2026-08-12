import {Link} from 'react-router';
import {Image, Money, useAnalytics} from '@shopify/hydrogen';
import {cdnLoader} from '~/lib/cdnImage';
import {analyticsProduct, type AnalyticsProductNode} from '~/lib/analytics';
import type {
  ProductItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {buildProductPath, productCanonicalPath} from '~/lib/categories';
import {useWishlistToggle} from '~/hooks/useWishlistToggle';
import {AddToCartButton, AddedToBagLabel} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProductItem({
  product,
  loading,
  className,
  collectionHandle,
  showQuickAdd = false,
  sizes = '(min-width: 45em) 400px, calc(100vw - 3rem)',
}: {
  product: ProductItemFragment | RecommendedProductFragment | any;
  loading?: 'eager' | 'lazy';
  className?: string;
  /**
   * How wide this card actually renders. The default describes the grid
   * (`--grid-item-width`, minus `body > main`'s 1.5rem side margins).
   *
   * Rails and sliders MUST override it: their cards top out at 240–340px, so
   * the grid's `100vw` had them pulling an ~800px image into a 240px box —
   * roughly ten times the pixels needed, times every card on screen.
   */
  sizes?: string;
  /**
   * The collection this card is being shown in, if any. Set, the card links
   * into that collection so the shopper stays where they are browsing; unset
   * (sliders, search, wishlist) the flat path redirects to the canonical URL.
   */
  collectionHandle?: string;
  /** Wishlist cards can add their first available variant without leaving the page. */
  showQuickAdd?: boolean;
}) {
  // Without a collection to stay inside, link straight at the canonical URL
  // instead of the flat path — otherwise every card outside a collection grid
  // costs the shopper a redirect on click. `productCanonicalPath` returns that
  // flat path anyway when the card's query didn't ask for category, so a
  // fragment missing those fields degrades to the old behaviour rather than
  // producing a broken link.
  const productUrl = collectionHandle
    ? buildProductPath(collectionHandle, product.handle)
    : productCanonicalPath(product);
  const image = product.featuredImage;

  const {publish} = useAnalytics();

  /**
   * GA4 pairs `select_item` with the `view_item_list` the collection route
   * sends, which is what turns a grid into a list-performance report: which
   * collection a shopper clicked from, and in what position. The list name has
   * to match on both sides, so both use the collection handle — a card outside
   * any collection (search, wishlist, a rail) reports the surface it sits on
   * instead of pretending to belong to one.
   */
  const listId = collectionHandle ?? 'other';
  const trackSelect = () =>
    publish('custom_ga4', {
      event: 'select_item',
      params: {item_list_id: listId, item_list_name: listId},
      products: [analyticsProduct(product)],
    });

  return (
    <article
      className={className ? `product-item ${className}` : 'product-item'}
    >
      <div className="product-image-wrap">
        <Link
          prefetch="intent"
          to={productUrl}
          className="product-image-link"
          onClick={trackSelect}
        >
          {image && (
            <Image
              loader={cdnLoader}
              alt={image.altText || product.title}
              aspectRatio="1/1"
              data={image}
              className="product-image"
              loading={loading ?? 'lazy'}
              sizes={sizes}
            />
          )}
        </Link>

        {/* Heart sits top-right over the image, always visible. */}
        <div className="product-wishlist-control">
          <WishlistButton handle={product.handle} product={product} />
        </div>
      </div>

      <div className="product-card-body">
        {/* h3, not h4. Every grid and rail that renders these cards sits under
            an h2 section heading, so h4 skipped a level and broke the document
            outline — an agent walking the tree sees a gap where a section
            should be. The two places that had a bare h1 above the grid
            (collections, wishlist) now carry a visually-hidden h2, which also
            gives those regions a name worth navigating to. */}
        <Link
          prefetch="intent"
          to={productUrl}
          className="product-item-copy"
          onClick={trackSelect}
        >
          <h3>{product.title}</h3>
        </Link>
        <div className="product-card-price">
          <Money data={product.priceRange.minVariantPrice} />
        </div>
      </div>
      {showQuickAdd && <WishlistQuickAdd product={product} />}
    </article>
  );
}

function WishlistQuickAdd({product}: {product: any}) {
  const {open} = useAside();
  const variant = product.selectedOrFirstAvailableVariant;

  if (!variant) return null;

  return (
    <AddToCartButton
      className="wishlist-quick-add"
      disabled={!variant.availableForSale}
      lines={[
        {
          merchandiseId: variant.id,
          quantity: 1,
          selectedVariant: variant,
        },
      ]}
      onClick={() => open('cart')}
      addedChildren={<AddedToBagLabel />}
    >
      {variant.availableForSale ? 'Add to bag →' : 'Sold out'}
    </AddToCartButton>
  );
}

// Heart toggle. Posts to /wishlist and flips optimistically while the request
// is in flight so the shopper never waits on the server. Root revalidates on
// the POST, so the header count and every other card stay in sync.
function WishlistButton({
  handle,
  product,
}: {
  handle: string;
  product?: AnalyticsProductNode;
}) {
  const {fetcher, active} = useWishlistToggle(handle);
  const {publish} = useAnalytics();

  /**
   * Only the add half is reported. `active` is the pre-click state whenever the
   * fetcher is idle, so a click while it is false is an add — and GA4 has an
   * `add_to_wishlist` but no removal counterpart, so a de-select is simply not
   * an event either tool models.
   */
  const trackWishlistAdd = () => {
    if (active || !product) return;
    publish('custom_ga4', {
      event: 'add_to_wishlist',
      products: [analyticsProduct(product)],
      metaEvent: 'AddToWishlist',
    });
  };

  // `role="presentation"` strips the form landmark, not the button. A page
  // showing nine cards was publishing nine anonymous `form` regions into the
  // accessibility tree — an agent scanning landmarks got a wall of
  // indistinguishable "form" entries and no way to tell them apart. There is
  // nothing here to navigate to: the whole form is one toggle, and that button
  // keeps its own label and `aria-pressed`.
  return (
    <fetcher.Form
      method="post"
      action="/wishlist"
      role="presentation"
      onSubmit={trackWishlistAdd}
    >
      <input type="hidden" name="handle" value={handle} />
      <button
        type="submit"
        className={`product-wishlist ${active ? 'is-active' : ''}`}
        aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={active}
      >
        <HeartIcon />
      </button>
    </fetcher.Form>
  );
}
