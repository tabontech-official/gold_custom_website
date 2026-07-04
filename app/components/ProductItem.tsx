import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useState} from 'react';
import type {
  ProductItemFragment,
  CollectionItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {AddToCartButton} from './AddToCartButton';

export function ProductItem({
  product,
  loading,
  className,
}: {
  product:
    | CollectionItemFragment
    | ProductItemFragment
    | RecommendedProductFragment
    | any;
  loading?: 'eager' | 'lazy';
  className?: string;
}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  const [imageLoaded, setImageLoaded] = useState(false);
  const firstVariant = product.selectedOrFirstAvailableVariant ?? product.variants?.nodes?.[0];
  const variantId = firstVariant?.id;
  const availableForSale = firstVariant?.availableForSale ?? true;

  return (
    <article className={className ? `product-item ${className}` : 'product-item'}>
      <div className="product-image-wrap">
        <Link prefetch="intent" to={variantUrl} className="product-image-link">
          {!imageLoaded && <span className="product-image-skeleton" aria-hidden="true" />}
          {image && (
            <Image
              alt={image.altText || product.title}
              aspectRatio="1/1"
              data={image}
              className={imageLoaded ? 'is-loaded' : 'is-loading'}
              loading={loading}
              onLoad={() => setImageLoaded(true)}
              sizes="(min-width: 45em) 400px, 100vw"
            />
          )}
        </Link>
      </div>

      <div className="product-card-body">
        <Link prefetch="intent" to={variantUrl} className="product-item-copy">
          <h4>{product.title}</h4>
          <small>
            <Money data={product.priceRange.minVariantPrice} />
          </small>
        </Link>

      </div>
    </article>
  );
}
