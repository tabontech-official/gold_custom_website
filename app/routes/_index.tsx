import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useRef, useState} from 'react';
import type {
  RecommendedProductsQuery,
  NewArrivalsByGenderQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {MarketBar} from '~/components/MarketBar';
import {CoverflowCarousel} from '~/components/CoverflowCarousel';
import {DragScroller} from '~/components/DragScroller';
import {CATEGORIES as CATEGORY_CONFIG} from '~/lib/categories';
import {FaqAccordion} from '~/components/FaqAccordion';
import {FAQS_QUERY, parseFaqs} from '~/lib/faqs';
import {
  VideoCarousel,
  type VideoCarouselItem,
} from '~/components/VideoCarousel';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Fine Jewelry & Watches | Gold Jewelry Co.'}];
};

type HeroContent = {
  heading: string | null;
  images: string[];
  coverImage: string | null;
  // Single portrait image for the mobile hero; null falls back to `images`.
  mobileImage: string | null;
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
  const [
    {collections},
    categoryResponse,
    trustBadgesResponse,
    heroResponse,
    faqsResponse,
  ] = await Promise.all([
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
    context.storefront.query(FAQS_QUERY).catch((error: Error) => {
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
      categoryResponse.charms,
      categoryResponse.diamond,
      categoryResponse.engagementRings,
    ].filter(Boolean),
    trustBadges: parseTrustBadges(trustBadgesResponse),
    hero: parseHeroContent(heroResponse),
    // pages_faqs is the dedicated homepage FAQ source. Collection pages read
    // their own linked metafields instead, so no collection FAQ can leak here.
    faqs: parseFaqs(faqsResponse),
  };
}

// Pull ordered image URLs + heading out of one hero_content entry's fields.
// Images sort by the numeric suffix in their key (image1, image2, …) so they
// stay in author-defined order regardless of API field order.
function extractHeroFields(fields: any): {
  images: string[];
  heading: string | null;
} {
  if (!Array.isArray(fields)) return {images: [], heading: null};

  const imageFields: {order: number; url: string}[] = [];
  let heading: string | null = null;
  for (const field of fields as any[]) {
    const url = field?.reference?.image?.url;
    const rawKey = String(field?.key ?? '');
    const key = rawKey.replace(/[-_\s]+/g, '').toLowerCase();
    if (url) {
      const order = Number(rawKey.match(/(\d+)/)?.[1] ?? imageFields.length + 1);
      imageFields.push({order, url});
    }
    if (
      !heading &&
      field?.value &&
      /^(headline|heading|imageheading)$/.test(key)
    ) {
      heading = field.value;
    }
  }

  return {
    images: imageFields.sort((a, b) => a.order - b.order).map((f) => f.url),
    heading,
  };
}

// Desktop entry drives the rotating banner + heading; the mobile entry's first
// image is the single portrait shown on small screens (null → falls back to the
// desktop banners). See HERO_CONTENT_QUERY.
function parseHeroContent(response: any): HeroContent | null {
  const desktop = extractHeroFields(response?.desktop?.fields);
  const mobile = extractHeroFields(response?.mobile?.fields);
  if (!desktop.images.length && !desktop.heading && !mobile.images.length) {
    return null;
  }

  return {
    heading: desktop.heading,
    images: desktop.images.slice(0, 4),
    coverImage: desktop.images[4] ?? null,
    mobileImage: mobile.images[0] ?? null,
  };
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

  const journalArticles = context.storefront
    .query(HOME_ARTICLES_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  const tiktokVideos = context.storefront
    .query(TIKTOK_VIDEOS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });


  return {
    recommendedProducts,
    bestSellingProducts,
    genderNewArrivals,
    journalArticles,
    tiktokVideos,
  };
}
// The "Tiktok videos" metaobject holds three reference fields pointing at
// individual "tiktok video detail" metaobjects: video_1 is a list (for
// historical reasons), video_2/video_3 are single references. Collect
// whichever of the three are populated into one flat list.
function parseTikTokVideos(response: any): VideoCarouselItem[] {
  const fields = response?.metaobjects?.nodes?.[0]?.fields;
  if (!Array.isArray(fields)) return [];

  const detailRefs: any[] = [];
  for (const field of fields as any[]) {
    if (field?.key === 'video_1' && Array.isArray(field.references?.nodes)) {
      detailRefs.push(...field.references.nodes);
    } else if (field?.reference) {
      detailRefs.push(field.reference);
    }
  }

  return detailRefs
    .map((detail, index): VideoCarouselItem | null => {
      if (!Array.isArray(detail?.fields)) return null;
      const detailFields = detail.fields as any[];
      const videoField: any = detailFields.find((f) => f.key === 'video');
      const descriptionField: any = detailFields.find(
        (f) => f.key === 'description',
      );
      const source = videoField?.reference?.sources?.find(
        (s: any) => s.mimeType === 'video/mp4',
      );
      if (!source?.url) return null;
      return {
        id: detail.id ?? String(index),
        video: source.url,
        poster: videoField.reference?.previewImage?.url ?? null,
        description: descriptionField?.value ?? null,
      };
    })
    .filter((item): item is VideoCarouselItem => item !== null);
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
      <DiamondValueSection image={data.hero?.coverImage ?? null} />
      <FeaturedProducts
        collection={data.featuredCollection}
        bestSelling={data.bestSellingProducts}
      />
      <FaqAccordion faqs={data.faqs} />
      <TikTokVideosSection videos={data.tiktokVideos} />
      <HomeJournal articles={data.journalArticles} />
      <PromiseTicker />
    </div>
  );
}

function Hero({content}: {content: HeroContent | null}) {
  const images = content?.images ?? [];
  const mobileImage = content?.mobileImage ?? null;
  const [active, setActive] = useState(0);
  // Live finger drag: distance dragged (px) while touching, null when idle.
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = startX.current !== null;
  const count = images.length;

  const go = (next: number) => setActive(((next % count) + count) % count);

  // Auto-advance every 5s; the interval resets on each slide change and pauses
  // while the shopper is actively dragging.
  useEffect(() => {
    if (count <= 1 || dragging) return;
    const id = setInterval(() => setActive((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [count, active, dragging]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (count <= 1) return;
    startX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    setDrag(e.touches[0].clientX - startX.current);
  };
  const onTouchEnd = () => {
    if (startX.current === null) return;
    const width = window.innerWidth || 1;
    // Commit to the next/prev slide once the finger passes ~12% of the width.
    if (Math.abs(drag) > width * 0.12) go(active + (drag < 0 ? 1 : -1));
    startX.current = null;
    setDrag(0);
  };

  // Track offset: base slide position plus the live finger drag (as a %).
  const dragPct = dragging ? (drag / (window.innerWidth || 1)) * 100 : 0;
  const offset = -active * 100 + dragPct;

  // First line of the heading renders plain, remaining lines in gold italic.
  const [firstLine, ...restLines] = (content?.heading ?? '')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <>
      <section
        className="hero"
        data-has-mobile={mobileImage ? 'true' : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Single portrait image on mobile; CSS hides it (and shows the
            rotating track) on desktop. Only rendered when the mobile
            hero_content entry has an image — otherwise mobile falls back to
            the desktop banners below. */}
        {mobileImage && (
          <img
            className="hero-mobile-image"
            src={mobileImage}
            alt=""
            aria-hidden="true"
          />
        )}
        {count > 0 && (
          <div
            className="hero-track"
            style={{
              transform: `translate3d(${offset}%, 0, 0)`,
              transition: dragging
                ? 'none'
                : 'transform 750ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            aria-hidden="true"
          >
            {images.map((url, index) => (
              <div
                key={index}
                className="hero-slide"
                style={{backgroundImage: `url(${url})`}}
              />
            ))}
          </div>
        )}
        {count > 1 && (
          <div className="hero-dots" role="tablist" aria-label="Hero slides">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`hero-dot ${index === active ? 'is-active' : ''}`}
                aria-label={`Go to slide ${index + 1}`}
                aria-selected={index === active}
                role="tab"
                onClick={() => go(index)}
              />
            ))}
          </div>
        )}
        <div className="hero-inner">
          {firstLine ? (
            <h1>
              {firstLine}
              {restLines.length > 0 && <span>{restLines.join(' ')}</span>}
            </h1>
          ) : (
            <h1>
             
            </h1>
          )}
        </div>
      </section>
      <MarketBar />
    </>
  );
}

function TikTokVideosSection({
  videos,
}: {
  videos: Promise<any | null>;

}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={videos}>
        {(response) => {
          const items = parseTikTokVideos(response);
          if (!items.length) return null;
          return <VideoCarousel items={items} />;
        }}
      </Await>
    </Suspense>
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
// plain JSON (no JSX). ponytail: don't put React elements in loader data.
// `icon` is a 3D sticker in /public tilted on the right of the card; `signal`
// is the sticker's main hue, mapped to the card's bg tint in app.css. `pill` is
// the status label.
export const TRUST_PROMISES = [
  {
    title: 'Certified Purity',
    pill: 'Assured',
    copy: 'Hallmarked, quality-checked, and documented.',
    icon: '/care.png',
    signal: 'brown',
  },
  {
    title: 'Master Craft',
    pill: 'Handmade',
    copy: 'Refined finishing and secure, comfortable settings.',
    icon: '/handmade.png',
    signal: 'gold',
  },
  {
    title: 'Lifetime Care',
    pill: 'Complimentary',
    copy: 'Free cleaning, inspection, and lasting support.',
    icon: '/purity.png',
    signal: 'amber',
  },
  {
    title: 'Secure Delivery',
    pill: 'Insured',
    copy: 'Fully insured, gift-ready, tracked to your door.',
    icon: '/secure%20delivery.jpg',
    signal: 'green',
  },
];

export function parseTrustBadges(response: any) {
  const fields = response?.metaobject?.fields;
  if (!Array.isArray(fields)) return TRUST_PROMISES;

  const valueByKey = fields.reduce(
    (result: Record<string, string>, field: any) => {
      if (field?.key && typeof field.value === 'string') {
        result[field.key.replace(/[-_]/g, '').toLowerCase()] = field.value;
      }
      return result;
    },
    {},
  );

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
          <h2 className="editorial-title">Our Core Values</h2>
        </div>
        <div className="trust-promise-grid">
          {badges.map((item) => {
            const b = item as (typeof TRUST_PROMISES)[number];
            return (
              <article
                className="trust-promise-card"
                key={item.title}
                data-signal={b.signal ?? 'gold'}
              >
                {b.icon && (
                  <img
                    className="trust-sticker"
                    src={b.icon}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    draggable={false}
                  />
                )}
                {b.pill && (
                  <span className="trust-pill">
                    <span className="trust-pill-dot" aria-hidden="true" />
                    {b.pill}
                  </span>
                )}
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ShopByCategory({
  categories,
}: {
  categories: CategoryTile[] | any[];
}) {
  const publicImages: Record<string, string> = {
    rings: '/gold%20ring.webp',
    chains: '/chain.webp',
    bracelets: '/bracelet.webp',
    earrings: '/earring.webp',
    pendants: '/pandents.webp',
    necklaces: '/neckles.webp',
    diamond: '/dimond.webp',
    'engagement-rings': '/enganment.webp',
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
            image: category.image?.url ?? publicImages[category.handle],
          }))}
        />
      </div>
    </section>
  );
}

const RAIL_BATCH = 8; // products shown initially and revealed per scroll-to-end

// A single-row, swipeable product rail. Renders a batch and appends the next
// batch as the end scrolls into view, so more pieces appear as you scroll.
function ProductRail({
  products,
  ariaLabel,
  emptyMessage = 'No products to show right now.',
}: {
  products: any[];
  ariaLabel: string;
  emptyMessage?: string;
}) {
  const [shown, setShown] = useState(RAIL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when the product set changes (e.g. switching tabs).
  useEffect(() => setShown(RAIL_BATCH), [products]);

  const hasMore = shown < products.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown((s) => Math.min(s + RAIL_BATCH, products.length));
        }
      },
      {rootMargin: '0px 400px'}, // reveal a bit before the true end
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  if (!products.length) {
    return <p className="recommended-products-empty">{emptyMessage}</p>;
  }

  return (
    <DragScroller className="split-rail" ariaLabel={ariaLabel} showScrollbar>
      {products.slice(0, shown).map((product: any, index: number) => (
        <ProductItem
          key={product.id}
          product={product}
          className="split-rail-item"
          loading={index < 4 ? 'eager' : undefined}
        />
      ))}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="split-rail-sentinel"
          aria-hidden="true"
        />
      )}
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
          <div
            className="tab-switch"
            role="tablist"
            aria-label="Product filter"
          >
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
          <Link
            className="editorial-viewall split-viewall"
            to={`/collections/${collection.handle}`}
          >
            View All &rarr;
          </Link>

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

function DiamondValueSection({image}: {image: string | null}) {
  // This is the fourth image from the homepage hero_content metaobject.
  // Do not fall back to a gallery/public asset when it is absent.
  if (!image) return null;

  return (
    <section className="home-section diamond-value-section">
      <div className="section-inner">
        <div className="diamond-value-visual">
          <img
            src={image}
            alt="Diamond jewelry craftsmanship and value assurance"
          />
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
        <div className="split-showcase">
          <div
            className="tab-switch"
            role="tablist"
            aria-label="New arrivals filter"
          >
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
        </div>
      </div>
    </section>
  );
}

function ProductSliderSkeleton() {
  return (
    <div
      className="slider-section product-skeleton-slider"
      aria-label="Loading products"
    >
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
      className={
        className
          ? `product-item product-skeleton ${className}`
          : 'product-item product-skeleton'
      }
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
    products(first: 12) {
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
    charms: collection(handle: "charms") {
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

// Two hero_content entries by handle: `desktop` has the rotating banners +
// heading; `mobile` holds a single portrait image shown on small screens.
// Fetched by handle (not `first: 1`) so the two never get confused.
const HERO_FIELDS_FRAGMENT = `#graphql
  fragment HeroFields on Metaobject {
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
`;

const HERO_CONTENT_QUERY = `#graphql
  query HeroContent($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    desktop: metaobject(
      handle: {type: "hero_content", handle: "hero-content-fbt3hbmk"}
    ) {
      ...HeroFields
    }
    mobile: metaobject(
      handle: {type: "hero_content", handle: "mobile_cover_imagess"}
    ) {
      ...HeroFields
    }
  }
  ${HERO_FIELDS_FRAGMENT}
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
    products(first: 24, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;

// ponytail: 24 fetched up front; the rail reveals them in batches as you
// scroll. Swap to cursor pagination only if a store needs to browse past 24.
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
    products(first: 24, sortKey: BEST_SELLING) {
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
      products(first: 24, sortKey: CREATED, reverse: true) {
        nodes {
          ...GenderArrivalProduct
        }
      }
    }
    mens: collection(handle: "mens") {
      products(first: 24, sortKey: CREATED, reverse: true) {
        nodes {
          ...GenderArrivalProduct
        }
      }
    }
  }
` as const;

type JournalArticle = {
  id: string;
  title: string;
  handle: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  blog: {handle: string};
  image?: {
    id?: string | null;
    altText?: string | null;
    url: string;
    width?: number | null;
    height?: number | null;
  } | null;
};

// Homepage "From the Journal" rail: recent blog articles in a touch/drag
// scroller, reusing the same .blog-card look as the blog pages.
function HomeJournal({
  articles,
}: {
  articles: Promise<{articles: {nodes: JournalArticle[]}} | null>;
}) {
  return (
    <section className="home-section home-journal">
      <div className="section-inner">
        <div className="editorial-heading-row">
          <div className="editorial-heading">
            <h2 className="editorial-title">From the Journal</h2>
          </div>
          <Link className="editorial-viewall" to="/blogs">
            View All &rarr;
          </Link>
        </div>
      </div>
      <Suspense fallback={null}>
        <Await resolve={articles}>
          {(data) => {
            const nodes = data?.articles?.nodes ?? [];
            if (!nodes.length) return null;
            return (
              <DragScroller
                className="home-journal-rail"
                ariaLabel="journal articles"
                showScrollbar
              >
                {nodes.map((article, index) => (
                  <JournalCard
                    key={article.id}
                    article={article}
                    eager={index < 3}
                  />
                ))}
              </DragScroller>
            );
          }}
        </Await>
      </Suspense>
    </section>
  );
}

function JournalCard({
  article,
  eager,
}: {
  article: JournalArticle;
  eager?: boolean;
}) {
  const to = `/blogs/${article.blog.handle}/${article.handle}`;
  const publishedAt = article.publishedAt
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(article.publishedAt))
    : null;
  const excerpt = article.excerpt?.trim();

  return (
    <article className="blog-card home-journal-card">
      <Link className="blog-card-media" to={to} prefetch="intent" tabIndex={-1}>
        {article.image && (
          <img
            src={article.image.url}
            alt={article.image.altText || article.title}
            loading={eager ? 'eager' : 'lazy'}
            draggable={false}
          />
        )}
      </Link>
      <div className="blog-card-body">
        {publishedAt && <time className="blog-card-date">{publishedAt}</time>}
        <h3 className="blog-card-title">
          <Link to={to} prefetch="intent">
            {article.title}
          </Link>
        </h3>
        {excerpt && <p className="blog-card-excerpt">{excerpt}</p>}
        <Link className="blog-card-more" to={to} prefetch="intent">
          Read More &rarr;
        </Link>
      </div>
    </article>
  );
}

// Latest articles across every blog (the store may have just one blog), for the
// homepage Journal rail.
const HOME_ARTICLES_QUERY = `#graphql
  query HomeArticles($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    articles(first: 8, sortKey: PUBLISHED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        excerpt
        publishedAt
        blog {
          handle
        }
        image {
          id
          altText
          url
          width
          height
        }
      }
    }
  }
` as const;

// First (and only) "Tiktok videos" metaobject: video_1 is a list reference,
// video_2/video_3 are single references, all pointing at "tiktok video
// detail" metaobjects (video file + description). See parseTikTokVideos.
const TIKTOK_VIDEOS_QUERY = `#graphql
  fragment TikTokVideoDetail on Metaobject {
    id
    fields {
      key
      value
      reference {
        ... on Video {
          sources {
            url
            mimeType
          }
          previewImage {
            url
          }
        }
      }
    }
  }
  query TikTokVideos($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    metaobjects(type: "tiktok_videos", first: 1) {
      nodes {
        fields {
          key
          value
          reference {
            ... on Metaobject {
              ...TikTokVideoDetail
            }
          }
          references(first: 10) {
            nodes {
              ... on Metaobject {
                ...TikTokVideoDetail
              }
            }
          }
        }
      }
    }
  }
` as const;
