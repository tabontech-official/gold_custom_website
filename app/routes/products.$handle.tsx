import {Suspense} from 'react';
import {
  redirect,
  useLoaderData,
  useNavigate,
  Await,
  Link,
  useLocation,
  useRouteLoaderData,
} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import type {ProductRecommendationsQuery} from 'storefrontapi.generated';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery, type GalleryMedia} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {GoogleReviewsSection} from '~/components/GoogleReviewsSection';
import {HorizontalCarousel} from '~/components/HorizontalCarousel';
import {ProductItem} from '~/components/ProductItem';
import {Breadcrumb} from '~/components/Breadcrumb';
import {useWishlistToggle} from '~/hooks/useWishlistToggle';
import {CATEGORIES} from '~/lib/categories';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';

export const meta: Route.MetaFunction = ({data}) => {
  const title = data?.product.title || '';
  const description =
    data?.product.seo?.description || data?.product.description || '';

  return [
    {title: title ? `${title} | Gold Custom` : 'Gold Custom'},
    {
      name: 'description',
      content: description,
    },
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  // Sibling "length" articles (deferred — never blocks the page).
  const lengthArticles = loadLengthArticles(args.context, criticalData.product);

  return {...deferredData, ...criticalData, lengthArticles};
}

/**
 * Many chains/necklaces exist as separate products per length (16", 18" …).
 * Find those siblings by matching every product whose title is identical once
 * the length is stripped out, so the shopper can jump straight to any length.
 */
function parseLength(text: string) {
  // Matches "16 Inches", "26-Inches", "22 Inch", "26in", "18\"", "18”" etc.
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*-?\s*(?:inch(?:es)?\b|in\b|["”″])/i,
  );
  if (!match) return null;
  const length = parseFloat(match[1]);
  const baseKey = text
    .replace(match[0], ' ')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {length, baseKey};
}

type LengthArticles = {
  current: number;
  options: Array<{handle: string; length: number}>;
};

function loadLengthArticles(
  context: Route.LoaderArgs['context'],
  product: {title: string; handle: string},
): Promise<LengthArticles | null> {
  const info = parseLength(product.title);
  if (!info) return Promise.resolve(null);

  return context.storefront
    .query(SIBLING_PRODUCTS_QUERY, {variables: {query: info.baseKey}})
    .then((res: any) => {
      const nodes: Array<{handle: string; title: string}> =
        res?.products?.nodes ?? [];
      const seen = new Set<number>();
      const options = nodes
        .map((node) => {
          const parsed = parseLength(node.title);
          if (!parsed || parsed.baseKey !== info.baseKey) return null;
          if (seen.has(parsed.length)) return null;
          seen.add(parsed.length);
          return {handle: node.handle, length: parsed.length};
        })
        .filter((item): item is {handle: string; length: number} => item !== null)
        .sort((a, b) => a.length - b.length);

      return options.length > 1 ? {current: info.length, options} : null;
    })
    .catch(() => null);
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
  context,
  params,
  request,
}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;
  const url = new URL(request.url);
  const routeParams = params as Route.LoaderArgs['params'] & {
    category?: string;
    subcategory?: string;
  };

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  const breadcrumbContext = getBreadcrumbContext(
    url.searchParams,
    routeParams,
  );
  const inferredCategory = getProductCategoryMatch(product);
  if (!routeParams.category && (breadcrumbContext?.categoryHandle || inferredCategory)) {
    const categoryHandle =
      breadcrumbContext?.categoryHandle ?? inferredCategory?.handle;
    if (categoryHandle) {
      const nextPath = buildHierarchicalProductPath({
        handle: product.handle,
        categoryHandle,
        subcategoryHandle: breadcrumbContext?.subcategoryHandle,
      });
      throw redirect(`${nextPath}${url.search}`);
    }
  }

  return {
    product,
    breadcrumbContext,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  // Related products — fetched after first paint so they never block the page.
  const recommendedProducts = context.storefront
    .query(PRODUCT_RECOMMENDATIONS_QUERY, {
      variables: {productHandle: params.handle},
    })
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  return {recommendedProducts};
}

export default function Product() {
  const {product, recommendedProducts, lengthArticles, breadcrumbContext} =
    useLoaderData<typeof loader>();
  const root = useRouteLoaderData<any>('root');

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml, vendor} = product;
  const mediaItems = normalizeMedia(product.media?.nodes ?? [], title);
  const productJsonLd = buildProductJsonLd({
    product,
    selectedVariant,
    mediaItems,
    baseUrl: getStoreBaseUrl(root),
  });
  const rawCategory = product.category?.name || product.productType || '';
  const categoryName =
    rawCategory && rawCategory.toLowerCase() !== 'uncategorized'
      ? rawCategory
      : '';
  const sku = selectedVariant?.sku?.trim();

  // Resolve the category to a shoppable collection so the crumb is clickable.
  // Shopify taxonomy names look like "Necklaces in Jewelry", so we match on
  // containment as well as exact label/handle.
  const categoryMatch = getProductCategoryMatch(product);
  const contextCategory = breadcrumbContext?.categoryHandle
    ? {
        label:
          breadcrumbContext.categoryName ||
          breadcrumbContext.categoryHandle,
        to: `/collections/${breadcrumbContext.categoryHandle}`,
      }
    : null;
  const contextSubcategory = breadcrumbContext?.subcategoryHandle
    ? {
        label:
          breadcrumbContext.subcategoryName ||
          breadcrumbContext.subcategoryHandle,
        to: `/collections/${breadcrumbContext.subcategoryHandle}`,
      }
    : null;

  const breadcrumbs = [
    {label: 'Home', to: '/'},
    {label: 'Shop', to: '/collections/all'},
    ...(contextCategory
      ? [contextCategory]
      : categoryName
      ? [
          {
            label: categoryMatch?.label ?? categoryName,
            to: categoryMatch
              ? `/collections/${categoryMatch.handle}`
              : undefined,
          },
        ]
      : []),
    contextSubcategory,
    {label: title},
  ];

  const similarCollectionTo = categoryMatch
    ? `/collections/${categoryMatch.handle}`
    : '/collections/all';

  return (
    <div className="product">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: JSON.stringify(productJsonLd)}}
      />

      <Breadcrumb items={breadcrumbs} />

      <div className="product-layout">
        <ProductGallery
          media={mediaItems}
          selectedImageUrl={selectedVariant?.image?.url}
          title={title}
        />

        <div className="product-main">
          <h1>{title}</h1>
          {sku && <p className="product-sku">SKU / Style Code: {sku}</p>}
          <div className="product-price-row">
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
          </div>

          <Suspense fallback={null}>
            <Await resolve={lengthArticles}>
              {(data) => <LengthArticleSelect data={data} />}
            </Await>
          </Suspense>

          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
            wishlistButton={<ProductWishlistButton handle={product.handle} />}
          />

          <ProductAccordions
            vendor={vendor}
            categoryName={categoryName}
            sku={sku}
            descriptionHtml={descriptionHtml}
            selectedVariant={selectedVariant}
          />
          <ProductTrustBadges />

          <div className="product-note">
            <h3>Important Note</h3>
            <p>
              Solid gold is a soft precious metal. Store this piece separately,
              keep it away from perfume and chlorine, and polish it with a soft
              cloth. Custom or engraved pieces are crafted to order and may add
              5–7 business days before shipping.
            </p>
          </div>
        </div>
      </div>

      <ProductFaqSection
        faqs={buildFaqs(product, selectedVariant, categoryName)}
      />

      <RelatedProducts
        products={recommendedProducts}
        viewAllTo={similarCollectionTo}
      />

      <GoogleReviewsSection />

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

function ProductWishlistButton({handle}: {handle: string}) {
  const {fetcher, active} = useWishlistToggle(handle);

  return (
    <fetcher.Form method="post" action="/wishlist">
      <input type="hidden" name="handle" value={handle} />
      <button
        type="submit"
        className={`product-page-wishlist ${active ? 'is-active' : ''}`}
        aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={active}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </fetcher.Form>
  );
}

function ProductAccordions({
  vendor,
  categoryName,
  sku,
  descriptionHtml,
  selectedVariant,
}: {
  vendor?: string | null;
  categoryName: string;
  sku?: string | null;
  descriptionHtml?: string | null;
  selectedVariant: any;
}) {
  const specs = [
    {label: 'Brand', value: vendor?.trim() || 'Gold Jewelry Co.'},
    {label: 'Category', value: categoryName || 'Fine Jewelry'},
    {label: 'SKU', value: sku?.trim() || 'Available on request'},
    {label: 'Variant', value: selectedVariant?.title || 'Default selection'},
    {
      label: 'Availability',
      value: selectedVariant?.availableForSale
        ? 'In stock'
        : 'Check availability',
    },
  ];

  return (
    <div className="product-accordions">
      <details className="product-details" open>
        <summary>Product Details</summary>
        <div className="product-details-body">
          {descriptionHtml ? (
            <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
          ) : (
            <p>Details for this piece will be updated soon.</p>
          )}
        </div>
      </details>

      <details className="product-details">
        <summary>Specifications</summary>
        <div className="product-details-body">
          <dl className="product-spec-list">
            {specs.map((spec) => (
              <div className="product-spec-row" key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>

      <details className="product-details">
        <summary>Material</summary>
        <div className="product-details-body">
          <p>
            Crafted from real precious metals and inspected before shipping.
            Metal, stone, and finish details follow the selected variant and
            product specifications above.
          </p>
        </div>
      </details>
      <details className="product-details">
        <summary>Exchanges/Returns</summary>
        <div className="product-details-body">
          <p>
            Eligible ready-to-ship pieces can be exchanged or returned according
            to our store policy. Custom, resized, or engraved pieces may be
            final sale.
          </p>
        </div>
      </details>
    </div>
  );
}

function ProductTrustBadges() {
  const badges = [
    {
      title: 'Free U.S. Shipping',
      sub: 'On orders over $99',
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M8 20h28v25H8" />
          <path d="M36 28h10l8 9v8H36" />
          <path d="M14 48a5 5 0 1 0 10 0 5 5 0 0 0-10 0ZM43 48a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z" />
          <path d="M3 28h16M6 36h13" />
        </svg>
      ),
    },
    {
      title: '30 Day Returns',
      sub: 'No questions asked',
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M18 45h28l-5-16H23l-5 16Z" />
          <path d="M27 45h28l-6-16h-8" />
          <path d="M32 8v9M15 14l6 7M49 14l-6 7" />
        </svg>
      ),
    },
    {
      title: 'Made in U.S.A',
      sub: 'From our factory to you',
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 58s18-17 18-33a18 18 0 0 0-36 0c0 16 18 33 18 33Z" />
          <circle cx="32" cy="25" r="7" />
        </svg>
      ),
    },
    {
      title: '1 Year Free Warranty',
      sub: 'On all production defects',
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 6 50 13v14c0 15-8 25-18 31-10-6-18-16-18-31V13l18-7Z" />
          <path d="m23 32 6 6 13-15" />
        </svg>
      ),
    },
  ];

  return (
    <div className="product-trust-badges" aria-label="Product trust badges">
      {badges.map((badge) => (
        <div className="product-trust-badge" key={badge.title}>
          <span className="product-trust-icon">{badge.icon}</span>
          <span className="product-trust-title">{badge.title}</span>
          <span className="product-trust-sub">{badge.sub}</span>
        </div>
      ))}
    </div>
  );
}

