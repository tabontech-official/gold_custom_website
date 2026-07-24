import {Suspense} from 'react';
import {
  redirect,
  useLoaderData,
  Await,
  Link,
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
import {AddToCartButton} from '~/components/AddToCartButton';
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

  return {...deferredData, ...criticalData};
}

type VariantGroupOption = {
  handle: string;
  name: string;
  available: boolean;
  selected: boolean;
};

type VariantGroup = {
  label: string;
  options: VariantGroupOption[];
};

/**
 * Variant siblings are linked by metafields (not Shopify combined listings):
 * `custom.varianthandle` is a product_reference list of every product in the
 * group, `custom.variant_name` is each product's option value (e.g. 26"),
 * and `custom.variant_label` names the selector (e.g. "Length"). Build the
 * dropdown from those so selecting a value opens that product.
 *
 * `parseLen` only decides sort order — the labels come straight from the
 * metafield, so a non-numeric variant_name still renders, just unsorted.
 */
function parseLen(value: string) {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : Number.POSITIVE_INFINITY;
}

function buildVariantGroup(product: any): VariantGroup | null {
  const nodes: any[] = product?.variantGroup?.references?.nodes ?? [];
  const label = product?.variantLabel?.value?.trim();
  if (!label || nodes.length < 2) return null;

  const options: VariantGroupOption[] = nodes
    .map((node) => {
      const name = node?.variantName?.value?.trim();
      if (!node?.handle || !name) return null;
      return {
        handle: node.handle,
        name,
        available: node.availableForSale !== false,
        selected: node.handle === product.handle,
      };
    })
    .filter((o): o is VariantGroupOption => o !== null)
    .sort((a, b) => parseLen(a.name) - parseLen(b.name));

  return options.length > 1 ? {label, options} : null;
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
  const {product, recommendedProducts, breadcrumbContext} =
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

  const {title, descriptionHtml} = product;
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
        <div className="product-gallery-column">
          <ProductGallery
            media={mediaItems}
            selectedImageUrl={selectedVariant?.image?.url}
            title={title}
          />
          <ProductTrustBadges />
        </div>

        <div className="product-main">
          {sku && <p className="product-sku">SKU / Style Code: {sku}</p>}
          <h1>{title}</h1>
          <div className="product-price-row">
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
          </div>
          <MonthlyEstimate
            price={selectedVariant?.price}
            variant={selectedVariant}
          />
          <ProductSpecIcons
            keyword={`${selectedVariant?.title ?? ''} ${title}`}
            weight={selectedVariant?.weight}
            weightUnit={selectedVariant?.weightUnit}
          />

          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
            wishlistButton={<ProductWishlistButton handle={product.handle} />}
            variantGroup={buildVariantGroup(product)}
            product={{
              id: product.id,
              title: product.title,
              handle: product.handle,
            }}
          />

          <ProductAccordions descriptionHtml={descriptionHtml} />

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

/**
 * Split the description HTML on `<h5>` headings. The first chunk (the intro
 * paragraph, before any heading) renders visible under the product; every
 * `<h5>` and the content up to the next `<h5>` becomes a collapsable panel.
 */
function splitDescriptionByH5(html: string) {
  const parts = html.split(/<h5[^>]*>/i);
  const intro = parts[0]?.trim() || '';
  const sections = parts.slice(1).map((part) => {
    const [heading, ...rest] = part.split(/<\/h5>/i);
    return {heading: heading.replace(/<[^>]+>/g, '').trim(), body: rest.join('')};
  });
  return {intro, sections};
}

function ProductAccordions({
  descriptionHtml,
}: {
  descriptionHtml?: string | null;
}) {
  const {intro, sections} = splitDescriptionByH5(descriptionHtml || '');

  return (
    <div className="product-accordions">
      {intro && (
        <div
          className="product-description-intro"
          dangerouslySetInnerHTML={{__html: intro}}
        />
      )}

      {sections.map((section) => (
        <details className="product-details" key={section.heading}>
          <summary>{section.heading}</summary>
          <div
            className="product-details-body"
            dangerouslySetInnerHTML={{__html: section.body}}
          />
        </details>
      ))}
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
        <h2 className="pdp-faq-title">
          <span>FAQs</span>
        </h2>
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


/**
 * Derive a karat + metal tone from a variant/product keyword like
 * "10K Yellow Gold" or "14k White Gold". Returns null when no karat is found
 * (e.g. length variants), so the badge only shows when it's meaningful.
 */
function parseKarat(keyword: string) {
  const karatMatch = keyword.match(/\b(\d{1,2})\s?k\b/i);
  if (!karatMatch) return null;
  const karat = `${karatMatch[1]}K`;

  const lower = keyword.toLowerCase();
  const tone: 'yellow' | 'white' | 'rose' = lower.includes('white')
    ? 'white'
    : lower.includes('rose') || lower.includes('pink')
      ? 'rose'
      : 'yellow';

  const toneLabel = {yellow: 'Yellow Gold', white: 'White Gold', rose: 'Rose Gold'}[
    tone
  ];
  return {karat, tone, label: `${karat} ${toneLabel}`};
}

const WEIGHT_UNIT_ABBR: Record<string, string> = {
  GRAMS: 'g',
  KILOGRAMS: 'kg',
  OUNCES: 'oz',
  POUNDS: 'lb',
};

/**
 * Product-spec highlights under the price — metal, width, weight, length —
 * read from the variant/title. Each row only renders when its value exists.
 */
function ProductSpecIcons({
  keyword,
  weight,
  weightUnit,
}: {
  keyword: string;
  weight?: number | null;
  weightUnit?: string | null;
}) {
  const karat = parseKarat(keyword);
  const width = keyword.match(/(\d+(?:\.\d+)?)\s*mm\b/i)?.[1];
  const length = keyword.match(
    /(\d+(?:\.\d+)?)\s*-?\s*(?:inch(?:es)?\b|in\b|["”″])/i,
  )?.[1];
  const weightLabel =
    typeof weight === 'number' && weight > 0
      ? `Approx. ${weight}${WEIGHT_UNIT_ABBR[weightUnit ?? ''] ?? weightUnit ?? ''}`
      : null;

  const specs: Array<{icon: SpecIconName; label: string; toneClass?: string}> = [];
  if (karat)
    specs.push({
      icon: 'metal',
      label: `Solid ${karat.label}`,
      toneClass: `spec-icon--${karat.tone}`,
    });
  if (width) specs.push({icon: 'width', label: `${width}mm Width`});
  if (weightLabel) specs.push({icon: 'weight', label: weightLabel});
  if (length) specs.push({icon: 'length', label: `${length} Inch Length`});

  if (!specs.length) return null;

  return (
    <ul className="product-specs" aria-label="Product specifications">
      {specs.map((spec) => (
        <li className="product-spec-item" key={spec.label}>
          <SpecIcon name={spec.icon} className={spec.toneClass} />
          <span>{spec.label}</span>
        </li>
      ))}
    </ul>
  );
}

type SpecIconName = 'metal' | 'width' | 'weight' | 'length';

function SpecIcon({name, className}: {name: SpecIconName; className?: string}) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: `product-spec-svg${className ? ` ${className}` : ''}`,
  };
  switch (name) {
    case 'metal': // faceted gold ingot / bar
      return (
        <svg {...common}>
          <path d="M5 9l2.5-3h9L19 9l-7 10z" />
          <path d="M5 9h14M9.5 6l2.5 3 2.5-3M12 9v10" />
        </svg>
      );
    case 'width': // horizontal caliper span
      return (
        <svg {...common}>
          <path d="M3 12h18M3 8v8M21 8v8M7 10l-2 2 2 2M17 10l2 2-2 2" />
        </svg>
      );
    case 'weight': // scale weight
      return (
        <svg {...common}>
          <path d="M8 7h8l3 12H5zM9 7a3 3 0 0 1 6 0" />
        </svg>
      );
    case 'length': // vertical ruler
      return (
        <svg {...common}>
          <path d="M12 3v18M8 5l4-2 4 2M8 19l4 2 4-2M9 8h6M9 12h6M9 16h6" />
        </svg>
      );
  }
}

/** Estimated monthly installment (price / 12) with a sample-plans link. */
function MonthlyEstimate({
  price,
  variant,
}: {
  price?: {amount: string; currencyCode: string};
  variant?: {id: string; availableForSale?: boolean} | null;
}) {
  const amount = Number(price?.amount);
  if (!price || !Number.isFinite(amount) || amount <= 0) return null;

  const perMonth = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currencyCode || 'USD',
  }).format(amount / 12);

  // "View sample plans" adds the item and jumps straight to the Shopify
  // checkout (payment) page, where the installment plans are shown.
  const canCheckout = variant?.id && variant.availableForSale !== false;

  return (
    <div className="product-monthly">
      From <strong>{perMonth}/mo</strong> with{' '}
      {canCheckout ? (
        <AddToCartButton
          className="product-monthly-link"
          redirectTo="@checkout"
          lines={[{merchandiseId: variant!.id, quantity: 1}]}
        >
          View sample plans
        </AddToCartButton>
      ) : (
        <Link to="/policies/finance">View sample plans</Link>
      )}
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
    weight
    weightUnit
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
    variantLabel: metafield(namespace: "custom", key: "variant_label") {
      value
    }
    variantName: metafield(namespace: "custom", key: "variant_name") {
      value
    }
    variantGroup: metafield(namespace: "custom", key: "varianthandle") {
      references(first: 30) {
        nodes {
          ... on Product {
            handle
            availableForSale
            variantName: metafield(namespace: "custom", key: "variant_name") {
              value
            }
          }
        }
      }
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
