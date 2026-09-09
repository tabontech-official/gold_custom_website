import type {ReactNode} from 'react';
import {useLocation, Link} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import {AddToCartButton, AddedToBagLabel} from './AddToCartButton';
import {AppointmentModal} from './AppointmentModal';
import {useAside} from './Aside';
import {PendantPhotoModal} from './PendantPhotoModal';
import {PremiumSelect, type PremiumSelectOption} from './PremiumSelect';
import {PENDANT_PHOTO_ATTRIBUTE_KEY} from '~/lib/pendantPhoto';
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
  photoUrl,
  onPhotoChange,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  wishlistButton?: ReactNode;
  variantGroup?: VariantGroupSelect | null;
  product: {id: string; title: string; handle: string};
  /** Set only for rings — omitted, no size selector and no size on the line. */
  ringSize?: string;
  onRingSizeChange?: (size: string) => void;
  /**
   * Set only for Picture Pendants. `onPhotoChange` present is what makes the
   * upload required — the piece is the photo, so there is nothing to add to
   * the bag until one is uploaded.
   */
  photoUrl?: string;
  onPhotoChange?: (url?: string) => void;
}) {
  const {pathname} = useLocation();
  const {open} = useAside();

  // Switching a group value (Center Diamond Carat) opens a SIBLING PRODUCT, so
  // the variant options live in the URL and used to be dropped on the way —
  // picking a different carat while on White Gold landed on the next
  // product's default, Yellow. Siblings in a group carry the same option
  // names, so the current selection is carried across; anything the sibling
  // doesn't have is ignored by the loader (`ignoreUnknownOptions: true`).
  //
  // Read from the SELECTED VARIANT, not the URL: the first choice a shopper
  // makes on a page they landed on cleanly is not in the query string yet,
  // and that is exactly the case where the reset was most visible.
  const carriedOptions = new URLSearchParams(
    (selectedVariant?.selectedOptions ?? []).map(
      (option) => [option.name, option.value] as [string, string],
    ),
  ).toString();

  // Shopify options with more than one value become premium dropdowns.
  const optionSelects = productOptions
    .filter((option) => option.optionValues.length > 1)
    .map((option) => {
      const options: PremiumSelectOption[] =
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

  // Every per-line choice Shopify has no variant for, in one place — these
  // become line item properties on the order. Building the array here rather
  // than inline is what keeps two of them from being an either/or.
  const lineAttributes = [
    ...(ringSize ? [{key: RING_SIZE_ATTRIBUTE_KEY, value: ringSize}] : []),
    ...(photoUrl
      ? [{key: PENDANT_PHOTO_ATTRIBUTE_KEY, value: photoUrl}]
      : []),
  ];
  // A Picture Pendant with no photo has nothing to add to the bag, so the Add
  // to bag button is not rendered at all until one is uploaded — a disabled
  // button the shopper cannot explain is worse than no button plus the control
  // that unlocks it.
  const needsPhoto = Boolean(onPhotoChange) && !photoUrl;
  const photoControl = onPhotoChange ? (
    <PendantPhotoModal
      productTitle={product.title}
      url={photoUrl}
      onChange={onPhotoChange}
    />
  ) : null;

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
                  // A sibling product, so this is a real navigation — `to`
                  // makes it a Link, which prefetches the other product's
                  // data on hover instead of after the click.
                  to:
                    replaceProductHandleInPath(pathname, o.handle) +
                    (carriedOptions ? `?${carriedOptions}` : ''),
                }))}
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
        {/* Saved-photo summary sits above the buy row; the "add your photo"
            call to action takes Add to bag's place inside it. Exactly one of
            the two is ever mounted. */}
        {!needsPhoto && photoControl}

        <div className="product-buy-row">
          {needsPhoto && photoControl}
          {!needsPhoto && (
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
                      ...(lineAttributes.length > 0 && {
                        attributes: lineAttributes,
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
          )}
          {wishlistButton}
        </div>

        {/* Add to bag is absent, not broken — say why, once, where the button
            would have been. */}
        {needsPhoto && (
          <p className="pendant-photo-gate">
            This pendant is made from your picture, so a photo is required
            before it can go in the bag.
          </p>
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
