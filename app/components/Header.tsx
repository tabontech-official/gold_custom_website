import {Suspense, useEffect, useRef, useState} from 'react';
import {Await, Link, NavLink, useAsyncValue, useFetcher} from 'react-router';
import {
  Image,
  Money,
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {MEGA_MENU, getColumnItems, toRelativeUrl} from '~/lib/megaMenu';
import {
  getEmptyPredictiveSearchResult,
  type PredictiveSearchReturn,
} from '~/lib/search';
import {SEARCH_ENDPOINT} from '~/components/SearchFormPredictive';

const HEADER_UTILITY_MESSAGES = [
  'Complimentary shipping and returns',
  'Lifetime warranty on every piece',
  'Private Los Angeles appointments',
];

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop} = header;
  const [utilityMessageIndex, setUtilityMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setUtilityMessageIndex(
        (currentIndex) => (currentIndex + 1) % HEADER_UTILITY_MESSAGES.length,
      );
    }, 2500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      {/* Tier 1 — announcement micro-banner with golden shimmer */}
      <div className="announcement-bar" aria-live="polite">
        <Link className="announcement-link" to="/contact">
          Book Now
        </Link>
        <span key={utilityMessageIndex} className="announcement-text">
          {HEADER_UTILITY_MESSAGES[utilityMessageIndex]}
        </span>
        <a
          className="announcement-link"
          href="https://maps.app.goo.gl/252CwsjSZfhSae4B6"
          target="_blank"
          rel="noreferrer"
        >
          Los Angeles
        </a>
      </div>

      {/* Tier 2 — search + region | logo | account + cart */}
      <div className="header-primary">
        <div className="header-primary-left">
          <HeaderMenuMobileToggle />
          <HeaderSearchBar />
        </div>
        <NavLink prefetch="intent" to="/" end className="header-logo">
          {shop.name}
        </NavLink>
        <div className="header-primary-right">
          <HeaderCtas cart={cart} isLoggedIn={isLoggedIn} />
        </div>
      </div>

      {/* Tier 3 — mega menu bar */}
      <header className="header">
        <HeaderMenu
          header={header}
          viewport="desktop"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
      </header>
    </>
  );
}

// ponytail: single market — the store ships to the US and prices in USD, so
// this is a fixed label, not a picker. Turn it into a selector only if/when
// more Hydrogen markets are enabled.
function RegionSelector() {
  return (
    <span className="region-pill region-static">
      <span aria-hidden="true">🇺🇸</span>
      US / USD
    </span>
  );
}

