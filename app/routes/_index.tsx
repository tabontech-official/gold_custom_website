import {
  Await,
  useLoaderData,
  Link,
  useRouteLoaderData,
} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useRef, useState, useEffect} from 'react';
import {Image} from '@shopify/hydrogen';
import {useDragScroll} from '~/hooks/useDragScroll';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {FeatureStrip} from '~/components/FeatureStrip';
import {ProductSlider} from '~/components/ProductSlider';
import {CATEGORIES as CATEGORY_CONFIG} from '~/lib/categories';
import {
  getMegaMenuDepartmentForHandle,
  getColumnItems,
  toRelativeUrl,
} from '~/lib/megaMenu';

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
  const [{collections}, categoryResponse] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    context.storefront.query(SHOP_BY_CATEGORIES_QUERY),
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

  return {
    recommendedProducts,
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  const root = useRouteLoaderData('root') as any;
  const header = root?.header;
  const publicStoreDomain = root?.publicStoreDomain;
  const primaryDomainUrl = header?.shop?.primaryDomain?.url;
  return (
    <div className="home">
      <Hero />
      <FeatureStrip />
      <ShopByCategory
        categories={data.categories}
        header={header}
        primaryDomainUrl={primaryDomainUrl}
        publicStoreDomain={publicStoreDomain}
      />
      <FeaturedCollection collection={data.featuredCollection} />
      <RecommendedProducts products={data.recommendedProducts} />
      <FeatureStrip />
      <Showroom />
      <SocialStrip />
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg hero-bg-cover" aria-hidden="true" />
      <div className="hero-bg hero-bg-cover-alt" aria-hidden="true" />
      <div className="hero-inner">
        <span className="eyebrow hero-eyebrow">Summer Event</span>
        <h1>Up to 45% Off Fine Jewelry</h1>
        <p>
          Solid gold chains, diamond pendants, and luxury watches &mdash;
          crafted for every moment that matters. Use code JULY15 at checkout.
        </p>
        <div className="hero-ctas">
          <Link to="/collections/mens" className="btn btn-primary">
            Shop Men&rsquo;s
          </Link>
          <Link to="/collections/womens" className="btn btn-outline">
            Shop Women&rsquo;s
          </Link>
        </div>
            <div className="hero-ticker" aria-hidden="false">
              <div className="ticker-track">
                <span>Lifetime Warranty ⤴</span>
                <span>Lifetime Upgrade</span>
                <span>Free Shipping &amp; Returns 🚚</span>
                <span>0% APR Financing</span>
                <span>Lifetime Warranty ⤴</span>
                <span>Lifetime Upgrade</span>
                <span>Free Shipping &amp; Returns 🚚</span>
                <span>0% APR Financing</span>
              </div>
            </div>
      </div>
    </section>
  );
}

type CategoryTile = any;

function ShopByCategory({
  categories,
  header,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  categories: CategoryTile[] | any[];
  header?: any;
  primaryDomainUrl?: string;
  publicStoreDomain?: string;
}) {
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
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  useDragScroll(categoryTrackRef);
  return (
    <>
      <section className="home-section">
        <div className="section-inner">
          <div className="home-section-heading">
            <span className="eyebrow">Explore</span>
            <h2>Shop by Category</h2>
          </div>
          <div className="category-carousel">
            <div className="category-carousel-viewport">
              <div className="category-carousel-track" ref={categoryTrackRef}>
                {categories.map((category) => {
                const publicSrc = publicImages[category.handle];
                return (
                  <Link
                    key={category.id}
                    to={`/collections/${category.handle}`}
                    className="category-tile carousel-item"
                  >
                    {publicSrc ? (
                      <img
                        src={publicSrc}
                        alt={category.title}
                        className="category-tile-image"
                      />
                    ) : category.image?.url ? (
                      <Image
                        data={category.image}
                        alt={category.image.altText ?? category.title}
                        aspectRatio="4/3"
                        className="category-tile-image"
                        sizes="(max-width: 40em) 100vw, 18vw"
                      />
                    ) : (
                      <span className="category-tile-circle" aria-hidden="true">
                        {category.title.charAt(0)}
                      </span>
                    )}
                    <span>{category.title}</span>
                  </Link>
                );
              })}
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three interactive category product sections: Rings, Chains, Bracelets */}
      {(() => {
        const rings = categories.find((c) => c.handle === 'rings');
        const chains = categories.find((c) => c.handle === 'chains');
        const bracelets = categories.find((c) => c.handle === 'bracelets');
        return (
          <>
            {rings && (
              <CategoryProductsSection
                collection={rings}
                header={header}
                primaryDomainUrl={primaryDomainUrl}
                publicStoreDomain={publicStoreDomain}
              />
            )}
            {chains && (
              <CategoryProductsSection
                collection={chains}
                header={header}
                primaryDomainUrl={primaryDomainUrl}
                publicStoreDomain={publicStoreDomain}
              />
            )}
            {bracelets && (
              <CategoryProductsSection
                collection={bracelets}
                header={header}
                primaryDomainUrl={primaryDomainUrl}
                publicStoreDomain={publicStoreDomain}
              />
            )}
          </>
        );
      })()}
    </>
  );
}

