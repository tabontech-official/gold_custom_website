import type {ReactNode} from 'react';
import {useLocation, useNavigate, Link} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import {AddToCartButton} from './AddToCartButton';
import {AppointmentModal} from './AppointmentModal';
import {useAside} from './Aside';
import {PremiumSelect, type PremiumSelectOption} from './PremiumSelect';
import type {ProductFragment} from 'storefrontapi.generated';

export type VariantGroupSelect = {
  label: string;
  options: Array<{
    handle: string;
    name: string;
    available: boolean;
    selected: boolean;
  }>;
};

export function ProductForm({
  productOptions,
  selectedVariant,
  wishlistButton,
  variantGroup,
  product,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  wishlistButton?: ReactNode;
  variantGroup?: VariantGroupSelect | null;
  product: {id: string; title: string; handle: string};
}) {
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const {open} = useAside();

  // Shopify options with more than one value become premium dropdowns.
  const optionSelects = productOptions
    .filter((option) => option.optionValues.length > 1)
    .map((option) => {
      const options: Array<PremiumSelectOption & {to: string | null}> =
        option.optionValues.map((value) => {
          const to =
            !value.exists && !value.isDifferentProduct
              ? null // no matching variant — unselectable
              : value.isDifferentProduct
                ? `${replaceProductHandleInPath(pathname, value.handle)}?${value.variantUriQuery}`
                : `?${value.variantUriQuery}`;
          return {
            key: option.name + value.name,
            name: value.name,
            selected: value.selected,
            available: value.available,
            to,
          };
        });
      return {label: option.name, options};
    });

  return (
    <div className="product-form">
      <div className="product-selectors">
        {optionSelects.map((select) => (
          <PremiumSelect
            key={select.label}
            label={select.label}
            options={select.options}
            onSelect={(picked) => {
              const target = select.options.find((o) => o.key === picked.key);
              if (target?.to) {
                navigate(target.to, {preventScrollReset: true});
              }
            }}
          />
        ))}

        {variantGroup && (
          <PremiumSelect
            label={variantGroup.label}
            options={variantGroup.options.map((o) => ({
              key: o.handle,
              name: o.name,
              selected: o.selected,
              available: o.available,
            }))}
            onSelect={(picked) => {
              navigate(replaceProductHandleInPath(pathname, picked.key), {
                preventScrollReset: true,
              });
            }}
          />
        )}
      </div>

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
            {selectedVariant?.availableForSale ? (
              <>
                Add to bag
                {selectedVariant.price && (
                  <>
                    {' - '}
                    <span className="product-atc-price">
                      {formatMoney(selectedVariant.price)}
                    </span>
                  </>
                )}
              </>
            ) : (
              'Sold out'
            )}
          </AddToCartButton>
          {wishlistButton}
        </div>

        {selectedVariant?.availableForSale && (
          <div className="product-express">
            <AddToCartButton
              className="product-more-payment"
              redirectTo="@checkout"
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
              More payment options
            </AddToCartButton>
          </div>
        )}

        <AppointmentModal
          product={{
            id: product.id,
            title: product.title,
            handle: product.handle,
            variantInfo:
              selectedVariant?.sku?.trim() ||
              selectedVariant?.title?.trim() ||
              '',
          }}
        />
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

function formatMoney(price: {amount: string; currencyCode: string}) {
  const amount = Number(price.amount);
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currencyCode || 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
