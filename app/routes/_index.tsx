import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useState} from 'react';
import type {
  RecommendedProductsQuery,
  NewArrivalsByGenderQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {MarketBar} from '~/components/MarketBar';
import {CoverflowCarousel} from '~/components/CoverflowCarousel';
import {DragScroller} from '~/components/DragScroller';
import {CATEGORIES as CATEGORY_CONFIG} from '~/lib/categories';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Fine Jewelry & Watches | Gold Jewelry Co.'}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const [{collections}, categoryResponse, trustBadgesResponse, heroResponse] =
    await Promise.all([
      context.storefront.query(FEATURED_COLLECTION_QUERY),
      context.storefront.query(SHOP_BY_CATEGORIES_QUERY),
      context.storefront.query(TRUST_BADGES_QUERY).catch((error: Error) => {
        console.error(error);
        return null;
      }),
      context.storefront.query(HERO_CONTENT_QUERY).catch((error: Error) => {
        console.error(error);
        return null;
      }),
    ]);

  return {
    featuredCollection: collections.nodes[0],
    categories: [
      categoryResponse.rings,
      categoryResponse.chains,
      categoryResponse.bracelets,
      categoryResponse.earrings,
      categoryResponse.pendants,
      categoryResponse.necklaces,
      categoryResponse.diamond,
      categoryResponse.engagementRings,
    ].filter(Boolean),
    trustBadges: parseTrustBadges(trustBadgesResponse),
    hero: parseHeroContent(heroResponse),
  };
}

// Pulls the hero images + heading out of the hero_content metaobject.
// Returns null when the metaobject is missing so the hardcoded hero renders.
function parseHeroContent(response: any) {
  const fields = response?.metaobjects?.nodes?.[0]?.fields;
  if (!Array.isArray(fields)) return null;

  const images: string[] = [];
  let heading: string | null = null;
  for (const field of fields as any[]) {
    const url = field?.reference?.image?.url;
    if (url) images.push(url);
    if (field?.key === 'image_heading' && field?.value) heading = field.value;
  }
  return {heading, images};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  const bestSellingProducts = context.storefront
    .query(BEST_SELLING_PRODUCTS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  const genderNewArrivals = context.storefront
    .query(NEW_ARRIVALS_BY_GENDER_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
    bestSellingProducts,
    genderNewArrivals,
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <Hero content={data.hero} />
      <ShopByCategory categories={data.categories} />
      <TrustPromise badges={data.trustBadges} />
      <RecommendedProducts
        products={data.recommendedProducts}
        genderNewArrivals={data.genderNewArrivals}
      />
      <DiamondValueSection />
      <FeaturedProducts
        collection={data.featuredCollection}
        bestSelling={data.bestSellingProducts}
      />
      <PromiseTicker />
    </div>
  );
}

function Hero({
  content,
}: {
  content: {heading: string | null; images: string[]} | null;
}) {
  const images = content?.images ?? [];
  // First line of the heading renders plain, remaining lines in gold italic.
  const [firstLine, ...restLines] = (content?.heading ?? '')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <>
    <section className="hero">
      {images.length ? (
        images.map((url, index) => (
          <div
            key={index}
            className="hero-bg"
            style={{
              backgroundImage: `url(${url})`,
              ...(images.length > 1
                ? {
                    animationDuration: `${images.length * 5}s`,
                    animationDelay: `${index * 5}s`,
                  }
                : {animation: 'none', opacity: 1}),
            }}
            aria-hidden="true"
          />
        ))
      ) : (
        <>
          <div className="hero-bg hero-bg-cover" aria-hidden="true" />
          <div className="hero-bg hero-bg-cover-alt" aria-hidden="true" />
        </>
      )}
      <div className="hero-inner">
        {firstLine ? (
          <h1>
            {firstLine}
            {restLines.length > 0 && <span>{restLines.join(' ')}</span>}
          </h1>
        ) : (
          <h1>
            Your Moment Your <span>Story in Gold..</span>
          </h1>
        )}
      </div>
    </section>
    <MarketBar />
    </>
  );
}

function PromiseTicker() {
  return (
    <div className="hero-ticker" aria-hidden="false">
      <div className="ticker-track">
        <div className="ticker-group">
          <span>Lifetime Warranty</span>
          <span>Lifetime Upgrade</span>
          <span>Free Shipping &amp; Returns</span>
          <span>0% APR Financing</span>
        </div>
        <div className="ticker-group" aria-hidden="true">
          <span>Lifetime Warranty</span>
          <span>Lifetime Upgrade</span>
          <span>Free Shipping &amp; Returns</span>
          <span>0% APR Financing</span>
        </div>
        <div className="ticker-group" aria-hidden="true">
          <span>Lifetime Warranty</span>
          <span>Lifetime Upgrade</span>
          <span>Free Shipping &amp; Returns</span>
          <span>0% APR Financing</span>
        </div>
      </div>
    </div>
  );
}
type CategoryTile = any;

