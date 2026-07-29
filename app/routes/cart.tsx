import {Suspense} from 'react';
import {
  Await,
  useRouteLoaderData,
  data,
  type HeadersFunction,
} from 'react-router';
import type {Route} from './+types/cart';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import type {RootLoader} from '~/root';
import {pageSeo} from '~/lib/seo';

// User-specific and has no search value — keep it out of the index.
export const meta: Route.MetaFunction = () =>
  pageSeo({title: 'Your Cart', noIndex: true});

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result: CartQueryDataReturn;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = (
        formDiscountCode ? [formDiscountCode] : []
      ) as string[];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesAdd: {
      const formGiftCardCode = inputs.giftCardCode;

      const giftCardCodes = (
        formGiftCardCode ? [formGiftCardCode] : []
      ) as string[];

      result = await cart.addGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesRemove: {
      const appliedGiftCardIds = inputs.giftCardCodes as string[];
      result = await cart.removeGiftCardCodes(appliedGiftCardIds);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    case CartForm.ACTIONS.NoteUpdate: {
      result = await cart.updateNote((inputs.note as string) ?? '');
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    status = 303;
    // "@checkout" → jump straight to the freshly-added cart's Shopify
    // checkout (payment) page; anything else is a normal path redirect.
    const location =
      redirectTo === '@checkout'
        ? cartResult?.checkoutUrl ?? '/cart'
        : redirectTo;
    headers.set('Location', location);
  }

  return data(
    {
      cart: cartResult,
      errors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

// No loader fetch — the cart promise is already in flight from the root
// loader, so the page renders instantly and reuses that data instead of a
// second Storefront round-trip on every navigation.
export default function Cart() {
  const rootData = useRouteLoaderData<RootLoader>('root');

  return (
    <div className="cart">
      <div className="cart-page-head">
        <span className="eyebrow">Your Selection</span>
        <h1>Shopping Bag</h1>
      </div>
      <Suspense fallback={<p>Loading cart …</p>}>
        <Await resolve={rootData?.cart}>
          {(cart) => <CartMain layout="page" cart={cart ?? null} />}
        </Await>
      </Suspense>
    </div>
  );
}
