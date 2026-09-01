import {Suspense, useEffect, useRef, useState} from 'react';
import {
  Await,
  Link,
  NavLink,
  useAsyncValue,
  useFetcher,
  useNavigate,
  useRouteLoaderData,
} from 'react-router';
import type {RootLoader} from '~/root';
import {
  Image,
  Money,
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {AppointmentModal} from '~/components/AppointmentModal';
import {
  MEGA_MENU,
  getDepartmentColumns,
  getDepartmentItems,
  getDepartmentSubCollectionHandles,
  hasDepartmentItems,
  toRelativeUrl,
} from '~/lib/megaMenu';
import {
  getEmptyPredictiveSearchResult,
  type PredictiveSearchReturn,
} from '~/lib/search';
import {SEARCH_ENDPOINT} from '~/components/SearchFormPredictive';
import {cdnLoader, cdnWidth} from '~/lib/cdnImage';
import {buildProductPath, productCanonicalPath} from '~/lib/categories';

const HEADER_UTILITY_MESSAGES = [
  'Complimentary shipping and returns',
  // Not "Lifetime warranty" — the policy is 1 year on production defects.
  '1-year warranty on production defects',
  'Private Los Angeles appointments',
];

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

/**
 * The rotating utility message, isolated in its own component on purpose.
 *
 * The 2.5s interval used to live in `Header`, so every tick re-rendered the
 * whole header — search bar, cart Suspense boundary and all eight mega-menu
 * items with their fetchers — forever, on every page. Now the only thing that
 * re-renders is this one span.
 */
function UtilityMessage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HEADER_UTILITY_MESSAGES.length);
    }, 2500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span key={index} className="announcement-text">
      {HEADER_UTILITY_MESSAGES[index]}
    </span>
  );
}

/**
 * True once the visitor has scrolled DOWN past the header's own flow space;
 * flips back to false the moment they scroll up at all.
 *
 * The threshold is MEASURED, not a constant, and that is the whole fix.
 *
 * `.header-primary` is `position: sticky`, and a sticky element always keeps
 * its space in normal flow. Between roughly 44px and 132px of scroll the
 * header is already pinned to the viewport while the space it reserves is
 * STILL ON SCREEN — so translating it away there uncovers bare page
 * background: a white band across the top with the nav bar sitting under it.
 * The old threshold was the constant 80, which sits inside that band, which
 * is why the gap showed up on a slow scroll and never on a fast one.
 *
 * Measuring the header's flow bottom (offsetTop + offsetHeight) means it can
 * only hide once the space it vacates is already above the viewport, so there
 * is nothing left behind to see. Re-measured on resize, because the header's
 * height is a clamp on viewport width.
 *
 * rAF-throttled — the scroll listener never runs more than once per frame,
 * however fast `scroll` events fire — and a 4px dead zone absorbs
 * trackpad/inertial jitter that would otherwise flicker it.
 */
function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Touch devices keep the header pinned. iOS Safari's collapsing address
    // bar, rubber-band bounce and compositor-thread momentum scrolling all
    // feed reversing scroll deltas into this hook, so the header flipped
    // hidden/shown many times a second — and every flip re-pinned the sticky
    // category strip and filter bar a frame late, which is the "vibrating"
    // collection page on iPhone. A header that never moves gives them a
    // constant offset and nothing to chase.
    if (window.matchMedia('(hover: none)').matches) return;

    const header = document.querySelector('.header-primary');
    if (!(header instanceof HTMLElement)) return;

    // Falls back past any plausible header, so a failed measurement errs
    // toward hiding late rather than hiding inside the gap band.
    let revealAt = 240;
    const measure = () => {
      revealAt = Math.max(header.offsetTop + header.offsetHeight, 120);
    };
    measure();

    let lastY = window.scrollY;
    let ticking = false;

    function read() {
      // Clamp out iOS rubber-band overshoot: past either end, scrollY runs
      // beyond the document and springs back, flipping the delta sign every
      // frame — and with it the header and every sticky bar pinned under it.
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.min(Math.max(window.scrollY, 0), Math.max(maxY, 0));
      const delta = y - lastY;
      if (y < revealAt) {
        setHidden(false);
      } else if (delta > 4) {
        setHidden(true);
      } else if (delta < -4) {
        setHidden(false);
      }
      lastY = y;
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(read);
    }

    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Mirrored onto <html> so sticky bars below the header (collection filter
  // toolbar, category strip) can drop their top offset while it is translated
  // away — otherwise they keep clearing space for a header that isn't there.
  useEffect(() => {
    document.documentElement.classList.toggle('header-primary-hidden', hidden);
  }, [hidden]);

  return hidden;
}