// Copy only — this crosses the loader serialization boundary, so it must be
// plain JSON (no JSX). Icons live in TRUST_ICONS and are paired by title in
// the component. ponytail: don't put React elements in loader data.
export const TRUST_PROMISES = [
  {
    title: 'Certified Purity',
    copy:
      'Every gold and diamond piece is quality checked, hallmarked, and documented before it reaches your hands.',
  },
  {
    title: 'Master Craft',
    copy:
      'Our jewelers shape each detail with refined finishing, secure settings, and everyday-wear comfort.',
  },
  {
    title: 'Lifetime Care',
    copy:
      'Enjoy professional cleaning, careful inspection, and support designed to keep your jewelry brilliant.',
  },
  {
    title: 'Secure Delivery',
    copy:
      'Your order is packed with care, fully insured in transit, and presented in premium gift-ready packaging.',
  },
];

const TRUST_ICONS: Record<string, React.ReactNode> = {
  'Certified Purity': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 4.5h11L21 9l-9 10L3 9l3.5-4.5Z" />
      <path d="M3 9h18M8 4.5 12 19M16 4.5 12 19" />
    </svg>
  ),
  'Master Craft': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.75a4 4 0 0 1 4 4v2.2a4 4 0 1 1-8 0v-2.2a4 4 0 0 1 4-4Z" />
      <path d="m8.8 14.1-1.2 5.4 4.4-2.2 4.4 2.2-1.2-5.4" />
    </svg>
  ),
  'Lifetime Care': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 19 6v5.2c0 4.3-2.9 7.6-7 9.3-4.1-1.7-7-5-7-9.3V6l7-2.5Z" />
      <path d="m8.8 12 2.1 2.1 4.5-4.7" />
    </svg>
  ),
  'Secure Delivery': (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 8.5 12 4l7.5 4.5v7L12 20l-7.5-4.5v-7Z" />
      <path d="M4.8 8.8 12 13l7.2-4.2M12 13v7" />
    </svg>
  ),
};

export function parseTrustBadges(response: any) {
  const fields = response?.metaobject?.fields;
  if (!Array.isArray(fields)) return TRUST_PROMISES;

  const valueByKey = fields.reduce((result: Record<string, string>, field: any) => {
    if (field?.key && typeof field.value === 'string') {
      result[field.key.replace(/[-_]/g, '').toLowerCase()] = field.value;
    }
    return result;
  }, {});

  const fieldKeys = {
    'Certified Purity': ['purity', 'certifiedpurity'],
    'Master Craft': ['craft', 'mastercraft', 'craftsmanship'],
    'Lifetime Care': ['care', 'lifetimecare'],
    'Secure Delivery': ['delivery', 'securedelivery'],
  };

  return TRUST_PROMISES.map((badge) => {
    const keys = fieldKeys[badge.title as keyof typeof fieldKeys] ?? [];
    const copy = keys.map((key) => valueByKey[key]).find(Boolean);
    return copy ? {...badge, copy} : badge;
  });
}

