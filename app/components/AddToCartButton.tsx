import {Suspense, type ReactNode} from 'react';
import {
  Await,
  useAsyncValue,
  useRouteLoaderData,
  type FetcherWithComponents,
} from 'react-router';
import {
  CartForm,
  useOptimisticCart,
  type OptimisticCartLineInput,
} from '@shopify/hydrogen';
import {isInCart} from '~/lib/cartLines';
import type {RootLoader} from '~/root';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

type AddToCartButtonProps = {
  analytics?: unknown;
  children: React.ReactNode;
  /**
   * When set, the button locks into this label for as long as the cart holds a
   * matching line — so removing the item from the cart unlocks it again.
   */
  addedChildren?: ReactNode;
  className?: string;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  /** When set, the cart action redirects here after adding (express flow). */
  redirectTo?: string;
};

export function AddToCartButton(props: AddToCartButtonProps) {
  const rootCart = useRouteLoaderData<RootLoader>('root')?.cart;

  // Buttons without an "added" label never need the cart, so they skip the
  // Suspense boundary entirely. The unlocked button is also the fallback while
  // the deferred cart is still in flight.
  const unlocked = <AddToCartForm {...props} inCart={false} />;
  if (!props.addedChildren || !rootCart) return unlocked;

  return (
    <Suspense fallback={unlocked}>
      <Await resolve={rootCart} errorElement={unlocked}>
        <CartAwareAddToCartForm {...props} />
      </Await>
    </Suspense>
  );
}

function CartAwareAddToCartForm(props: AddToCartButtonProps) {
  // Optimistic so the lock flips the moment the shopper adds or removes the
  // line, without waiting for the cart round-trip.
  const cart = useOptimisticCart(useAsyncValue() as CartApiQueryFragment | null);
  return <AddToCartForm {...props} inCart={isInCart(cart, props.lines)} />;
}

/** Shared locked-state label — pass as `addedChildren`. */
export function AddedToBagLabel() {
  return (
    <>
      <svg
        className="atc-check"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.25" strokeWidth="1.4" />
        <path d="M7.75 12.3l2.9 2.9 5.6-6.1" />
      </svg>
      Added to bag
    </>
  );
}

function AddToCartForm({
  analytics,
  children,
  addedChildren,
  className,
  disabled,
  lines,
  onClick,
  redirectTo,
  inCart,
}: AddToCartButtonProps & {inCart: boolean}) {
  const added = Boolean(addedChildren && inCart);

  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          {redirectTo && (
            <input name="redirectTo" type="hidden" value={redirectTo} />
          )}
          <button
            type="submit"
            className={added ? `${className ?? ''} is-added` : className}
            onClick={onClick}
            disabled={disabled || fetcher.state !== 'idle' || added}
            aria-live={addedChildren ? 'polite' : undefined}
          >
            {added ? addedChildren : children}
          </button>
        </>
      )}
    </CartForm>
  );
}
