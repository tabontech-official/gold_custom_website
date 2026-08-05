import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {
  ProductItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {buildProductPath, productCanonicalPath} from '~/lib/categories';
import {useWishlistToggle} from '~/hooks/useWishlistToggle';
import {
  AddToCartButton,
  AddedToBagLabel,
} from '~/components/AddToCartButton';
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

  return (
    <article
      className={className ? `product-item ${className}` : 'product-item'}
    >
      <div className="product-image-wrap">
        <Link prefetch="intent" to={productUrl} className="product-image-link">
          {image && (
            <Image
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
          <WishlistButton handle={product.handle} />
        </div>
      </div>

      <div className="product-card-body">
        <Link prefetch="intent" to={productUrl} className="product-item-copy">
          <h4>{product.title}</h4>
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
function WishlistButton({handle}: {handle: string}) {
  const {fetcher, active} = useWishlistToggle(handle);

  return (
    <fetcher.Form method="post" action="/wishlist">
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