/**
 * Adds `page-scrolled` to <html> once the viewport has moved past the
 * announcement bar, so mobile collection pages can collapse it and reclaim
 * its height (see app.css, --announce-h).
 *
 * An IntersectionObserver against a sentinel the announcement's own height,
 * NOT a scroll listener: it fires once per crossing, off the main thread. A
 * per-frame scroll handler here would put a layout change back on the same
 * thread as the fixed bars below it, which is what made the collection page
 * vibrate on iOS in the first place. The sentinel's height also gives the
 * toggle natural hysteresis — it flips at one edge, not on every pixel.
 */
function useScrolledPastAnnouncement(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      document.documentElement.classList.toggle(
        'page-scrolled',
        !entry.isIntersecting,
      ),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('page-scrolled');
    };
  }, [ref]);
}

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop} = header;
  const topSentinelRef = useRef<HTMLDivElement>(null);
  useScrolledPastAnnouncement(topSentinelRef);
  const hideStickyRow = useHideOnScrollDown();
  // ponytail: CDN fallback until the logo is assigned in Shopify admin
  // (Settings > Brand) — then shop.brand takes over.
  //
  // Named .webp, served as image/png — the CDN goes by the bytes, not the
  // extension, so the transform below still applies.
  //
  // Plain `cdnWidth`, not a crop: unlike the previous file (2103x748 with
  // 22% transparent padding built in, needing a centre-crop to trim), this
  // one is drawn edge to edge — its 2080x613 canvas IS the artwork, so
  // resizing it is all that's needed.
  const logoSrc =
    shop.brand?.logo?.image?.url ??
    'https://cdn.shopify.com/s/files/1/0806/9568/9464/files/ChatGPT_Image_Aug_24_2026_02_24_14_PM.png?v=1787813253';
  const logoUrl = (scale: number) => cdnWidth(logoSrc, 360 * scale);

  return (
    <>
      {/* Sits at document top, the announcement bar's own height. Once it
          scrolls out of view the bar collapses — see
          useScrolledPastAnnouncement. */}
      <div
        aria-hidden="true"
        className="top-scroll-sentinel"
        ref={topSentinelRef}
      />
      {/* Tier 1 — announcement micro-banner with golden shimmer */}
      <div className="announcement-bar" aria-live="polite">
        {/* Same booking modal the product page uses, minus product context. */}
        <AppointmentModal
          triggerLabel="Book Now"
          triggerClassName="announcement-link"
        />
        <UtilityMessage />
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
      <div
        className={`header-primary${hideStickyRow ? ' is-hidden' : ''}`}
      >
        <div className="header-primary-left">
          <HeaderMenuMobileToggle />
          <HeaderSearchBar />
        </div>
        <NavLink prefetch="intent" to="/" end className="header-logo">
          <img
            className="header-logo-img"
            /**
             * 360px covers the widest this renders at 1x (the desktop width
             * clamp's 22.4rem ceiling — width and height are deliberately
             * decoupled in CSS now, so this tracks the WIDTH clamp, not the
             * source's own ratio), with 2x/3x for dense screens. The CDN
             * returns these as AVIF/WebP at a fraction of the source's size.
             */
            src={logoUrl(1)}
            srcSet={`${logoUrl(1)} 1x, ${logoUrl(2)} 2x, ${logoUrl(3)} 3x`}
            /**
             * The file's own dimensions: CSS sets the height and `width:
             * auto`, so what these are for is the aspect ratio the browser
             * reserves space with before the image lands.
             */
            width="2080"
            height="613"
            /**
             * The lockup *is* the shop name set in gold, so this is the
             * store's only h1-adjacent naming — it can't be decorative. The
             * `{shop.name}` text node that used to sit beside it is gone for
             * the same reason: the artwork already reads "GOLD CUSTOM", and
             * rendering both printed it twice.
             */
            alt={shop.name}
          />
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
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {items, total, collection} =
    fetcher.data?.result ?? getEmptyPredictiveSearchResult();
  const showResults = isOpen && term.length > 0;

  // Typing "rope chain" fired ten requests, and their replies could land out of
  // order — a slow answer for "ro" overwriting a fast one for "rope" looks
  // exactly like the search returning the wrong products.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setTerm(value);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) return;
    debounceRef.current = setTimeout(() => {
      void fetcher.submit(
        {q: value, predictive: true},
        {method: 'GET', action: SEARCH_ENDPOINT},
      );
    }, 180);
  }

  function closeResults() {
    setIsOpen(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!term.trim()) return;
    inputRef.current?.blur();
    setIsOpen(false);
    void navigate(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="header-search">
      <form onSubmit={handleSubmit} role="search">
        <input
          aria-label="Search"
          autoComplete="off"
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          onBlur={closeResults}
          placeholder="Search..."
          ref={inputRef}
          type="search"
          /**
           * `defaultValue`, not `value` — this input is server-rendered, and
           * a controlled `value` forces React to overwrite the DOM's actual
           * text with its own state on every re-render of this component.
           * Nothing here ever needs to push a value INTO the box from
           * outside typing (`term` is only ever set by this input's own
           * onChange — grep confirms it), so nothing is lost by letting the
           * browser own it.
           *
           * That overwrite is exactly the bug reported: type fast right as
           * the page loads, before hydration attaches this onChange, and the
           * browser's native input happily takes every keystroke — but
           * `term` is still `''` because React never captured them. The next
           * time ANYTHING causes this component to re-render (a fetch
           * elsewhere resolving, a sibling state change, unrelated context
           * update — it does not have to involve this input at all), React
           * commits `value={term}` back onto the DOM and silently erases
           * every character typed in that window. The caret is still there
           * and still blinking because the input never lost DOM focus — it
           * just lost its own text out from under the person typing it.
           */
          defaultValue={term}
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
              {collection && (
                <Link
                  className="header-search-collection"
                  onClick={closeResults}
                  to={`/collections/${collection.handle}`}
                >
                  <span className="header-search-result-info">
                    <small>Collection</small>
                    <span className="header-search-result-title">
                      {collection.title}
                    </span>
                  </span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              )}
              <ul>
                {items.products.map((product) => {
                  const image = product.selectedOrFirstAvailableVariant?.image;
                  const price = product.selectedOrFirstAvailableVariant?.price;
                  return (
                    <li key={product.id}>
                      <Link
                        onClick={closeResults}
                        to={productCanonicalPath(product)}
                      >
                        {image && (
                          <Image
                            loader={cdnLoader}
                            alt={image.altText ?? ''}
                            aspectRatio="1/1"
                            data={image}
                            width={44}
                            height={44}
                            /* 100 rows render at once; the browser only
                               fetches the handful actually scrolled into. */
                            loading="lazy"
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
              </ul>
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

  // Single source of truth for which department's panel is open — one panel
  // can ever render, so a close-delay on one item can't overlap the next.
  const [openId, setOpenId] = useState<string | null>(null);

  // ONE fetch for the whole bar, not one per department: every panel's cards
  // come from the same curated collection, so eight fetchers would be the same
  // request eight times. Fires on the first hover, so page loads stay clean.
  const displayFetcher = useFetcher<{products: FeaturedProduct[]}>();
  const displayProducts = displayFetcher.data?.products ?? [];

  function openMenu(id: string) {
    setOpenId(id);
    if (!displayFetcher.data && displayFetcher.state === 'idle') {
      displayFetcher.load(
        `/api/collection-products?handle=${DISPLAY_PRODUCTS_HANDLE}&withCollections=1`,
      );
    }
  }

  function closeMenu() {
    setOpenId(null);
  }

  // Leaving this wrapper means the pointer has left both its trigger and panel.
  function scheduleCloseMenu() {
    setOpenId(null);
  }

  if (viewport === 'desktop') {
    return (
      <nav className="header-menu-desktop mega-menu" role="navigation">
        {MEGA_MENU.filter((department) =>
          hasDepartmentItems(header, department),
        ).map((department) => (
          <MegaMenuItem
            department={department}
            displayProducts={displayProducts}
            header={header}
            isOpen={openId === department.id}
            key={department.id}
            onClose={closeMenu}
            onOpen={() => openMenu(department.id)}
            onScheduleClose={scheduleCloseMenu}
            publicStoreDomain={publicStoreDomain}
            relativeUrl={relativeUrl}
          />
        ))}
        {/* Not a MegaMenuItem: /custom-jewelry is a services landing page, not
            a Shopify collection, so it has no menu items for a dropdown to
            show — MegaMenuItem's product-fetching and sub-collection matching
            would all resolve to nothing. A plain link, same class as every
            department's own trigger so it reads as one nav rather than a
            department plus a stray extra. */}
        <NavLink className="header-menu-item" prefetch="intent" to="/custom-jewelry">
          Custom Jewelry
        </NavLink>
      </nav>
    );
  }

  return (
    <MobileMenu header={header} relativeUrl={relativeUrl} onNavigate={close} />
  );
}

/**
 * The one collection the mega menu's product cards come from. The merchant
 * curates it and drags it into the order they want; the menu shows, for each
 * department, the pieces in here that also belong to that department, in this
 * collection's order.
 */
const DISPLAY_PRODUCTS_HANDLE = 'display-products';

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
  /** Only present on the curated "Display Products" payload. */
  collections?: {nodes: Array<{handle: string}>} | null;
};

/** One column, or two balanced ones once the list runs past `max` items. */
function splitInHalf<T>(items: T[], max: number): T[][] {
  if (items.length <= max) return [items];
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}

function MegaMenuItem({
  department,
  displayProducts,
  header,
  isOpen,
  onClose,
  onOpen,
  onScheduleClose,
  publicStoreDomain,
  relativeUrl,
}: {
  department: (typeof MEGA_MENU)[number];
  /** The curated "Display Products" collection, in the merchant's order. */
  displayProducts: FeaturedProduct[];
  header: HeaderProps['header'];
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onScheduleClose: () => void;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
  relativeUrl: (url: string) => string;
}) {
  const fetcher = useFetcher<{products: FeaturedProduct[]}>();
  const handle = department.to.replace('/collections/', '');

  // Load featured products only when the menu is used, keeping the initial
  // page and route navigation free of background requests for every department.
  function loadProducts() {
    if (fetcher.data || fetcher.state !== 'idle') return;
    fetcher.load(`/api/collection-products?handle=${handle}`);
  }

  // SPECIFIC FIRST: a curated piece is claimed by a department through one of
  // that department's sub-categories (`cuban-bracelets`, `diamond-rings`)
  // rather than through the department's own collection, because `rings` and
  // `diamond` are catch-alls holding half the catalog...
  const subHandles = getDepartmentSubCollectionHandles(
    header,
    department,
    publicStoreDomain,
  );
  const featuredProductCount = 3;
  // ...AND THE SUB-CATEGORIES DRIVE THE SEQUENCE. One card per sub-category, in
  // the order the sub-categories are listed in the Shopify menu: card 1 is the
  // first curated piece from the department's first sub-category, card 2 from
  // the second, and so on. `subHandles` is a Set built by walking
  // getDepartmentItems, and a Set iterates in insertion order — so it already
  // carries the menu's own sequence and nothing here has to re-sort.
  //
  // Two passes, because one card per sub-category is the SHAPE, not a hard
  // rule: three sub-categories that only hold two curated pieces between them
  // would otherwise leave a gap.
  const curated: FeaturedProduct[] = [];
  const taken = new Set<string>();
  const claim = (product: FeaturedProduct) => {
    if (curated.length >= featuredProductCount || taken.has(product.id)) return;
    taken.add(product.id);
    curated.push(product);
  };
  const isIn = (product: FeaturedProduct, collectionHandle: string) =>
    product.collections?.nodes?.some((node) => node.handle === collectionHandle);
  // Owned by a department this one yields to — see `yieldsTo` in megaMenu.ts.
  //
  // ONE-WAY, deliberately. An "is it more specific elsewhere?" test that looked
  // at every department was symmetric: Rings dropped the diamond rings and
  // Diamond dropped them right back, because `rings` and `diamond` both list
  // the shared sub-category. A declared winner is the only thing that resolves
  // that, and it is a fact about the departments rather than about a product.
  const ownedElsewhere = (product: FeaturedProduct) =>
    (department.yieldsTo ?? []).some((otherId) => {
      const other = MEGA_MENU.find((entry) => entry.id === otherId);
      if (!other) return false;
      const otherHandle = other.to.replace('/collections/', '');
      return (
        isIn(product, otherHandle) ||
        [
          ...getDepartmentSubCollectionHandles(header, other, publicStoreDomain),
        ].some((subHandle) => isIn(product, subHandle))
      );
    });
  // Every pass runs through this, not just the catch-all: a diamond ring was
  // reaching the Rings panel as a sub-category match, before the catch-all was
  // ever consulted.
  const eligible = displayProducts.filter(
    (product) => !ownedElsewhere(product),
  );

  // Pass 1 — one per sub-category, menu order.
  for (const subHandle of subHandles) {
    const first = eligible.find((product) => isIn(product, subHandle));
    if (first) claim(first);
  }
  // Pass 2 — refill from any remaining curated piece in this department,
  // sub-categories before the general collection. `rings` and `diamond` are
  // catch-alls holding half the catalog, so they stay last: a department that
  // already filled its three never reaches them, which is what stopped those
  // two panels showing six and five.
  for (const product of eligible) {
    if ([...subHandles].some((subHandle) => isIn(product, subHandle))) {
      claim(product);
    }
  }
  for (const product of eligible) {
    if (isIn(product, handle)) claim(product);
  }
  const isLoading = fetcher.state === 'loading' || !fetcher.data;
  // Three cards. The department's own collection is the fallback for a
  // department with nothing curated yet, so a panel still shows cards instead
  // of an empty pane — sliced too, since that one returns the whole collection.
  const featuredProducts = curated.length
    ? curated
    : (fetcher.data?.products ?? []).slice(0, featuredProductCount);
  const productGridCount = featuredProducts.length || featuredProductCount;

  // Warm the actual image bytes into the browser cache as soon as the product
  // data lands, so the shown images render instantly on hover — no wait. Match
  // the sizing the <Image> below requests (width 170, height 213) so it's an
  // exact cache hit; Shopify's CDN honours these query params.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    for (const product of featuredProducts) {
      const url = product.featuredImage?.url;
      if (!url) continue;
      const sized = new URL(url);
      sized.searchParams.set('width', '170');
      sized.searchParams.set('height', '213');
      sized.searchParams.set('crop', 'center');
      new window.Image().src = sized.toString();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, displayProducts]);
  // Grouped BY COLUMN, not one flat list: Chains is fed by three Shopify menus
  // ("Chains 1/2/3") and each one is its own column here, in its own order, so
  // the dropdown matches the admin exactly. getDepartmentColumns also dedupes
  // across the menus and drops empty collections.
  const departmentColumns = getDepartmentColumns(header, department);
  // Departments backed by a single menu still split into two columns once the
  // list gets long — split in half so it reads top-to-bottom, left column then
  // right, rather than zig-zagging across rows.
  const linkGroups =
    departmentColumns.length > 1
      ? departmentColumns
      : splitInHalf(departmentColumns[0] ?? [], 6);

  function closeMegaMenu() {
    onClose();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function openMegaMenu() {
    onOpen();
    loadProducts();
  }

  return (
    <div
      className={`mega-menu-item${isOpen ? ' is-open' : ''}`}
      onBlur={onScheduleClose}
      onFocus={openMegaMenu}
      onMouseEnter={openMegaMenu}
      onMouseLeave={onScheduleClose}
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
            <div className="mega-menu-link-columns">
              {linkGroups.map((group, groupIndex) => (
                <ul className="mega-menu-link-list" key={groupIndex}>
                  {group.map((item) => (
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
              ))}
            </div>
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
            <div
              className="mega-menu-product-grid"
              style={
                {
                  '--mega-product-columns': productGridCount,
                } as React.CSSProperties
              }
            >
              {featuredProducts.length > 0
                ? featuredProducts.map((product) => (
                    <Link
                      className="mega-menu-card"
                      key={product.id}
                      onClick={closeMegaMenu}
                      prefetch="intent"
                      // These are always the active department's own products
                      // (see featuredProducts above), so link into that
                      // collection — same browsing context, and no redirect.
                      to={buildProductPath(handle, product.handle)}
                    >
                      {product.featuredImage ? (
                        <Image
                          loader={cdnLoader}
                          className="mega-menu-card-img"
                          data={product.featuredImage}
                          width={170}
                          height={213}
                          sizes="170px"
                        />
                      ) : (
                        <span className="mega-menu-card-img" />
                      )}
                      <span className="mega-menu-card-title">
                        {product.title}
                      </span>
                      {product.priceRange?.minVariantPrice && (
                        <span className="mega-menu-card-price">
                          <Money
                            data={product.priceRange.minVariantPrice as any}
                          />
                        </span>
                      )}
                    </Link>
                  ))
                : isLoading &&
                  Array.from({length: featuredProductCount}).map((_, index) => (
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
    /**
     * `prefetch="viewport"` rather than "intent" throughout this menu.
     *
     * "intent" prefetches on hover/focus, which a touchscreen never produces
     * before the tap — so on phones it did nothing and every tap paid the full
     * loader round-trip. "viewport" prefetches once a link is actually on
     * screen, and the closed drawer is `visibility: hidden` and translated
     * fully off-viewport, so nothing prefetches until the menu is opened.
     * Opening the menu warms exactly the links the visitor is looking at, and
     * the tap that follows is usually already cached.
     */
    <nav className="header-menu-mobile" role="navigation">
      <NavLink end onClick={onNavigate} prefetch="viewport" to="/">
        Home
      </NavLink>
      {MEGA_MENU.filter((department) =>
        hasDepartmentItems(header, department),
      ).map((department) => {
        const isOpen = openDepartment === department.id;
        return (
          <div className="mobile-nav-department" key={department.id}>
            <div className="mobile-nav-department-header">
              <NavLink
                onClick={onNavigate}
                prefetch="viewport"
                to={department.to}
              >
                {department.label}
              </NavLink>
              <button
                aria-expanded={isOpen}
                aria-label={`Toggle ${department.label} submenu`}
                className="mobile-nav-toggle reset"
                onClick={() => setOpenDepartment(isOpen ? null : department.id)}
                type="button"
              >
                {isOpen ? '−' : '+'}
              </button>
            </div>
            {/* One flat list, through the same deduping helper as the desktop
                mega menu — the phone was showing clover-necklace twice under
                Chains for exactly the same reason.

                The old code mapped the columns separately so each could carry
                a `column.title` heading. No column in MEGA_MENU sets one, so
                that produced a wrapper div per column and nothing else, while
                making cross-column duplicates impossible to spot. Restore the
                grouping when a column actually gets a title — and dedupe
                before splitting. */}
            {isOpen && (
              <div className="mobile-nav-submenu">
                {getDepartmentItems(header, department).map((item) =>
                  item.url ? (
                    <NavLink
                      key={item.id}
                      onClick={onNavigate}
                      prefetch="viewport"
                      to={relativeUrl(item.url)}
                    >
                      {item.title}
                    </NavLink>
                  ) : null,
                )}
              </div>
            )}
          </div>
        );
      })}
      {/* Same reasoning as the desktop nav: /custom-jewelry has no submenu to
          expand, so it is a flat link rather than a mobile-nav-department
          with a +/− toggle that would open onto nothing. */}
      <NavLink onClick={onNavigate} prefetch="viewport" to="/custom-jewelry">
        Custom Jewelry
      </NavLink>
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
      <WishlistToggle />
      <NavLink
        aria-label="Account"
        className="header-cta-link header-cta-icon"
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
      /* Without this the button's only accessible name was the glyph itself —
         an agent or screen reader was told the control is called "☰". */
      aria-label="Open menu"
    >
      {/* Was an <h3>. It was never a heading: it is a glyph on a button, and it
          was the FIRST heading in the document, so every page announced its
          outline as starting at h3 "☰" before reaching the real h1. The class
          reproduces the h3's computed box exactly (18.72px / 600 / block) so
          nothing moves. */}
      <span className="header-burger" aria-hidden="true">
        ☰
      </span>
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

function WishlistToggle() {
  const root = useRouteLoaderData<RootLoader>('root');
  const count = root?.wishlist?.length ?? 0;
  return (
    <NavLink
      aria-label="Wishlist"
      className="header-cta-icon"
      prefetch="intent"
      to="/wishlist"
    >
      <HeartIcon />
      {count > 0 && <span className="header-cart-count">{count}</span>}
    </NavLink>
  );
}

function HeartIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      <span className="header-cart-count">{count === null ? '' : count}</span>
    </a>
  );
}

function SearchIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="7.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="m20 20-4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1L6.6 10.8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="3.75"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M4.5 21a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 8h12l-1 12.5a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6.5a3 3 0 0 1 6 0V8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
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
