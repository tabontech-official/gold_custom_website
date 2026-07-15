import type {CSSProperties, ReactNode} from 'react';
import {useLocation, useNavigate, Link} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';

export function ProductForm({
  productOptions,
  selectedVariant,
  wishlistButton,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  wishlistButton?: ReactNode;
}) {
  const navigate = useNavigate();
  const {pathname} = useLocation();
  const {open} = useAside();

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
              {option.optionValues.map((value) => (
                <button
                  key={option.name + value.name}
                  type="button"
                  className={`variant-tag${value.selected ? ' is-selected' : ''}${
                    !value.available ? ' is-unavailable' : ''
                  }`}
                  style={getVariantTagStyle(option.name, value.name)}
                  aria-pressed={value.selected}
                  disabled={!value.exists && !value.isDifferentProduct}
                  onClick={() => {
                    if (value.selected) return;

                    // A value that maps to a different product (combined
                    // listing) takes the shopper straight to that product
                    // page; otherwise we just update the variant search
                    // param in place.
                    if (value.isDifferentProduct) {
                      const nextPath = replaceProductHandleInPath(
                        pathname,
                        value.handle,
                      );
                      void navigate(
                        `${nextPath}?${value.variantUriQuery}`,
                        {preventScrollReset: true},
                      );
                    } else {
                      void navigate(`?${value.variantUriQuery}`, {
                        replace: true,
                        preventScrollReset: true,
                      });
                    }
                  }}
                >
                  {value.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="product-purchase-grid">
        <div className="product-buy-row">
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
                      quantity: 1,
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
