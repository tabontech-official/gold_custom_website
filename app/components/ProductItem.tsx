import {useState} from 'react';
import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
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
  const [wished, setWished] = useState(false);
  const {open} = useAside();
  const productUrl = `/products/${product.handle}`;
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
              loading={loading}
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
          <button
            type="button"
            className={`product-wishlist ${wished ? 'is-active' : ''}`}
            aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={wished}
            onClick={() => setWished((value) => !value)}
          >
            <HeartIcon />
          </button>

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
