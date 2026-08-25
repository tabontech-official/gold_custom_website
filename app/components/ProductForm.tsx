import type {ReactNode} from 'react';
import {useLocation, useNavigate, Link} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import {AddToCartButton, AddedToBagLabel} from './AddToCartButton';
import {AppointmentModal} from './AppointmentModal';
import {useAside} from './Aside';
import {PremiumSelect, type PremiumSelectOption} from './PremiumSelect';
import {
  RING_SIZES,
  RING_SIZE_ATTRIBUTE_KEY,
  RING_SIZE_GUIDE_URL,
} from '~/lib/ringSizes';
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
  ringSize,
  onRingSizeChange,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  wishlistButton?: ReactNode;
  variantGroup?: VariantGroupSelect | null;
  product: {id: string; title: string; handle: string};
  /** Set only for rings — omitted, no size selector and no size on the line. */
  ringSize?: string;
  onRingSizeChange?: (size: string) => void;
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

  // A single-variant product with no ring sizing has nothing to put in a
  // "Customize" card — render the card only when there's an actual choice
  // to make, not an empty box with a label and nothing under it.
  const hasSelectors =
    optionSelects.length > 0 || Boolean(variantGroup) || Boolean(ringSize);

  return (
    <div className="product-form">
      {hasSelectors && (
        <div className="pdp-card product-customize-card">
          <p className="pdp-card-label">Customize</p>
          <div className="product-selectors">
            {optionSelects.map((select) => (
              <PremiumSelect
                key={select.label}
                label={select.label}
                options={select.options}
                onSelect={(picked) => {
                  const target = select.options.find(
                    (o) => o.key === picked.key,
                  );
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

            {ringSize && (
              <PremiumSelect
                label="Size"
                hint={
                  <a
                    className="ring-size-guide-link"
                    href={RING_SIZE_GUIDE_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <RulerIcon />
                    Find my ring size
                  </a>
                }
                options={RING_SIZES.map((size) => ({
                  key: size,
                  name: size,
                  selected: size === ringSize,
                  available: true,
                }))}
                onSelect={(picked) => onRingSizeChange?.(picked.key)}
              />
            )}
          </div>
        </div>
      )}

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
                      ...(ringSize && {
                        attributes: [
                          {key: RING_SIZE_ATTRIBUTE_KEY, value: ringSize},
                        ],
                      }),
                    },
                  ]
                : []
            }
            addedChildren={<AddedToBagLabel />}
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

function RulerIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15.5 2.5 21.5 8.5 8.5 21.5 2.5 15.5z" />
      <path d="M7 12.5l1.8 1.8M10 9.5l1.8 1.8M13 6.5l1.8 1.8" />
    </svg>
  );
}

/**
 * Swap the product handle in the path the shopper is already on, so picking a
 * length from inside /collections/chains/products/x lands on
 * /collections/chains/products/y — staying in the collection instead of
 * bouncing out through a redirect.
 *
 * Both product URL shapes end in `products/<handle>`, so the check is on the
 * second-to-last segment. Anything else (a stale path shape) falls back to the
 * flat form, which redirects to the product's canonical URL.
 */
function replaceProductHandleInPath(pathname: string, handle?: string | null) {
  if (!handle) return pathname;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[parts.length - 2] !== 'products') {
    return `/products/${encodeURIComponent(handle)}`;
  }
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
