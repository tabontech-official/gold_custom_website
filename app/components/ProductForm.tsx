import type {CSSProperties, ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {useLocation, Link} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';

const MAX_QUANTITY = 10; // ponytail: fixed ceiling, no per-product stock-aware max yet

export function ProductForm({
  productOptions,
  selectedVariant,
  wishlistButton,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  wishlistButton?: ReactNode;
}) {
  const {pathname} = useLocation();
  const {open} = useAside();
  const [quantity, setQuantity] = useState(1);

  // Reset to 1 whenever the shopper switches variant, so a leftover quantity
  // from a sold-out/different variant never silently carries over.
  useEffect(() => setQuantity(1), [selectedVariant?.id]);

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        // Don't render a picker for an option that has only one value.
        if (option.optionValues.length === 1) return null;

        return (
          <div className="product-options" key={option.name}>
            <span
              className="product-options-label"
              id={`option-label-${option.name}`}
            >
              {option.name}
            </span>
            <div
              className="variant-tags"
              role="group"
              aria-labelledby={`option-label-${option.name}`}
            >
              {option.optionValues.map((value) => {
                const className = `variant-tag${value.selected ? ' is-selected' : ''}${
                  !value.available ? ' is-unavailable' : ''
                }`;
                const style = getVariantTagStyle(option.name, value.name);

                // Disabled (no matching variant at all) can't be a link.
                if (!value.exists && !value.isDifferentProduct) {
                  return (
                    <button
                      key={option.name + value.name}
                      type="button"
                      className={className}
                      style={style}
                      aria-pressed={value.selected}
                      disabled
                    >
                      {value.name}
                    </button>
                  );
                }

                // A value that maps to a different product (combined
                // listing) takes the shopper straight to that product page;
                // otherwise it just swaps the variant search param in place.
                // Both are real links (not onClick+navigate) so Hydrogen can
                // prefetch the target on hover/touch instead of only
                // starting the fetch after the click.
                const to = value.isDifferentProduct
                  ? `${replaceProductHandleInPath(pathname, value.handle)}?${value.variantUriQuery}`
                  : `?${value.variantUriQuery}`;

                return (
                  <Link
                    key={option.name + value.name}
                    className={className}
                    style={style}
                    aria-pressed={value.selected}
                    prefetch="intent"
                    preventScrollReset
                    replace={!value.isDifferentProduct}
                    to={value.selected ? '#' : to}
                    onClick={(event) => {
                      if (value.selected) event.preventDefault();
                    }}
                  >
                    {value.name}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="product-purchase-grid">
        <div className="product-buy-row">
          {selectedVariant?.availableForSale && (
            <div
              className="product-quantity-stepper"
              role="group"
              aria-label="Quantity"
            >
              <button
                type="button"
                className="product-quantity-btn"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                &minus;
              </button>
              <span className="product-quantity-value">{quantity}</span>
              <button
                type="button"
                className="product-quantity-btn"
                aria-label="Increase quantity"
                disabled={quantity >= MAX_QUANTITY}
                onClick={() =>
                  setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))
                }
              >
                +
              </button>
            </div>
          )}
          <AddToCartButton
            className="btn product-atc product-purchase-action"
            disabled={!selectedVariant || !selectedVariant.availableForSale}
            onClick={() => {
              open('cart');
            }}
            lines={
              selectedVariant
                ? [
                    {
                      merchandiseId: selectedVariant.id,
                      quantity,
                      selectedVariant,
                    },
                  ]
                : []
            }
          >
            {selectedVariant?.availableForSale ? 'Add to bag' : 'Sold out'}
          </AddToCartButton>
          {wishlistButton}
        </div>
      </div>

      <p className="product-finance-note">
        <Link to="/policies/finance">Flexible payment plans</Link> and
        installment options are available before checkout.
      </p>
    </div>
  );
}

function replaceProductHandleInPath(pathname: string, handle?: string | null) {
  if (!handle) return pathname;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'products') return `/products/${handle}`;
  return `/${[...parts.slice(0, -1), handle].map(encodeURIComponent).join('/')}`;
}

function getVariantTagStyle(optionName: string, valueName: string) {
  if (!/color|metal|finish/i.test(optionName)) return undefined;

  const value = valueName.toLowerCase();
  if (value.includes('yellow')) {
    return {'--variant-bg': '#f7d672'} as CSSProperties;
  }
  if (value.includes('white')) {
    return {'--variant-bg': '#d9d9d9'} as CSSProperties;
  }
  if (value.includes('rose')) {
    return {'--variant-bg': '#f0aaaa'} as CSSProperties;
  }
  if (value.includes('black')) {
    return {
      '--variant-bg': '#111111',
      '--variant-fg': '#ffffff',
    } as CSSProperties;
  }

  return undefined;
}
