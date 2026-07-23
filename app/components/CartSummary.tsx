import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import {Link, useFetcher} from 'react-router';
import {useAside} from './Aside';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
};

export function CartSummary({cart, layout}: CartSummaryProps) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';
  const [agreed, setAgreed] = useState(false);

  return (
    <div aria-labelledby="cart-summary" className={className}>
      {layout === 'aside' && <CartNote note={cart?.note} />}

      <dl className="cart-subtotal">
        <dt>Subtotal</dt>
        <dd>
          {cart?.cost?.subtotalAmount?.amount ? (
            <Money data={cart?.cost?.subtotalAmount} />
          ) : (
            '-'
          )}
        </dd>
      </dl>
      <p className="cart-tax-note">Taxes and shipping calculated at checkout</p>

      {layout === 'page' && (
        <>
          <CartDiscounts discountCodes={cart?.discountCodes} />
          <CartGiftCard giftCardCodes={cart?.appliedGiftCards} />
        </>
      )}

      <label className="cart-terms">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I agree with the terms and conditions.</span>
      </label>

      <div className="cart-actions">
        {layout === 'aside' && <ViewCartLink />}
        <CartCheckoutActions checkoutUrl={cart?.checkoutUrl} disabled={!agreed} />
      </div>
    </div>
  );
}

function ViewCartLink() {
  const {close} = useAside();
  return (
    <Link className="btn cart-view-btn" to="/cart" onClick={close}>
      View cart
    </Link>
  );
}

/** Toggleable order note saved to the cart. */
function CartNote({note}: {note?: string | null}) {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(Boolean(note));
  // Optimistic value from an in-flight save, falls back to the server note.
  const pending = fetcher.formData?.get('note');
  const value = typeof pending === 'string' ? pending : (note ?? '');

  return (
    <div className={`cart-note ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="cart-note-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <NoteIcon />
        <span>{note ? 'Edit order note' : 'Add a note to your order'}</span>
      </button>
      {open && (
        <fetcher.Form method="post" action="/cart" className="cart-note-form">
          <input
            type="hidden"
            name="cartFormInput"
            value={JSON.stringify({action: CartForm.ACTIONS.NoteUpdate})}
          />
          <textarea
            name="note"
            rows={3}
            defaultValue={value}
            placeholder="Add gift message or special instructions…"
          />
          <button type="submit" disabled={fetcher.state !== 'idle'}>
            {fetcher.state !== 'idle' ? 'Saving…' : 'Save note'}
          </button>
        </fetcher.Form>
      )}
    </div>
  );
}

function NoteIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function CartCheckoutActions({
  checkoutUrl,
  disabled,
}: {
  checkoutUrl?: string;
  disabled?: boolean;
}) {
  if (!checkoutUrl) return null;

  return (
    <a
      className={`btn btn-primary cart-checkout-btn ${disabled ? 'is-disabled' : ''}`}
      href={disabled ? undefined : checkoutUrl}
      aria-disabled={disabled}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      target="_self"
    >
      Check out
    </a>
  );
}

function CartDiscounts({
  discountCodes,
}: {
  discountCodes?: CartApiQueryFragment['discountCodes'];
}) {
  const codes: string[] =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  return (
    <div>
      {/* Have existing discount, display it with a remove option */}
      <dl hidden={!codes.length}>
        <div>
          <dt>Discount(s)</dt>
          <UpdateDiscountForm>
            <div className="cart-discount">
              <code>{codes?.join(', ')}</code>
              &nbsp;
              <button type="submit" aria-label="Remove discount">
                Remove
              </button>
            </div>
          </UpdateDiscountForm>
        </div>
      </dl>

      {/* Show an input to apply a discount */}
      <UpdateDiscountForm discountCodes={codes}>
        <div>
          <label htmlFor="discount-code-input" className="sr-only">
            Discount code
          </label>
          <input
            id="discount-code-input"
            type="text"
            name="discountCode"
            placeholder="Discount code"
          />
          &nbsp;
          <button type="submit" aria-label="Apply discount code">
            Apply
          </button>
        </div>
      </UpdateDiscountForm>
    </div>
  );
}

function UpdateDiscountForm({
  discountCodes,
  children,
}: {
  discountCodes?: string[];
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {children}
    </CartForm>
  );
}

function CartGiftCard({
  giftCardCodes,
}: {
  giftCardCodes: CartApiQueryFragment['appliedGiftCards'] | undefined;
}) {
  const giftCardCodeInput = useRef<HTMLInputElement>(null);
  const giftCardAddFetcher = useFetcher({key: 'gift-card-add'});

  useEffect(() => {
    if (giftCardAddFetcher.data) {
      giftCardCodeInput.current!.value = '';
    }
  }, [giftCardAddFetcher.data]);

  return (
    <div>
      {giftCardCodes && giftCardCodes.length > 0 && (
        <dl>
          <dt>Applied Gift Card(s)</dt>
          {giftCardCodes.map((giftCard) => (
            <RemoveGiftCardForm key={giftCard.id} giftCardId={giftCard.id}>
              <div className="cart-discount">
                <code>***{giftCard.lastCharacters}</code>
                &nbsp;
                <Money data={giftCard.amountUsed} />
                &nbsp;
                <button type="submit">Remove</button>
              </div>
            </RemoveGiftCardForm>
          ))}
        </dl>
      )}

      <AddGiftCardForm fetcherKey="gift-card-add">
        <div>
          <input
            type="text"
            name="giftCardCode"
            placeholder="Gift card code"
            ref={giftCardCodeInput}
          />
          &nbsp;
          <button type="submit" disabled={giftCardAddFetcher.state !== 'idle'}>
            Apply
          </button>
        </div>
      </AddGiftCardForm>
    </div>
  );
}

function AddGiftCardForm({
  fetcherKey,
  children,
}: {
  fetcherKey?: string;
  children: React.ReactNode;
}) {
  return (
    <CartForm
      fetcherKey={fetcherKey}
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesAdd}
    >
      {children}
    </CartForm>
  );
}

function RemoveGiftCardForm({
  giftCardId,
  children,
}: {
  giftCardId: string;
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesRemove}
      inputs={{
        giftCardCodes: [giftCardId],
      }}
    >
      {children}
    </CartForm>
  );
}