function CategoryProductsSection({
  collection,
  header,
  primaryDomainUrl,
  publicStoreDomain,
}: any) {
  const [selectedTag, setSelectedTag] = useState('All Products');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive submenu items from the header mega menu mapping
  const department = getMegaMenuDepartmentForHandle(collection.handle);
  let submenuItems: any[] = [];
  if (department && header) {
    department.columns.forEach((column) => {
      const items = getColumnItems(header, column) || [];
      submenuItems = submenuItems.concat(items.filter(Boolean));
    });
  }

  const tags = ['All Products', ...submenuItems.map((s) => s.title)];

  async function fetchProductsFor(handle: string, tag?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({handle});
      if (tag) params.set('tag', tag);
      const res = await fetch(`/api/collection-products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const json = (await res.json()) as any;
      setProducts(json.products || []);
    } catch (err: any) {
      setError(err.message || String(err));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial load: all products for the collection
  useEffect(() => {
    fetchProductsFor(collection.handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmenuClick(item: any) {
    // Use the header's link; convert to relative and parse collection handle / tag
    const rel = toRelativeUrl(item.url || '', primaryDomainUrl || '', publicStoreDomain || '');
    try {
      const parsed = new URL(rel, 'http://example.com');
      const parts = parsed.pathname.split('/').filter(Boolean);
      let handle = collection.handle;
      let tag: string | undefined;
      if (parts[0] === 'collections' && parts[1]) {
        handle = parts[1];
      }
      // Prefer explicit tag query param
      if (parsed.searchParams.get('tag')) {
        tag = parsed.searchParams.get('tag') || undefined;
      } else if (!item.url) {
        // No URL — use the title as a tag
        tag = item.title;
      }

      setSelectedTag(item.title || 'All Products');
      // If the submenu points to a different collection page, fetch that collection (no tag)
      if (parts[0] === 'collections' && parts[1] && parts[1] !== collection.handle && !tag) {
        fetchProductsFor(parts[1]);
      } else {
        fetchProductsFor(handle, tag);
      }
    } catch (e) {
      // fallback: use item title as tag on same collection
      setSelectedTag(item.title || 'All Products');
      fetchProductsFor(collection.handle, item.title);
    }
  }

  return (
    <section className="home-section">
      <div className="section-inner">
        <div className="home-section-heading">
          <span className="eyebrow">{collection.title}</span>
          <h2>{collection.title}</h2>
        </div>

        <div className="category-tags">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`category-tag ${selectedTag === tag ? 'is-active' : ''}`}
              onClick={() => {
                if (tag === 'All Products') {
                  setSelectedTag(tag);
                  fetchProductsFor(collection.handle);
                } else {
                  // find submenu item by title and handle click to preserve exact link handling
                  const found = submenuItems.find((s) => s.title === tag);
                  if (found) handleSubmenuClick(found);
                  else {
                    setSelectedTag(tag);
                    fetchProductsFor(collection.handle, tag);
                  }
                }
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {loading ? (
          <ProductSliderSkeleton />
        ) : error ? (
          <p style={{color: 'var(--color-sale)'}}>{error}</p>
        ) : (
          <ProductSlider
            eyebrow={collection.title}
            heading={collection.title}
            products={products}
            showArrows={false}
            showHeading={false}
          />
        )}
      </div>
    </section>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  if (!collection) return null;
  const image = collection?.image;
  return (
    <section className="home-section is-soft">
      <div className="section-inner">
        <div className="home-section-heading">
          <span className="eyebrow">Curated</span>
          <h2>Featured Collection</h2>
        </div>
        <Link
          className="featured-collection"
          to={`/collections/${collection.handle}`}
        >
          <div className="featured-collection-image">
            {image && <Image data={image} sizes="100vw" />}
          </div>
          <div className="featured-collection-caption">
            <h2>{collection.title}</h2>
          </div>
        </Link>
      </div>
    </section>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <section className="home-section">
      <div className="section-inner">
        <div className="home-section-heading">
          <span className="eyebrow">Best Sellers</span>
          <h2>New Arrivals</h2>
        </div>
        <Suspense fallback={<RecommendedProductsSkeleton />}>
          <Await resolve={products}>
            {(response) => (
              <div className="recommended-products-grid">
                {response
                  ? response.products.nodes.map((product) => (
                      <ProductItem
                        key={product.id}
                        product={product}
                        className="recommended-product"
                      />
                    ))
                  : null}
              </div>
            )}
          </Await>
        </Suspense>
        <div className="home-section-footer">
          <Link to="/collections/all" className="btn btn-outline">
            View All Products
          </Link>
        </div>
      </div>
    </section>
  );
}

function Showroom() {
  return (
    <section className="showroom" id="showroom">
      <div className="showroom-inner">
        <span className="eyebrow" style={{color: 'var(--color-gold)'}}>
          Visit Us
        </span>
        <h2>Where Luxury Comes to Life</h2>
        <p>
          Visit our exclusive NYC showroom and discover our stunning
          collection in person, with a personal stylist by your side.
        </p>
        <p className="showroom-address">
          10 W 46th St, Floor 17, New York, NY 10036
        </p>
        <a href="mailto:info@bayamjewelry.com" className="btn btn-primary on-dark">
          Book an Appointment
        </a>
      </div>
    </section>
  );
}

function SocialStrip() {
  return (
    <section className="home-section social-strip">
      <div className="section-inner">
        <span className="eyebrow">@yourjewelry</span>
        <h2>Follow Us on Instagram</h2>
        <div className="social-strip-icons">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
            IG
          </a>
          <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
            FB
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok">
            TT
          </a>
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

function RecommendedProductsSkeleton() {
  return (
    <div className="recommended-products-grid" aria-label="Loading products">
      {Array.from({length: 4}).map((_, index) => (
        <ProductCardSkeleton key={index} className="recommended-product" />
      ))}
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

const SHOP_BY_CATEGORIES_QUERY = `#graphql
  fragment CategoryCollection on Collection {
    id
    title
    handle
    image {
      url
      altText
    }
    products(first: 24) {
      nodes {
        id
        title
        handle
        tags
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
      }
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
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