type Faq = {question: string; answer: string};

/**
 * FAQs come from the product's `custom.ai_faq` metafield (AI-generated,
 * saved as schema.org FAQPage JSON-LD) when present; otherwise a generated
 * set renders so the section never looks empty.
 */
function buildFaqs(
  product: any,
  selectedVariant: any,
  categoryName: string,
): Faq[] {
  const fromMetafield = parseFaqMetafield(product.faqs?.value);
  if (fromMetafield) return fromMetafield;

  return [
    {
      question: `What is ${product.title}?`,
      answer: `This ${categoryName || 'jewelry piece'} is sold by ${product.vendor || 'our store'}${selectedVariant?.sku ? ` and is tracked under SKU ${selectedVariant.sku}` : ''}.`,
    },
    {
      question: 'What size or length options are available?',
      answer:
        'Every available size, length, and metal option for this piece is shown above as a selectable tag. Options not listed are not currently offered.',
    },
    {
      question: 'Is it available right now?',
      answer: selectedVariant?.availableForSale
        ? 'Yes, this item is currently available for purchase.'
        : 'Availability can change quickly. Please check the selected variant or contact us for the latest status.',
    },
    {
      question: 'What if I need help after ordering?',
      answer:
        'We support shipping, returns, and warranty questions through our customer care team and the FAQ page.',
    },
  ];
}