function HeaderSearchBar() {
  const fetcher = useFetcher<PredictiveSearchReturn>({key: 'header-search'});
  const [term, setTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {items, total} = fetcher.data?.result ?? getEmptyPredictiveSearchResult();
  const showResults = isOpen && term.length > 0;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setTerm(value);
    setIsOpen(true);
    void fetcher.submit(
      {q: value, limit: 6, predictive: true},
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  function closeResults() {
    setIsOpen(false);
  }

  return (
    <div className="header-search">
      <form
        onSubmit={(event) => event.preventDefault()}
        role="search"
      >
        <input
          aria-label="Search"
          autoComplete="off"
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          onBlur={closeResults}
          placeholder="Search..."
          ref={inputRef}
          type="search"
          value={term}
        />
        <button aria-label="Submit search" className="reset" type="submit">
          <SearchIcon />
        </button>
      </form>
      {showResults && (
        <div
          className="header-search-results"
          onMouseDown={(event) => event.preventDefault()}
        >
          {fetcher.state === 'loading' ? (
            <p className="header-search-status">Searching…</p>
          ) : total === 0 ? (
            <p className="header-search-status">
              No results for <q>{term}</q>
            </p>
          ) : (
            <>
              <ul>
                {items.products.map((product) => {
                  const image = product.selectedOrFirstAvailableVariant?.image;
                  const price = product.selectedOrFirstAvailableVariant?.price;
                  return (
                    <li key={product.id}>
                      <Link
                        onClick={closeResults}
                        to={`/products/${product.handle}`}
                      >
                        {image && (
                          <Image
                            alt={image.altText ?? ''}
                            aspectRatio="1/1"
                            data={image}
                            width={44}
                            height={44}
                          />
                        )}
                        <span className="header-search-result-info">
                          <span className="header-search-result-title">
                            {product.title}
                          </span>
                          {price && (
                            <small>
                              <Money data={price} />
                            </small>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {items.collections.map((collection) => (
                  <li key={collection.id}>
                    <Link
                      onClick={closeResults}
                      to={`/collections/${collection.handle}`}
                    >
                      <span className="header-search-result-info">
                        <span className="header-search-result-title">
                          {collection.title}
                        </span>
                        <small>Collection</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                className="header-search-viewall"
                onClick={closeResults}
                to={`${SEARCH_ENDPOINT}?q=${term}`}
              >
                View all results for &ldquo;{term}&rdquo; &rarr;
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HeaderMenu({
  header,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  header: HeaderProps['header'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const {close} = useAside();
  const relativeUrl = (url: string) =>
    toRelativeUrl(url, primaryDomainUrl, publicStoreDomain);

  if (viewport === 'desktop') {
    return (
      <nav className="header-menu-desktop mega-menu" role="navigation">
        {MEGA_MENU.map((department) => (
          <MegaMenuItem
            department={department}
            header={header}
            key={department.id}
            relativeUrl={relativeUrl}
          />
        ))}
      </nav>
    );
  }

  return (
    <MobileMenu header={header} relativeUrl={relativeUrl} onNavigate={close} />
  );
}

type FeaturedProduct = {
  id: string;
  title: string;
  handle: string;
  priceRange?: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  featuredImage: {
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
};

function MegaMenuItem({
  department,
  header,
  relativeUrl,
}: {
  department: (typeof MEGA_MENU)[number];
  header: HeaderProps['header'];
  relativeUrl: (url: string) => string;
}) {
  const fetcher = useFetcher<{products: FeaturedProduct[]}>();
  const [isClosing, setIsClosing] = useState(false);
  const handle = department.to.replace('/collections/', '');

  // Lazy-load this department's real products the first time it's hovered.
  function loadProducts() {
    if (fetcher.data || fetcher.state !== 'idle') return;
    fetcher.load(`/api/collection-products?handle=${handle}`);
  }

  const products = (fetcher.data?.products ?? []).slice(0, 3);
  const isLoading = fetcher.state === 'loading' || !fetcher.data;
  const menuItems = department.columns
    .flatMap((column) => getColumnItems(header, column))
    .filter((item) => item.url);
  const featuredProducts = products.slice(0, 2);

  function closeMegaMenu() {
    setIsClosing(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  return (
    <div
      className={`mega-menu-item${isClosing ? ' is-closing' : ''}`}
      onFocus={loadProducts}
      onMouseEnter={loadProducts}
      onMouseLeave={() => setIsClosing(false)}
    >
      <NavLink
        className="header-menu-item"
        onClick={closeMegaMenu}
        prefetch="intent"
        to={department.to}
      >
        {department.label}
      </NavLink>
      <div className="mega-menu-panel">
        <div className="mega-menu-inner">
          <div className="mega-menu-links-panel">
            <ul className="mega-menu-link-list">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <NavLink
                    onClick={closeMegaMenu}
                    prefetch="intent"
                    to={relativeUrl(item.url ?? '')}
                  >
                    {item.title}
                  </NavLink>
                </li>
              ))}
            </ul>
            <NavLink
              className="mega-menu-shop-button"
              onClick={closeMegaMenu}
              prefetch="intent"
              to={department.to}
            >
              Shop {department.label}
            </NavLink>
          </div>

          <div className="mega-menu-featured">
            <h3>Best Sellers</h3>
            <div className="mega-menu-product-grid">
              {featuredProducts.length > 0
                ? featuredProducts.map((product) => (
                  <Link
                    className="mega-menu-card"
                    key={product.id}
                    onClick={closeMegaMenu}
                    prefetch="intent"
                    to={`/products/${product.handle}`}
                  >
                    {product.featuredImage ? (
                      <Image
                        className="mega-menu-card-img"
                        data={product.featuredImage}
                        width={150}
                        height={188}
                        sizes="150px"
                      />
                    ) : (
                      <span className="mega-menu-card-img" />
                    )}
                    <span className="mega-menu-card-title">{product.title}</span>
                    {product.priceRange?.minVariantPrice && (
                      <span className="mega-menu-card-price">
                        <Money data={product.priceRange.minVariantPrice as any} />
                      </span>
                    )}
                  </Link>
                ))
                : isLoading &&
                Array.from({length: 2}).map((_, index) => (
                  <span className="mega-menu-card" key={index}>
                    <span className="mega-menu-card-img is-loading" />
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMenu({
  header,
  relativeUrl,
  onNavigate,
}: {
  header: HeaderProps['header'];
  relativeUrl: (url: string) => string;
  onNavigate: () => void;
}) {
  const [openDepartment, setOpenDepartment] = useState<string | null>(null);

  return (
    <nav className="header-menu-mobile" role="navigation">
      <NavLink end onClick={onNavigate} prefetch="intent" to="/">
        Home
      </NavLink>
      {MEGA_MENU.map((department) => {
        const isOpen = openDepartment === department.id;
        return (
          <div className="mobile-nav-department" key={department.id}>
            <div className="mobile-nav-department-header">
              <NavLink
                onClick={onNavigate}
                prefetch="intent"
                to={department.to}
              >
                {department.label}
              </NavLink>
              <button
                aria-expanded={isOpen}
                aria-label={`Toggle ${department.label} submenu`}
                className="mobile-nav-toggle reset"
                onClick={() =>
                  setOpenDepartment(isOpen ? null : department.id)
                }
                type="button"
              >
                {isOpen ? '−' : '+'}
              </button>
            </div>
            {isOpen && (
              <div className="mobile-nav-submenu">
                {department.columns.map((column, index) => {
                  const items = getColumnItems(header, column);
                  if (!items.length) return null;
                  return (
                    <div key={index}>
                      {column.title && <h5>{column.title}</h5>}
                      {items.map((item) =>
                        item.url ? (
                          <NavLink
                            key={item.id}
                            onClick={onNavigate}
                            prefetch="intent"
                            to={relativeUrl(item.url)}
                          >
                            {item.title}
                          </NavLink>
                        ) : null,
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}


function HeaderCtas({
  cart,
  isLoggedIn,
}: Pick<HeaderProps, 'cart' | 'isLoggedIn'>) {
  return (
    <nav className="header-ctas" role="navigation">
      <SearchToggle />
      <NavLink
        aria-label="Account"
        className="header-cta-link"
        prefetch="intent"
        to="/account"
      >
        <UserIcon />
      </NavLink>
      <a className="header-cta-icon" href="tel:9299305655" aria-label="Call us">
        <PhoneIcon />
      </a>
      <CartToggle cart={cart} />
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-menu-mobile-toggle reset"
      onClick={() => open('mobile')}
    >
      <h3>☰</h3>
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      aria-label="Search"
      className="reset header-cta-icon header-search-toggle"
      onClick={() => open('search')}
    >
      <SearchIcon />
    </button>
  );
}

function CartBadge({count}: {count: number | null}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      className="header-cta-icon"
      aria-label="Cart"
      href="/cart"
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      <BagIcon />
      <span className="header-cart-count">
        {count === null ? '' : count}
      </span>
    </a>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M20 20l-4.35-4.35"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1L6.6 10.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 21a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 8h12l-1 12.5a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6.5a3 3 0 0 1 6 0V8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={null} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

