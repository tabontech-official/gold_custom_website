import {Await, Link, useLocation} from 'react-router';
import {Suspense} from 'react';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {SocialRail} from '~/components/SocialRail';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {SearchFormPredictive} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import {RouteProgressBar, RouteTransition} from '~/components/RouteTransition';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
  publicStoreDomain,
}: PageLayoutProps) {
  const {pathname} = useLocation();
  return (
    <Aside.Provider>
      <CartAside cart={cart} />
      <SearchAside />
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
      {/*
        Header and Footer sit OUTSIDE .page-wrapper: the wrapper caps at
        --content-max-width and clips, which boxed the black header and the
        footer at 1700px on wider screens. Out here they span the viewport on
        every route; their own inner containers keep the content centred.
      */}
      {header && (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <div className="page-wrapper">
        <RouteProgressBar />
        {/*
          Header and Footer sit OUTSIDE the transition on purpose: they are
          identical on every route, so re-skeletoning them would throw away
          the one part of the page that never needed to reload.
        */}
        <SocialRail />
        <main className="page-body">
          {/* Collection pages place their own copy (see collections.$handle). */}
          {pathname.startsWith('/collections/') ? null : <BlackFridayBanner />}
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside.Provider>
  );
}

/**
 * The Black Friday banner, shown at the top of every page. The image is the
 * whole banner, so any wording lives in the image itself. The whole banner is
 * one link to the engagement collection. On phones app.css crops it to the
 * headline.
 */
export function BlackFridayBanner() {
  return (
    <Link
      className="black-friday-banner"
      to="/collections/engagement-rings"
      prefetch="intent"
    >
      <picture>
        <source
          media="(max-width: 45em)"
          srcSet="/Black%20Friday%20Engagement%20Ring%20Event%20mobile.png"
        />
        <img
          className="black-friday-image"
          src="/Luxe%20Black%20Friday%20Ring%20Event.png"
          alt="Black Friday engagement ring event. Shop the deals"
          width={2660}
          height={218}
        />
      </picture>
    </Link>
  );
}

function CartAside({cart}: {cart: PageLayoutProps['cart']}) {
  return (
    <Aside type="cart" heading="CART">
      <Suspense fallback={<p>Loading cart ...</p>}>
        {/* Every Await of the root cart promise needs its own errorElement:
            one without it rethrows a rejected cart (React Router aborts it
            after ~5 s) to the root ErrorBoundary, taking down the whole page
            and the cart route's own retry with it. /cart auto-retries. */}
        <Await
          resolve={cart}
          errorElement={
            <p>
              We couldn&rsquo;t load your bag. <a href="/cart">Try again</a>
            </p>
          }
        >
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

function SearchAside() {
  return (
    <Aside type="search" heading="SEARCH">
      <div className="predictive-search">
        <br />
        <SearchFormPredictive>
          {({fetchResults, goToSearch, inputRef}) => (
            <>
              <input
                // A placeholder is not a label: it vanishes on input and some
                // screen readers skip it.
                aria-label="Search"
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search"
                ref={inputRef}
                type="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              &nbsp;
              <button onClick={goToSearch}>Search</button>
            </>
          )}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, term, state, closeSearch}) => {
            const {products} = items;

            if (state === 'loading' && term.current) {
              return <div>Loading...</div>;
            }

            if (!products.length) {
              return <SearchResultsPredictive.Empty term={term} />;
            }

            return (
              <SearchResultsPredictive.Products
                products={products}
                closeSearch={closeSearch}
                term={term}
              />
            );
          }}
        </SearchResultsPredictive>
      </div>
    </Aside>
  );
}

function MobileMenuAside({
  header,
  publicStoreDomain,
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
}) {
  return (
    header.menu &&
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="MENU">
        <HeaderMenu
          header={header}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
      </Aside>
    )
  );
}