export function TrustPromise({badges}: {badges: typeof TRUST_PROMISES}) {
  return (
    <section className="home-section trust-promise-section">
      <div className="section-inner">
        <div className="editorial-heading trust-promise-heading">
          <h2 className="editorial-title">
            Four Decades of <em>Trust</em>
          </h2>
          <p>
            Since 1985, Custom Gold has stood for quality, ethics, and
            craftsmanship woven into every piece we create.
          </p>
        </div>
        <div className="trust-promise-grid">
          {badges.map((item) => (
            <article className="trust-promise-card" key={item.title}>
              <span className="trust-promise-icon">{TRUST_ICONS[item.title]}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ShopByCategory({categories}: {categories: CategoryTile[] | any[]}) {
  const publicImages: Record<string, string> = {
    rings: '/gold%20ring.jpg',
    chains: '/chain.jpg',
    bracelets: '/bracelet.jpg',
    earrings: '/earring.jpg',
    pendants: '/pandents.jpg',
    necklaces: '/neckles.jpg',
    diamond: '/dimond.jpg',
    'engagement-rings': '/enganment.jpg',
  };
  return (
    <section className="home-section">
      <div className="section-inner">
        <div className="editorial-heading">
          <h2 className="editorial-title">Shop by Category</h2>
        </div>
        <CoverflowCarousel
          items={categories.map((category) => ({
            id: category.id,
            title: category.title,
            handle: category.handle,
            image: publicImages[category.handle] ?? category.image?.url,
          }))}
        />
      </div>
    </section>
  );
}

// A single-row, swipeable product rail with the thin iOS scrollbar.
function ProductRail({
  products,
  ariaLabel,
  emptyMessage = 'No products to show right now.',
}: {
  products: any[];
  ariaLabel: string;
  emptyMessage?: string;
}) {
  if (!products.length) {
    return <p className="recommended-products-empty">{emptyMessage}</p>;
  }
  return (
    <DragScroller
      className="split-rail"
      ariaLabel={ariaLabel}
      showButtons
      showScrollbar
    >
      {products.map((product: any, index: number) => (
        <ProductItem
          key={product.id}
          product={product}
          className="split-rail-item"
          loading={index < 4 ? 'eager' : undefined}
        />
      ))}
    </DragScroller>
  );
}

// Split featured section: a small trust-building intro on the left, a
// horizontally scrollable product showcase on the right. Two tabs switch the
// rail between the featured collection and best sellers.
function FeaturedProducts({
  collection,
  bestSelling,
}: {
  collection: any;
  bestSelling: Promise<{products: {nodes: any[]}} | null>;
}) {
  const [tab, setTab] = useState<'featured' | 'best'>('featured');
  if (!collection) return null;
  const featuredNodes = collection.products?.nodes ?? [];

  return (
    <section className="home-section featured-split">
      <div className="section-inner">
        <div className="editorial-heading-row">
          <div className="editorial-heading">
            <h2 className="editorial-title">Complete the Look</h2>
          </div>
        </div>
        <div className="split-showcase">
          <div className="tab-switch" role="tablist" aria-label="Product filter">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'featured'}
              className={`tab-switch-btn${tab === 'featured' ? ' is-active' : ''}`}
              onClick={() => setTab('featured')}
            >
              Featured
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'best'}
              className={`tab-switch-btn${tab === 'best' ? ' is-active' : ''}`}
              onClick={() => setTab('best')}
            >
              Best Selling
            </button>
          </div>
          <Link className="editorial-viewall split-viewall" to={`/collections/${collection.handle}`}>
            View All &rarr;
          </Link>
          <div className="split-intro">
            <h3 className="split-intro-title">Built to Become an Heirloom</h3>
            <p className="split-intro-copy">
              Every piece is hand-finished in our atelier, cast in solid gold,
              and backed by a lifetime warranty &mdash; jewelry made to be
              passed down, not just worn.
            </p>
            <Link
              className="split-intro-cta"
              to={`/collections/${collection.handle}`}
            >
              Explore {collection.title} &rarr;
            </Link>
          </div>

          {tab === 'featured' ? (
            <ProductRail
              products={featuredNodes}
              ariaLabel="featured products"
              emptyMessage="Featured products are loading right now."
            />
          ) : (
            <Suspense fallback={<ProductSliderSkeleton />}>
              <Await resolve={bestSelling}>
                {(response) => (
                  <ProductRail
                    products={response?.products.nodes ?? []}
                    ariaLabel="best selling products"
                    emptyMessage="Best sellers are loading right now."
                  />
                )}
              </Await>
            </Suspense>
          )}
        </div>
      </div>
    </section>
  );
}

function DiamondValueSection() {
  return (
    <section className="home-section diamond-value-section">
      <div className="section-inner">
        <div className="diamond-value-visual">
          <img
            src="/cover%202.jpg"
            alt="Diamond jewelry craftsmanship and value assurance"
          />
          <h2 className="diamond-value-heading is-left">
            <span>Certified</span> Diamonds. Lasting <span>Value</span>.
          </h2>
        </div>
      </div>
    </section>
  );
}

// New Arrivals: editorial title above a single-row scroll rail, with a
// trust-building panel on the right (mirrors FeaturedProducts). Tabs filter
// the rail to All / Women / Men.
function RecommendedProducts({
  products,
  genderNewArrivals,
}: {
  products: Promise<RecommendedProductsQuery | null>;
  genderNewArrivals: Promise<NewArrivalsByGenderQuery | null>;
}) {
  const [tab, setTab] = useState<'all' | 'women' | 'men'>('all');
  const viewAllHref =
    tab === 'women'
      ? '/collections/womens'
      : tab === 'men'
        ? '/collections/mens'
        : '/collections/all';

  return (
    <section className="home-section new-arrivals">
      <div className="section-inner">
        <div className="editorial-heading-row">
          <div className="editorial-heading">
            <h2 className="editorial-title">New Arrivals</h2>
          </div>
        </div>
        <div className="split-showcase is-reversed">
          <div className="tab-switch" role="tablist" aria-label="New arrivals filter">
            {(['all', 'women', 'men'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={`tab-switch-btn${tab === value ? ' is-active' : ''}`}
                onClick={() => setTab(value)}
              >
                {value === 'all' ? 'All' : value === 'women' ? 'Women' : 'Men'}
              </button>
            ))}
          </div>
          <Link className="editorial-viewall split-viewall" to={viewAllHref}>
            View All &rarr;
          </Link>
          {tab === 'all' ? (
            <Suspense fallback={<ProductSliderSkeleton />}>
              <Await resolve={products}>
                {(response) => (
                  <ProductRail
                    products={response?.products.nodes ?? []}
                    ariaLabel="new arrivals"
                    emptyMessage="New arrivals are loading or unavailable right now."
                  />
                )}
              </Await>
            </Suspense>
          ) : (
            <Suspense fallback={<ProductSliderSkeleton />}>
              <Await resolve={genderNewArrivals}>
                {(response) => (
                  <ProductRail
                    products={
                      (tab === 'women'
                        ? response?.womens?.products?.nodes
                        : response?.mens?.products?.nodes) ?? []
                    }
                    ariaLabel={`${tab} new arrivals`}
                    emptyMessage="New arrivals are loading or unavailable right now."
                  />
                )}
              </Await>
            </Suspense>
          )}

          <div className="split-intro">
            <span className="eyebrow">Customer Love</span>
            <h3 className="split-intro-title">Trusted by Thousands</h3>
            <p className="split-intro-copy">
              Rated 4.9 out of 5 by over 12,000 customers, every order ships
              fully insured with a 30-day no-questions-asked return policy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductSliderSkeleton() {
  return (
    <div className="slider-section product-skeleton-slider" aria-label="Loading products">
      <div className="slider-track">
        {Array.from({length: 4}).map((_, index) => (
          <ProductCardSkeleton key={index} className="slider-item" />
        ))}
      </div>
    </div>
  );
}

function ProductCardSkeleton({className}: {className?: string}) {
  return (
    <article
      className={className ? `product-item product-skeleton ${className}` : 'product-item product-skeleton'}
    >
      <div className="product-image-skeleton" />
      <div className="product-card-body">
        <div className="product-text-skeleton is-title" />
        <div className="product-text-skeleton is-price" />
      </div>
    </article>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
    products(first: 50) {
      nodes {
        id
        title
        handle
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        featuredImage {
          id
          url
          altText
          width
          height
        }
        selectedOrFirstAvailableVariant {
          id
          availableForSale
        }
      }
    }
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

export const SHOP_BY_CATEGORIES_QUERY = `#graphql
  fragment CategoryCollection on Collection {
    id
    title
    handle
    image {
      url
      altText
    }
  }
  query ShopByCategories($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    rings: collection(handle: "rings") {
      ...CategoryCollection
    }
    chains: collection(handle: "chains") {
      ...CategoryCollection
    }
    bracelets: collection(handle: "bracelets") {
      ...CategoryCollection
    }
    earrings: collection(handle: "earrings") {
      ...CategoryCollection
    }
    pendants: collection(handle: "pendants") {
      ...CategoryCollection
    }
    necklaces: collection(handle: "necklaces") {
      ...CategoryCollection
    }
    diamond: collection(handle: "diamond") {
      ...CategoryCollection
    }
    engagementRings: collection(handle: "engagement-rings") {
      ...CategoryCollection
    }
  }
` as const;

export const TRUST_BADGES_QUERY = `#graphql
  query TrustBadges($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    metaobject(
      handle: {
        type: "trust_badges_data"
        handle: "trust-badges-data-qgta9zi1"
      }
    ) {
      fields {
        key
        value
      }
    }
  }
` as const;


// First (and only) hero_content metaobject entry: 3 rotating images + heading.
const HERO_CONTENT_QUERY = `#graphql
  query HeroContent($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    metaobjects(type: "hero_content", first: 1) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image {
                url
                altText
              }
            }
          }
        }
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 50, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;

// ponytail: 50 products per tab is effectively endless for a horizontal rail.
// Swap to cursor pagination + fetch-on-scroll-end only if a real store ever
// needs to browse past 50 here.
const BEST_SELLING_PRODUCTS_QUERY = `#graphql
  fragment BestSellingProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query BestSellingProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 50, sortKey: BEST_SELLING) {
      nodes {
        ...BestSellingProduct
      }
    }
  }
` as const;

// Newest products in the Women's / Men's collections, for the New Arrivals tabs.
const NEW_ARRIVALS_BY_GENDER_QUERY = `#graphql
  fragment GenderArrivalProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query NewArrivalsByGender($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    womens: collection(handle: "womens") {
      products(first: 50, sortKey: CREATED, reverse: true) {
        nodes {
          ...GenderArrivalProduct
        }
      }
    }
    mens: collection(handle: "mens") {
      products(first: 50, sortKey: CREATED, reverse: true) {
        nodes {
          ...GenderArrivalProduct
        }
      }
    }
  }
` as const;
