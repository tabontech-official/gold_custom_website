import {Suspense, useEffect, useRef} from 'react';
import {
  Await,
  useRevalidator,
  useRouteLoaderData,
  data,
  type HeadersFunction,
} from 'react-router';
import type {Route} from './+types/cart';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {CartPageSkeleton} from '~/components/RouteTransition';
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
    // Visit source written by AnalyticsBridge (see cartAttribution.ts).
    case CartForm.ACTIONS.AttributesUpdateInput: {
      result = await cart.updateAttributes(inputs.attributes);
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

/** Cart still not on screen this long after hydration → refetch it. */
const REFETCH_AFTER_MS = 2500;
/** Still not on screen after the refetch had its chance → reload, once. */
const RELOAD_AFTER_MS = 10000;
const RELOAD_GUARD_KEY = 'cart-auto-reload';

function cartStillLoading() {
  return Boolean(document.querySelector('[data-cart-loading]'));
}

/**
 * The last resort, and exactly what shoppers were doing by hand. Guarded so a
 * cart that genuinely cannot load shows the placeholder instead of reloading
 * forever; with no sessionStorage there is no guard, so no reload either.
 */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
}

/**
 * Loads the bag without the shopper having to refresh.
 *
 * The server streams the cart about 0.25 s after the request (measured, with
 * a post-checkout cart and the `_gl` param), yet shoppers coming back from
 * checkout were left on the loading state until they reloaded — so whatever
 * strands it happens in the browser, not in the query. Rather than bet on one
 * cause, this watches the outcome: if the placeholder is still up once the
 * document has finished loading, the root loader is revalidated (root's
 * shouldRevalidate allows a same-URL revalidation), which hands <Await> a
 * fresh cart promise. If even that does not land, one guarded reload.
 *
 * `pageshow` with `persisted` covers Back from checkout restoring this page
 * from the back/forward cache with the cart promise frozen mid-flight.
 */
function useCartAutoLoad() {
  const {revalidate} = useRevalidator();
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;

  useEffect(() => {
    const refetch = () => {
      if (cartStillLoading()) void revalidateRef.current();
    };
    // Only judge it stuck once the document is complete: before that the
    // streamed cart may simply still be on its way over a slow connection.
    const refetchWhenLoaded = () => {
      if (document.readyState === 'complete') refetch();
      else window.addEventListener('load', refetch, {once: true});
    };

    let timers: number[] = [];
    const arm = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers = [
        window.setTimeout(refetchWhenLoaded, REFETCH_AFTER_MS),
        window.setTimeout(() => {
          if (cartStillLoading()) reloadOnce();
        }, RELOAD_AFTER_MS),
      ];
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      refetch();
      arm();
    };

    arm();
    window.addEventListener('pageshow', onPageShow);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('load', refetch);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
}

/**
 * The cart promise rejected — React Router aborts deferred data still pending
 * after its ~5 s stream timeout. Without this the rejection reaches the root
 * ErrorBoundary and the shopper gets an error page instead of their bag.
 * Retry once and keep the placeholder up meanwhile; the watchdog above still
 * reloads if the retry fails too.
 */
function CartRetry() {
  const {revalidate} = useRevalidator();
  const retried = useRef(false);

  useEffect(() => {
    if (retried.current) return;
    retried.current = true;
    void revalidate();
  }, [revalidate]);

  return <CartPageSkeleton />;
}

// No loader fetch — the cart promise is already in flight from the root
// loader, so the page renders instantly and reuses that data instead of a
// second Storefront round-trip on every navigation.
//
// The fallback is a cart-shaped skeleton, not text: the header and page head
// paint at once and the lines stream into the same boxes when cart.get()
// resolves. ponytail: awaiting the cart in a route loader was rejected — it
// holds the first byte on an uncached query (checkout stays on screen with
// only a tab spinner) and runs cart.get() twice per document load, since
// Hydrogen does not dedupe it against root's.
export default function Cart() {
  const rootData = useRouteLoaderData<RootLoader>('root');
  useCartAutoLoad();

  return (
    <div className="cart">
      <div className="cart-page-head">
        <span className="eyebrow">Your Selection</span>
        <h1>Shopping Bag</h1>
      </div>
      <Suspense fallback={<CartPageSkeleton />}>
        <Await resolve={rootData?.cart} errorElement={<CartRetry />}>
          {(cart) => <CartMain layout="page" cart={cart ?? null} />}
        </Await>
      </Suspense>
    </div>
  );
}
