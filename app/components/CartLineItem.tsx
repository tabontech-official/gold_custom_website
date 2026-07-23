import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import type {CartLayout, LineItemChildrenMap} from '~/components/CartMain';
import {CartForm, Image, type OptimisticCartLine} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {Link, useFetcher} from 'react-router';
import {ProductPrice} from './ProductPrice';
import {useAside} from './Aside';
import type {
  CartApiQueryFragment,
  CartLineFragment,
} from 'storefrontapi.generated';

export type CartLine = OptimisticCartLine<CartApiQueryFragment>;

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 * If the line is a parent line that has child components (like warranties or gift wrapping), they are
 * rendered nested below the parent line.
 */
export function CartLineItem({
  layout,
  line,
  childrenMap,
}: {
  layout: CartLayout;
  line: CartLine;
  childrenMap: LineItemChildrenMap;
}) {
  const {id, merchandise} = line;
  // A quick-add can briefly create an optimistic line before Shopify has
  // returned the complete variant/product data. Do not try to render a broken
  // link during that short transition; the confirmed cart response replaces it.
  if (!merchandise?.product?.handle) return null;

  const {product, title, image, selectedOptions = []} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const {close} = useAside();
  const lineItemChildren = childrenMap[id];
  const childrenLabelId = `cart-line-children-${id}`;

  return (
    <li key={id} className="cart-line">
      <div className="cart-line-inner">
        {image && (
          <Image
            alt={title}
            aspectRatio="1/1"
            data={image}
            height={100}
            loading="lazy"
            width={100}
          />
        )}

        <div className="cart-line-info">
          <Link
            className="cart-line-title"
            prefetch="intent"
            to={lineItemUrl}
            onClick={() => {
              if (layout === 'aside') {
                close();
              }
            }}
          >
            <p>
              <strong>{product.title}</strong>
            </p>
          </Link>
          <div className="cart-line-price">
            <ProductPrice price={line?.cost?.totalAmount} />
          </div>
          {selectedOptions.length > 0 && (
            <ul className="cart-line-options">
              {selectedOptions.map((option) => (
                <li key={option.name}>
                  <small>
                    {option.name}: {option.value}
                  </small>
                </li>
              ))}
            </ul>
          )}
          <CartLineQuantity line={line} />
        </div>
      </div>

      {lineItemChildren ? (
        <div>
          <p id={childrenLabelId} className="sr-only">
            Line items with {product.title}
          </p>
          <ul aria-labelledby={childrenLabelId} className="cart-line-children">
            {lineItemChildren.map((childLine) => (
              <CartLineItem
                childrenMap={childrenMap}
                key={childLine.id}
                line={childLine}
                layout={layout}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Provides the controls to update the quantity of a line item in the cart.
 * These controls are disabled when the line item is new, and the server
 * hasn't yet responded that it was successfully added to the cart.
 */
function CartLineQuantity({line}: {line: CartLine}) {
  // Hooks must run before any early return, so read the stock signal up top.
  const hitStockCeiling = useAtStockMax(line?.id ?? '');

  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const nextQuantity = Number((quantity + 1).toFixed(0));

  // Stock ceiling. The Storefront token here lacks the
  // `unauthenticated_read_product_inventory` scope, so numeric
  // `quantityAvailable` isn't readable. We rely on two scope-free signals:
  //   1. `availableForSale === false` → sold out, block "+".
  //   2. a prior LinesUpdate on this line came back with a not-enough-stock
  //      warning → we're at the real ceiling, so "+" turns solid.
  // Shopify still enforces the true cap server-side regardless.
  // ponytail: enable the inventory scope on the token to get an exact numeric
  // max instead of inferring it from the clamp warning.
  const soldOut =
    'availableForSale' in line.merchandise &&
    line.merchandise.availableForSale === false;
  const atStockMax = soldOut || hitStockCeiling;

  return (
    <div className="cart-line-quantity">
      <div className="cart-qty-stepper">
        {quantity <= 1 ? (
          // At 1, the decrease slot becomes a remove control instead of going to 0.
          <CartLineRemoveButton
            lineIds={[lineId]}
            disabled={!!isOptimistic}
            variant="stepper"
          />
        ) : (
          <CartLineUpdateButton lines={[{id: lineId, quantity: quantity - 1}]}>
            <button
              aria-label="Decrease quantity"
              disabled={!!isOptimistic}
              name="decrease-quantity"
              value={quantity - 1}
            >
              <span>&#8722;</span>
            </button>
          </CartLineUpdateButton>
        )}
        <span className="cart-qty-value">{quantity}</span>
        <CartLineUpdateButton lines={[{id: lineId, quantity: nextQuantity}]}>
          <button
            aria-label="Increase quantity"
            name="increase-quantity"
            value={nextQuantity}
            disabled={!!isOptimistic || atStockMax}
            className={atStockMax ? 'is-stock-max' : undefined}
          >
            <span>&#43;</span>
          </button>
        </CartLineUpdateButton>
      </div>
    </div>
  );
}

/**
 * A button that removes a line item from the cart. It is disabled
 * when the line item is new, and the server hasn't yet responded
 * that it was successfully added to the cart.
 */
function CartLineRemoveButton({
  lineIds,
  disabled,
  variant = 'text',
}: {
  lineIds: string[];
  disabled: boolean;
  variant?: 'text' | 'stepper';
}) {
  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      <button
        className={variant === 'stepper' ? 'cart-remove-icon' : 'cart-remove-btn'}
        disabled={disabled}
        type="submit"
        aria-label="Remove item"
      >
        {variant === 'stepper' ? <TrashIcon /> : 'Remove'}
      </button>
    </CartForm>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: CartLineUpdateInput[];
}) {
  const lineIds = lines.map((line) => line.id);

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines}}
    >
      {children}
    </CartForm>
  );
}

/**
 * Returns a unique key for the update action. This is used to make sure actions modifying the same line
 * items are not run concurrently, but cancel each other. For example, if the user clicks "Increase quantity"
 * and "Decrease quantity" in rapid succession, the actions will cancel each other and only the last one will run.
 * @param lineIds - line ids affected by the update
 * @returns
 */
function getUpdateKey(lineIds: string[]) {
  return [CartForm.ACTIONS.LinesUpdate, ...lineIds].join('-');
}

/**
 * True once Shopify has told us (via a LinesUpdate warning) that this line hit
 * its inventory ceiling. The update button submits under `getUpdateKey`, so we
 * read that exact fetcher's last response.
 */
function useAtStockMax(lineId: string) {
  const fetcher = useFetcher({key: getUpdateKey([lineId])});
  const warnings = (fetcher.data as {warnings?: Array<{code?: string}>})
    ?.warnings;
  return Boolean(
    warnings?.some((w) => w.code === 'MERCHANDISE_NOT_ENOUGH_STOCK'),
  );
}
