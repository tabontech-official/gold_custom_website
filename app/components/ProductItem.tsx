import {Link, useFetcher, useRouteLoaderData} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {RootLoader} from '~/root';
import type {
  ProductItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.5l-1.45-1.32C5.4 14.36 2 11.28 2 7.5 2 5.5 3.5 4 5.5 4c1.54 0 3.04.99 3.57 2.36h1.87C11.46 4.99 12.96 4 14.5 4 16.5 4 18 5.5 18 7.5c0 3.78-3.4 6.86-8.55 11.68L12 20.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6h15l-1.5 9h-12L6 6zm0 0L5.2 3H2m6 17a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProductItem({
  product,
  loading,
  className,
}: {
  product:
    | ProductItemFragment
    | RecommendedProductFragment
    | any;
  loading?: 'eager' | 'lazy';
  className?: string;
}) {
  const {open} = useAside();
  const productUrl = `/products/${product.handle}`;
  const wished = useIsWishlisted(product.handle);
  const image = product.featuredImage;
  const firstVariant =
    product.selectedOrFirstAvailableVariant ?? product.variants?.nodes?.[0];
  const variantId = firstVariant?.id;
  const availableForSale = firstVariant?.availableForSale ?? true;

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
              sizes="(min-width: 45em) 400px, 100vw"
            />
          )}
        </Link>
      </div>

      <div className="product-card-body">
        <Link prefetch="intent" to={productUrl} className="product-item-copy">
          <h4>{product.title}</h4>
        </Link>

        <div className="product-card-actions">
          <WishlistButton handle={product.handle} wished={wished} />

          <div className="product-card-price">
            <Money data={product.priceRange.minVariantPrice} />
          </div>

          {variantId ? (
            <AddToCartButton
              className="product-cart-btn"
              disabled={!availableForSale}
              onClick={() => open('cart')}
              lines={[{merchandiseId: variantId, quantity: 1}]}
            >
              <CartIcon />
            </AddToCartButton>
          ) : (
            <Link
              to={productUrl}
              className="product-cart-btn"
              aria-label="View product"
            >
              <CartIcon />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Is this handle saved? Reads the wishlist from the root loader. */
function useIsWishlisted(handle: string): boolean {
  const root = useRouteLoaderData<RootLoader>('root');
  return (root?.wishlist ?? []).includes(handle);
}

// Heart toggle. Posts to /wishlist and flips optimistically while the request
// is in flight so the shopper never waits on the server. Root revalidates on
// the POST, so the header count and every other card stay in sync.
function WishlistButton({handle, wished}: {handle: string; wished: boolean}) {
  const fetcher = useFetcher();
  const active = fetcher.state === 'idle' ? wished : !wished;

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
