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
  collectionContext,
}: {
  product:
    | ProductItemFragment
    | RecommendedProductFragment
    | any;
  loading?: 'eager' | 'lazy';
  className?: string;
  collectionContext?: {
    categoryLabel?: string;
    categoryHandle?: string;
    subcategoryLabel?: string;
    subcategoryHandle?: string;
  };
}) {
  const {open} = useAside();
  const productUrl = buildProductUrl(product.handle, collectionContext);
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

        {/* Heart sits top-right over the image, always visible. */}
        <WishlistButton handle={product.handle} wished={wished} />
      </div>

      <div className="product-card-body">
        <Link prefetch="intent" to={productUrl} className="product-item-copy">
          <h4>{product.title}</h4>
        </Link>
        <div className="product-card-price">
          <Money data={product.priceRange.minVariantPrice} />
        </div>
        {/* Edgy black bar, revealed on hover (always visible on touch). */}
        {variantId ? (
          <AddToCartButton
            className="btn product-card-atc"
            disabled={!availableForSale}
            onClick={() => open('cart')}
            lines={[{merchandiseId: variantId, quantity: 1}]}
          >
            {availableForSale ? 'Add to bag' : 'Sold out'}
          </AddToCartButton>
        ) : (
          <Link to={productUrl} className="btn product-card-atc">
            View product
          </Link>
        )}
      </div>
    </article>
  );
}

function buildProductUrl(
  handle: string,
  context?: {
    categoryLabel?: string;
    categoryHandle?: string;
    subcategoryLabel?: string;
    subcategoryHandle?: string;
  },
) {
  if (!context?.categoryHandle) return `/products/${handle}`;
  const segments = ['products', context.categoryHandle];
  if (context.subcategoryHandle) segments.push(context.subcategoryHandle);
  segments.push(handle);
  return `/${segments.map(encodeURIComponent).join('/')}`;
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