function parseFaqMetafield(value?: string | null): Faq[] | null {
  if (!value) return null;
  try {
    const parsed: any = JSON.parse(value);
    // AI FAQ metafield is saved as schema.org FAQPage JSON-LD.
    const list = parsed?.mainEntity ?? (Array.isArray(parsed) ? parsed : parsed?.faqs);
    if (!Array.isArray(list)) return null;
    const faqs = list
      .map((f: any) => ({
        question: String(f?.name ?? f?.question ?? f?.q ?? ''),
        answer: String(f?.acceptedAnswer?.text ?? f?.answer ?? f?.a ?? ''),
      }))
      .filter((f) => f.question && f.answer);
    return faqs.length ? faqs : null;
  } catch {
    return null;
  }
}

function ProductFaqSection({faqs}: {faqs: Faq[]}) {
  if (!faqs.length) return null;
  return (
    <section className="pdp-faq-section">
      <div className="section-inner">
        <h2 className="pdp-faq-title">FAQs</h2>
        <div className="pdp-faq-list">
          {faqs.map((faq) => (
            <details className="pdp-faq" key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}


function LengthArticleSelect({data}: {data: LengthArticles | null}) {
  const navigate = useNavigate();
  const {pathname} = useLocation();
  if (!data || data.options.length < 2) return null;

  return (
    <div className="product-options">
      <span className="product-options-label" id="option-label-length">
        Length
      </span>
      <div
        className="variant-tags"
        role="group"
        aria-labelledby="option-label-length"
      >
        {data.options.map((option) => {
          const selected = option.length === data.current;
          return (
            <button
              key={option.handle}
              type="button"
              className={`variant-tag${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => {
                if (!selected) {
                  void navigate(replaceProductHandleInPath(pathname, option.handle));
                }
              }}
            >
              {option.length}&quot;
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RelatedProducts({
  products,
  viewAllTo,
}: {
  products: Promise<ProductRecommendationsQuery | null>;
  viewAllTo: string;
}) {
  return (
    <section className="pdp-similar">
      <div className="section-inner pdp-similar-header">
        <div>
          <h2 className="pdp-similar-title">You May Also Like</h2>
          <Link className="slider-viewall" to={viewAllTo}>
            View all similar products
          </Link>
        </div>
      </div>
      <Suspense fallback={null}>
        <Await resolve={products}>
          {(data) => {
            const items = (data?.productRecommendations ?? []).slice(0, 8);
            if (!items.length) return null;
            return (
              <HorizontalCarousel
                className="slider-carousel"
                ariaLabel="You may also like"
                showButtons
              >
                {items.map((product, index) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    className="slider-item"
                    loading={index < 4 ? 'eager' : undefined}
                  />
                ))}
              </HorizontalCarousel>
            );
          }}
        </Await>
      </Suspense>
    </section>
  );
}

/** Normalize the Storefront `media` union into the gallery's flat item shape. */
function normalizeMedia(nodes: any[], title: string): GalleryMedia[] {
  return nodes
    .map((node): GalleryMedia | null => {
      const base = {
        key: node.id ?? node.previewImage?.url ?? '',
        thumbUrl: node.previewImage?.url ?? node.image?.url ?? null,
        alt: node.alt ?? title,
      };
      switch (node.__typename) {
        case 'MediaImage':
          if (!node.image?.url) return null;
          return {...base, kind: 'image', image: node.image};
        case 'Video':
          if (!node.sources?.length) return null;
          return {...base, kind: 'video', sources: node.sources};
        case 'ExternalVideo':
          if (!node.embedUrl) return null;
          return {...base, kind: 'external', embedUrl: node.embedUrl};
        default:
          return null;
      }
    })
    .filter((item): item is GalleryMedia => item !== null);
}

function replaceProductHandleInPath(pathname: string, handle: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'products') return `/products/${handle}`;
  return `/${[...parts.slice(0, -1), handle].map(encodeURIComponent).join('/')}`;
}

function buildHierarchicalProductPath({
  handle,
  categoryHandle,
  subcategoryHandle,
}: {
  handle: string;
  categoryHandle: string;
  subcategoryHandle?: string | null;
}) {
  const segments = ['products', categoryHandle];
  if (subcategoryHandle) segments.push(subcategoryHandle);
  segments.push(handle);
  return `/${segments.map(encodeURIComponent).join('/')}`;
}

function getProductCategoryMatch(product: {
  category?: {name?: string | null} | null;
  productType?: string | null;
}) {
  const rawCategory = product.category?.name || product.productType || '';
  const categoryName =
    rawCategory && rawCategory.toLowerCase() !== 'uncategorized'
      ? rawCategory
      : '';
  if (!categoryName) return undefined;

  return CATEGORIES.find((c) => {
    const name = categoryName.toLowerCase();
    const label = c.label.toLowerCase();
    return (
      name === label ||
      name === c.handle ||
      name.includes(label) ||
      name.includes(c.handle)
    );
  });
}

function getBreadcrumbContext(
  params: URLSearchParams,
  routeParams?: {category?: string; subcategory?: string},
) {
  const categoryHandle = normalizeCollectionHandle(params.get('category'));
  const subcategoryHandle = normalizeCollectionHandle(params.get('subcategory'));
  const pathCategoryHandle = normalizeCollectionHandle(
    routeParams?.category ?? null,
  );
  const pathSubcategoryHandle = normalizeCollectionHandle(
    routeParams?.subcategory ?? null,
  );
  const categoryName = normalizeCrumbLabel(params.get('categoryName'));
  const subcategoryName = normalizeCrumbLabel(params.get('subcategoryName'));

  if (
    !categoryHandle &&
    !subcategoryHandle &&
    !pathCategoryHandle &&
    !pathSubcategoryHandle
  ) {
    return null;
  }

  return {
    categoryHandle: categoryHandle ?? pathCategoryHandle,
    categoryName,
    subcategoryHandle: subcategoryHandle ?? pathSubcategoryHandle,
    subcategoryName,
  };
}

function normalizeCollectionHandle(value: string | null) {
  if (!value) return null;
  const handle = value.replace(/^\/?collections\//, '').trim();
  return /^[a-z0-9][a-z0-9-]*$/i.test(handle) ? handle : null;
}

function normalizeCrumbLabel(value: string | null) {
  if (!value) return null;
  const label = value.trim().slice(0, 80);
  return label || null;
}

function buildProductJsonLd({
  product,
  selectedVariant,
  mediaItems,
  baseUrl,
}: {
  product: any;
  selectedVariant: any;
  mediaItems: GalleryMedia[];
  baseUrl: string;
}) {
  const images = mediaItems
    .map((item) => (item.kind === 'image' ? item.image?.url : item.thumbUrl))
    .filter((url): url is string => Boolean(url));
  const price = selectedVariant?.price;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    url: `${baseUrl}/products/${product.handle}`,
    brand: {
      '@type': 'Brand',
      name: 'Gold Custom',
    },
    description: product.seo?.description || product.description || undefined,
    image: images.length ? images : undefined,
    mpn: selectedVariant?.sku || product.handle,
    sku: selectedVariant?.sku || undefined,
    offers: price
      ? {
          '@type': 'Offer',
          url: `${baseUrl}/products/${product.handle}`,
          price: price.amount,
          priceCurrency: price.currencyCode,
          availability: selectedVariant?.availableForSale
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        }
      : undefined,
  };
}

function getStoreBaseUrl(root: any) {
  const primaryDomain = root?.header?.shop?.primaryDomain?.url;
  if (primaryDomain) return primaryDomain.replace(/\/$/, '');

  const publicDomain = root?.publicStoreDomain;
  if (!publicDomain) return '';

  return publicDomain.startsWith('http')
    ? publicDomain.replace(/\/$/, '')
    : `https://${publicDomain.replace(/\/$/, '')}`;
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    productType
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    category {
      name
    }
    faqs: metafield(namespace: "custom", key: "ai_faq") {
      value
    }
    media(first: 25) {
      nodes {
        __typename
        id
        alt
        mediaContentType
        previewImage {
          url
        }
        ... on MediaImage {
          image {
            id
            url
            altText
            width
            height
          }
        }
        ... on Video {
          sources {
            url
            mimeType
          }
        }
        ... on ExternalVideo {
          embedUrl
        }
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const SIBLING_PRODUCTS_QUERY = `#graphql
  query SiblingProducts(
    $query: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: 100, query: $query) {
      nodes {
        handle
        title
      }
    }
  }
` as const;

const PRODUCT_RECOMMENDATIONS_QUERY = `#graphql
  fragment RecommendedItem on Product {
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
  query ProductRecommendations(
    $productHandle: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productHandle: $productHandle) {
      ...RecommendedItem
    }
  }
` as const;
