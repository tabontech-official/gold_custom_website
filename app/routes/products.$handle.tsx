import {Suspense, useEffect, useRef, useState} from 'react';
import {redirect, useLoaderData, Await, useRouteLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
  useAnalytics,
} from '@shopify/hydrogen';
import type {ProductRecommendationsQuery} from 'storefrontapi.generated';
import {CachePrice, CacheCatalog, CacheStatic} from '~/lib/cache';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery, type GalleryMedia} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {HorizontalCarousel} from '~/components/HorizontalCarousel';
import {ProductItem} from '~/components/ProductItem';
import {Breadcrumb} from '~/components/Breadcrumb';
import {ShareButtons} from '~/components/ShareButtons';
import {getMegaMenuParentCrumb} from '~/lib/megaMenu';
import {useWishlistToggle} from '~/hooks/useWishlistToggle';
import {
  collectionLabel,
  getProductCategoryMatch,
  productCanonicalPath,
} from '~/lib/categories';
import {
  DEFAULT_RING_SIZE,
  RING_SIZE_ATTRIBUTE_KEY,
  isRingProduct,
} from '~/lib/ringSizes';
import {cartLineAttribute} from '~/lib/cartLines';
import {FINANCE_LINKS} from '~/lib/finance';
import {
  buildShopPayMeta,
  variantIdNumber,
  stripSplitPayCopy,
  FALLBACK_PRICING,
  SHOP_PAY_INSTALLMENTS_QUERY,
  type InstallmentsPricing,
} from '~/lib/shopPayInstallments';
import {buildFaqJsonLd, parseFaqMetafield, type Faq} from '~/lib/faqs';
import {TRUST_CLAIMS} from '~/lib/trustClaims';
import {TrustClaimIconArt} from '~/components/TrustClaims';
import {buildVideoJsonLd} from '~/lib/videoSchema';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {meaningfulSelectedOptions} from '~/lib/variants';
import {DescriptionAccordions} from '~/components/DescriptionAccordions';
import {
  MERCHANT_RETURN_POLICY,
  SITE,
  absoluteUrl,
  breadcrumbJsonLd,
  cleanSku,
  metaDescription,
  offerShippingDetails,
  offerValidFromDate,
  pageSeo,
  priceValidUntilDate,
  rootDataFrom,
  siteOrigin,
} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data, matches}) => {
  const product = data?.product;
  if (!product) return pageSeo({title: SITE.name});

  const origin = siteOrigin(rootDataFrom(matches));
  const canonical = absoluteUrl(origin, productCanonicalPath(product));
  const variant = product.selectedOrFirstAvailableVariant;
  const image = variant?.image;

  const category = getProductCategoryMatch(product);
  const crumbs = [
    {name: 'Home', path: '/'},
    ...(category
      ? [{name: category.label, path: `/collections/${category.handle}`}]
      : []),
    {name: product.title, path: productCanonicalPath(product)},
  ];

  // Base SEO tags
  const tags = pageSeo({
    ogType: 'product',
    title: product.seo?.title || product.title,
    description: metaDescription(
      product.seo?.description || product.description,
    ),
    url: canonical,
    // width/height come along so pageSeo can publish og:image:width/height —
    // the Liquid storefront did, and a card that knows its own aspect ratio
    // lays out before the image lands.
    media: image?.url
      ? {
          type: 'image' as const,
          url: image.url,
          width: image.width,
          height: image.height,
        }
      : undefined,
    // og:price:*, as the Liquid storefront published it. The API's `amount` is
    // a bare decimal, so this does not repeat the old site's "2,250.00".
    price: variant?.price,
    // Product schema is emitted at render time (buildProductJsonLd) where the
    // resolved variant and gallery are available — don't duplicate it here.
    jsonLd: breadcrumbJsonLd(origin, crumbs),
  });

  // If there is a main product image, add a preload link to speed LCP.
  // Ensure absolute URL so the link works from any route.
  const preloadLink = image?.url
    ? {
        rel: 'preload',
        as: 'image',
        href: image.url.startsWith('/')
          ? absoluteUrl(origin, image.url)
          : image.url,
      }
    : null;

  return preloadLink ? [...tags, preloadLink] : tags;
};

/**
 * Which param holds the product handle depends on which route is rendering.
 *
 * Two routes share this loader. On `/collections/<c>/products/<h>` the router
 * binds the COLLECTION to `handle` and the product to `productHandle`; on the
 * bare `/products/<h>` there is no collection and `handle` IS the product.
 *
 * This lives in one function because reading `params.handle` directly is right
 * on one route and silently wrong on the other — `loadDeferredData` did exactly
 * that and asked the API for recommendations for a product called "chains",
 * which returned nothing, so "You May Also Like" rendered empty on every
 * product page. Nothing threw: the collection URL is the canonical one, so
 * every real visit took the broken path and just showed a bare heading.
 */
function productHandleFromParams(
  params: Route.LoaderArgs['params'],
): string | undefined {
  const routeParams = params as Route.LoaderArgs['params'] & {
    productHandle?: string;
  };
  return routeParams.productHandle ?? params.handle;
}

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
 * `parseLen` only decides sort order â€” the labels come straight from the
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
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const url = new URL(request.url);
  // Shared by priceValidUntil and validFrom below — see the comment on that
  // return value for why they must come from one instant.
  const now = new Date();
  const routeParams = params as Route.LoaderArgs['params'] & {
    productHandle?: string;
  };

  const handle = productHandleFromParams(params);
  const collectionHandle = routeParams.productHandle
    ? normalizeCollectionHandle(params.handle ?? null)
    : null;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}, installments] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
      // This query carries price and availableForSale — the two fields a
      // customer actually acts on. Omitting `cache` does NOT keep them fresh:
      // Hydrogen's default is maxAge 1 + SWR 86399, so the price on this page
      // could be a full day old. CachePrice is the 3-minute tier.
      cache: CachePrice(),
    }),
    // Shop config, so cache it hard. Errors when the storefront token is
    // missing the `unauthenticated_read_shop_pay_installments_pricing` scope —
    // the banner falls back to FALLBACK_PRICING rather than taking the page down.
    storefront
      .query(SHOP_PAY_INSTALLMENTS_QUERY, {cache: CacheStatic()})
      .catch(() => null),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  // A product reached WITHOUT a collection in the path has no browsing context
  // worth preserving, so send it to its canonical URL — one address in the bar,
  // in the sitemap and in Google. Reached WITH one, it stays put: the collection
  // is where the shopper actually is, and every such page names the same
  // canonical anyway.
  //
  // 301, not the default 302: a temporary redirect leaves Google crawling the
  // alias forever and never consolidating ranking onto the real URL.
  //
  // No loop is possible — `productCanonicalPath` returns the flat
  // `/products/<handle>` for a product whose category doesn't resolve, which is
  // the path we are already on, so the comparison stops it.
  if (!collectionHandle) {
    const canonical = productCanonicalPath(product);
    if (canonical !== url.pathname) {
      throw redirect(`${canonical}${url.search}`, 301);
    }
  }

  return {
    product,
    breadcrumbContext: collectionHandle
      ? {handle: collectionHandle, label: collectionLabel(collectionHandle)}
      : null,
    installmentsPricing:
      installments?.shop?.shopPayInstallmentsPricing ?? FALLBACK_PRICING,
    /**
     * Computed here, not at render time, from one shared `now`. `buildProductJsonLd`
     * runs during hydration too, and a `new Date()` evaluated separately on
     * server and client can straddle a UTC midnight â€” that produces two
     * different strings for the same markup and React reports a hydration
     * mismatch. Both dates come from the same instant so they can't drift
     * relative to each other either.
     */
    priceValidUntil: priceValidUntilDate(now),
    validFrom: offerValidFromDate(now),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  // Related products â€” fetched after first paint so they never block the page.
  const recommendedProducts = context.storefront
    .query(PRODUCT_RECOMMENDATIONS_QUERY, {
      // NOT `params.handle` — see productHandleFromParams. On the canonical
      // `/collections/<c>/products/<h>` URL that is the collection.
      variables: {productHandle: productHandleFromParams(params)},
      // A browsing rail below the fold, not the buy box: the catalog tier.
      cache: CacheCatalog(),
    })
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  return {recommendedProducts};
}

export default function Product() {
  const {
    product,
    recommendedProducts,
    breadcrumbContext,
    priceValidUntil,
    validFrom,
    installmentsPricing,
  } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<any>('root');

  // Rings are sized at add-to-cart, not by variant, so the size lives here and
  // is passed down to ProductForm's add-to-bag line.
  const isRing = isRingProduct(product);
  const [ringSize, setRingSize] = useState(DEFAULT_RING_SIZE);

  /**
   * Optimistically selects a variant from the available variant information.
   *
   * Do NOT pair this with a `shouldRevalidate` that skips same-pathname
   * navigations. `useOptimisticVariant` returns its optimistic match only
   * while `navigation.state === 'loading'`; the moment the navigation settles
   * it returns `product.selectedOrFirstAvailableVariant` — the loader's value.
   * Skip the loader and that value never changes, so after the transition the
   * page silently reverts to the previous variant: the selector reads "14K
   * White Gold" (it is derived from the URL) while the price, SKU and the line
   * added to the cart are still Yellow Gold. Measured, not theorised.
   *
   * The refetch is what makes the selection true. It is not what the shopper
   * waits for — the optimistic value paints immediately and the loader only
   * confirms it.
   */
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url. Filtered, or a product with
  // no real options stamps `?Title=Default+Title` onto its own URL on hydrate
  // — see meaningfulSelectedOptions.
  useSelectedOptionInUrlParam(
    meaningfulSelectedOptions(selectedVariant.selectedOptions),
  );

  // This ring already in the bag? Show the size that's in there rather than the
  // default, so the picker matches the cart line and the button reads "Added to
  // bag". Picking another size afterwards leaves this alone â€” that's a
  // different line, and it should be addable.
  const bagRingSize = cartLineAttribute(
    useAnalytics().cart,
    selectedVariant?.id,
    RING_SIZE_ATTRIBUTE_KEY,
  );
  useEffect(() => {
    if (bagRingSize) setRingSize(bagRingSize);
  }, [bagRingSize]);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title} = product;
  // Strip the merchant's own "Size & Weight" heading and its Length/Width
  // lines, when present (990 of 4,539 products, checked directly against the
  // Storefront API — always this exact heading text) — the spec sheet below
  // the description prints the same facts, sourced from the variant instead
  // of copy, so every product ends up with the identical block in the
  // identical place rather than depending on whether a merchant happened to
  // write one. Two systems for the same numbers is what read as
  // inconsistent; one system that always runs is the fix.
  const descriptionHtml = stripSizeWeightSection(product.descriptionHtml);
  const mediaItems = normalizeMedia(product.media?.nodes ?? [], title);
  const productOrigin = siteOrigin(root);
  const productJsonLd = buildProductJsonLd({
    product,
    selectedVariant,
    mediaItems,
    origin: productOrigin,
    priceValidUntil,
    validFrom,
  });
  // VideoObject for every video in the gallery — YouTube embeds and the few
  // Shopify-hosted clips alike. `uploadDate` is the product's publishedAt:
  // Shopify's media union carries no upload timestamp, and Google requires
  // the field, so the closest true date the page holds stands in for it.
  // ponytail: swap in a real per-video date if one ever lands on a metafield.
  const videoJsonLd = buildVideoJsonLd({
    media: mediaItems,
    name: title,
    description: metaDescription(product.seo?.description || product.description),
    uploadDate: product.publishedAt,
    pageUrl: absoluteUrl(productOrigin, productCanonicalPath(product)),
  });
  const rawCategory = product.category?.name || product.productType || '';
  const categoryName =
    rawCategory && rawCategory.toLowerCase() !== 'uncategorized'
      ? rawCategory
      : '';
  const sku = selectedVariant?.sku?.trim();
  const metalLabel = parseKarat(
    `${selectedVariant?.title ?? ''} ${title}`,
  )?.label;

  const authoredFaqs = parseFaqMetafield(product.faqs?.value);
  const faqs =
    authoredFaqs ?? fallbackFaqs(product, selectedVariant, categoryName);

  // Resolve the category to a shoppable collection so the crumb is clickable.
  // Shopify taxonomy names look like "Necklaces in Jewelry", so we match on
  // containment as well as exact label/handle.
  const categoryMatch = getProductCategoryMatch(product);
  // The collection in the URL is where the shopper actually came from, so it
  // outranks the product's own category for the crumb — landing on
  // /collections/mens-gold-rings/products/x and being told "Rings" would
  // describe a page they were never on.
  const collectionCrumb = breadcrumbContext
    ? {
        label: breadcrumbContext.label,
        to: `/collections/${breadcrumbContext.handle}`,
      }
    : categoryMatch
      ? {label: categoryMatch.label, to: `/collections/${categoryMatch.handle}`}
      : categoryName
        ? {label: categoryName}
        : null;

  // The department above that collection — "Pendants" over "Religious
  // Pendants". Without it the product page dropped a level that the category
  // page directly above it shows, so walking Shop -> Pendants -> Religious
  // Pendants -> product silently lost "Pendants" on the last step.
  //
  // Keyed off the crumb actually being rendered, not the product's category,
  // so the parent always belongs to the collection shown beside it. Returns
  // null for a department (nothing sits above it) and when the header has not
  // loaded; <Breadcrumb> drops nullish entries, so both cases just collapse
  // back to the previous trail.
  const parentCrumb = collectionCrumb?.to
    ? getMegaMenuParentCrumb({
        handle: collectionCrumb.to.replace('/collections/', ''),
        header: root?.header,
        publicStoreDomain: root?.publicStoreDomain,
      })
    : null;

  const breadcrumbs = [
    {label: 'Home', to: '/'},
    {label: 'Shop', to: '/collections/all'},
    parentCrumb,
    ...(collectionCrumb ? [collectionCrumb] : []),
    {label: title},
  ];

  const similarCollectionTo = categoryMatch
    ? `/collections/${categoryMatch.handle}`
    : '/collections/all';

  return (
    <div className="product">
      {/*
        Escaping `<` is load-bearing, not defensive dressing. Every string in
        this payload is merchant-controlled — title, description, sku, image
        URLs, and the `custom.ai_faq` metafield that tooling writes with no
        validated form behind it. A literal `</script>` anywhere in that data
        closes this element early: broken structured data at best, injected
        markup at worst. `<` is invisible to a JSON parser and also
        neutralises `<!--`.

        Everything routed through pageSeo is escaped for free by React Router;
        this is the one hand-serialised path, which is exactly why it needed
        it.

        Wrapped in @graph rather than emitted as a bare top-level array —
        several validators read only the first or last member of a bare array.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              productJsonLd,
              ...(authoredFaqs ? [buildFaqJsonLd(authoredFaqs)] : []),
              ...videoJsonLd,
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />

      <Breadcrumb items={breadcrumbs} className="breadcrumb--pdp" />

      <div className="product-layout">
        <div className="product-gallery-column">
          <ProductGallery
            media={mediaItems}
            selectedImageUrl={selectedVariant?.image?.url}
            title={title}
          />
          <ProductTrustBadges />
        </div>

        {/* Wrapper exists for mobile only: it is `display: contents` below 48em
            so the heading, the gallery and the buy panel become siblings that
            `order` can interleave â€” title, then the piece, then the price.
            On desktop it is the sticky right column, which is what
            .product-main used to be, so that layout is unchanged. */}
        <div className="product-buy-column">
          <div className="product-heading pdp-card">
            {sku && <p className="product-sku">SKU : {sku}</p>}
            <h1>{title}</h1>
            {metalLabel && (
              <p className="product-metal-label">Solid {metalLabel}</p>
            )}
          </div>

          <div className="product-main">
            <FinancingPartners />
            <div className="product-purchase-card pdp-card">
              <div className="product-price-row">
                <ProductPrice
                  price={selectedVariant?.price}
                  compareAtPrice={selectedVariant?.compareAtPrice}
                />
              </div>
              <ShopPayInstallments
                price={selectedVariant?.price}
                variant={selectedVariant}
                pricing={installmentsPricing}
              />
              <ProductForm
                productOptions={productOptions}
                selectedVariant={selectedVariant}
                wishlistButton={
                  <ProductWishlistButton handle={product.handle} />
                }
                variantGroup={buildVariantGroup(product)}
                product={{
                  id: product.id,
                  title: product.title,
                  handle: product.handle,
                }}
                ringSize={isRing ? ringSize : undefined}
                onRingSizeChange={setRingSize}
              />
            </div>

            <div className="product-details-card pdp-card">
              <DescriptionAccordions html={descriptionHtml} headingTag="h5" />
              <div className="product-note">
                <h3>Important Note</h3>
                <p>
                  Solid gold is a soft precious metal. Store this piece
                  separately, keep it away from perfume and chlorine, and polish
                  it with a soft cloth. Custom or engraved pieces are crafted to
                  order and may add 5â€“7 business days before shipping.
                </p>
              </div>
              {/* Last thing in the card, after the description and the care
                  note — ALWAYS rendered, same place, same style, on every
                  product. That consistency is the point: this used to be
                  conditional on whether the merchant had written their own
                  "Size & Weight" copy, so some products carried it and some
                  didn't and the page read as two different designs. Sourced
                  from the variant, not the description, so it fills in
                  whatever the merchant's copy is missing rather than only
                  ever repeating what is already there — stripSizeWeightSection
                  above is what keeps the two from duplicating instead. */}
              <ProductSpecsLine
                weight={selectedVariant?.weight}
                weightUnit={selectedVariant?.weightUnit}
              />
              <ShareButtons
                title={product.title}
                image={selectedVariant?.image?.url}
              />
            </div>
          </div>
        </div>
      </div>

      <RelatedProducts
        products={recommendedProducts}
        viewAllTo={similarCollectionTo}
      />

      <ProductFaqSection faqs={faqs} />

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

  // See ProductItem's WishlistButton — same one-toggle form, same reason for
  // dropping the landmark role.
  return (
    <fetcher.Form method="post" action="/wishlist" role="presentation">
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
 * The store's promises, under the buy box.
 *
 * The copy lives in ~/lib/trustClaims so this and the collection strip cannot
 * drift apart — and so a policy change is one edit, not a hunt. A badge here
 * once outlived the policy it described; see that file.
 */
function ProductTrustBadges() {
  return (
    <div
      className="product-trust-badges pdp-card"
      aria-label="Product trust badges"
    >
      {TRUST_CLAIMS.map((claim) => (
        <div className="product-trust-badge" key={claim.title}>
          <span className="product-trust-icon">
            <TrustClaimIconArt name={claim.icon} />
          </span>
          <span className="product-trust-title">{claim.title}</span>
          <span className="product-trust-sub">{claim.sub}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Rendered when the product has no authored `custom.ai_faq` metafield, so the
 * section never looks empty. Deliberately NOT emitted as FAQPage JSON-LD â€”
 * these answers are boilerplate derived from fields already in the Product
 * schema, and marking up generated filler as Q&A is what earns a manual
 * action. Only authored FAQs get structured data (see buildFaqJsonLd).
 */
function fallbackFaqs(
  product: any,
  selectedVariant: any,
  categoryName: string,
): Faq[] {
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

  const toneLabel = {
    yellow: 'Yellow Gold',
    white: 'White Gold',
    rose: 'Rose Gold',
  }[tone];
  return {karat, tone, label: `${karat} ${toneLabel}`};
}

const WEIGHT_UNIT_ABBR: Record<string, string> = {
  GRAMS: 'g',
  KILOGRAMS: 'kg',
  OUNCES: 'oz',
  POUNDS: 'lb',
};

/**
 * Cuts a merchant's own "Size & Weight" heading and everything after it up
 * to the next heading — the one template variant found across the
 * catalogue (990 of 4,539 products, checked directly against the Storefront
 * API, always this exact heading text). Its body is always the same
 * Length/Width lines ProductSpecsLine prints below the description, sourced
 * from the variant instead of copy — leaving both in would show the same
 * two numbers twice in two different styles on the same page.
 */
function stripSizeWeightSection(html?: string | null): string {
  if (!html) return '';
  return html.replace(
    /<h[1-6][^>]*>\s*size\s*(?:&amp;|&|and)\s*weight\s*<\/h[1-6]>[\s\S]*?(?=<h[1-6]|$)/i,
    '',
  );
}

/**
 * Weight, as a labeled spec row in the description card — nothing else.
 * Metal type already has its own line under the title (see metalLabel); size
 * came out too, so this is just the one fact. Renders nothing when the
 * variant has no weight.
 */
function ProductSpecsLine({
  weight,
  weightUnit,
}: {
  weight?: number | null;
  weightUnit?: string | null;
}) {
  if (typeof weight !== 'number' || weight <= 0) return null;
  const weightLabel = `Approx. ${weight}${WEIGHT_UNIT_ABBR[weightUnit ?? ''] ?? weightUnit ?? ''}`;

  return (
    <dl className="product-specs-text">
      <div className="product-specs-row">
        <dt>Weight</dt>
        <dd>{weightLabel}</dd>
      </div>
    </dl>
  );
}

const SHOP_PAY_TERMS_SCRIPT_ID = 'shopify-payment-terms-script';
const SHOP_PAY_TERMS_SCRIPT =
  'https://cdn.shopify.com/shopifycloud/shop-js/modules/v2/loader.payment-terms.en.esm.js';

/**
 * Squares off the "Get it now, pay later" modal, whose 28px corners are far
 * rounder than anything else on the storefront.
 *
 * Shopify renders that modal into a portal — a bare `<div>` on `<body>` with
 * its own shadow root — and exposes no `::part` and no custom property for the
 * radius, so nothing in app.css can reach it. The shadow root is open, so a
 * stylesheet can be appended to it instead. The portal is created when the
 * widget boots, before the modal is ever opened, so this runs once rather than
 * hooking the click.
 *
 * ponytail: cosmetic only, and it leans on Shopify's internal markup. If they
 * restructure the modal the selectors stop matching and the corners go back to
 * 28px — nothing breaks. Scoped via `:has` so injecting into an unrelated
 * shadow root is inert.
 */
const TERMS_STYLE_ID = 'gc-payment-terms-radius';
const TERMS_STYLE = `
  [class*="rounded-xxl"],
  section:has([data-testid="shopify-payment-terms-modal"]) {
    border-radius: 4px !important;
  }
`;

/** Returns true once the stylesheet is in place, so the caller can stop. */
function injectTermsStyle() {
  let injected = false;
  for (const host of document.querySelectorAll('body > div')) {
    const shadow = (host as HTMLElement).shadowRoot;
    if (!shadow) continue;
    if (!shadow.getElementById(TERMS_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = TERMS_STYLE_ID;
      style.textContent = TERMS_STYLE;
      shadow.appendChild(style);
    }
    injected = true;
  }
  return injected;
}

/**
 * Applies stripSplitPayCopy to every text node under `root`, crossing shadow
 * boundaries: shop-js renders the banner into nested shadow roots, which a
 * TreeWalker (and any outside CSS) cannot reach. Returns true once a cut
 * lands, so the caller can stop polling.
 */
function scrubTermsText(root: ParentNode): boolean {
  let cut = false;
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const next = stripSplitPayCopy(node.textContent ?? '');
      if (next !== node.textContent) {
        node.textContent = next;
        cut = true;
      }
    } else if (node instanceof Element) {
      if (node.shadowRoot && scrubTermsText(node.shadowRoot)) cut = true;
      if (scrubTermsText(node)) cut = true;
    }
  }
  return cut;
}

/**
 * Shop Pay Installments banner — the same `shopify-payment-terms` custom
 * element the Liquid storefront renders from `{{ form | payment_terms }}`, so
 * the "sample plans" modal here is Shopify's real one (Affirm's plans, APRs
 * and prequalification) rather than a hand-rolled price/12 estimate.
 *
 * "Continue to checkout" in that modal navigates to `/cart/<id>:<qty>`, which
 * routes/cart.$lines.tsx turns into a cart and forwards to Shopify checkout.
 * Ring size can't ride along on that link, so the buyer picks it in the bag.
 */
function ShopPayInstallments({
  price,
  variant,
  pricing,
}: {
  price?: {amount: string; currencyCode: string};
  variant?: {id: string; availableForSale?: boolean} | null;
  pricing: InstallmentsPricing;
}) {
  const box = useRef<HTMLDivElement>(null);

  // Re-run per variant: switching variant rewrites `shopify-meta`, and the
  // widget re-renders the sentence from scratch. The poll keeps scrubbing for
  // the whole window rather than stopping at the first cut, because shop-js
  // repaints the banner a few times while it boots.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    scrubTermsText(el);
    const poll = setInterval(() => scrubTermsText(el), 200);
    const stop = setTimeout(() => clearInterval(poll), 15000);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [variant?.id, price?.amount]);

  useEffect(() => {
    if (!document.getElementById(SHOP_PAY_TERMS_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = SHOP_PAY_TERMS_SCRIPT_ID;
      script.type = 'module';
      script.src = SHOP_PAY_TERMS_SCRIPT;
      document.body.appendChild(script);
    }

    // The portal only exists once the widget has booted, which is a network
    // round trip away — poll briefly rather than racing it, and give up
    // rather than watching the DOM for the rest of the session.
    if (injectTermsStyle()) return;
    const poll = setInterval(() => {
      if (injectTermsStyle()) clearInterval(poll);
    }, 250);
    const stop = setTimeout(() => clearInterval(poll), 15000);

    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, []);

  const variantId = variantIdNumber(variant?.id);
  if (!price || !variantId) return null;

  const meta = buildShopPayMeta({
    pricing,
    variantId,
    price,
    available: variant?.availableForSale !== false,
  });
  if (!meta) return null;

  return (
    <div className="product-monthly" ref={box}>
      <shopify-payment-terms
        variant-id={String(variantId)}
        shopify-meta={JSON.stringify(meta)}
      />
    </div>
  );
}

/**
 * Financing partners. The logos are Shopify Files, addressed on
 * `cdn.shopify.com` rather than the storefront's own `/cdn/shop/files/` path:
 * both serve the same bytes, but the CSP `img-src` allowlist covers
 * cdn.shopify.com only, so the storefront path is blocked in local dev.
 *
 * `width=` is a Shopify CDN transform, asked for at 2x the rendered height so
 * the logos stay crisp on retina.
 */
const SHOPIFY_FILES = 'https://cdn.shopify.com/s/files/1/0806/9568/9464/files';

/**
 * Every file is 200x102, but the mark inside is letterboxed vertically by a
 * different amount. Measured ink bounding boxes:
 *
 *   acima 200x90 Â· american 193x94 Â· progressive 200x75 Â· synchrony 200x44
 *
 * That letterboxing is the whole problem. Left uncropped in a row of equal
 * cells, each logo fills the cell width and its height falls out of its own
 * aspect ratio â€” so synchrony's 4.5:1 mark renders about 19px tall next to
 * acima's 39px, and the row looks broken rather than set.
 *
 * So each file is cropped to its own mark, and the row is then sized by height
 * instead of width (see .product-financing-list): equal height, natural
 * widths, which is how a partner strip is normally set. The marks sit centred
 * in their canvases, so a centre crop is safe; `LOGO_INK_PAD` keeps it clear
 * of the ink.
 *
 * The requested height must stay within the source's own 102px â€” Shopify's CDN
 * will not upscale, and silently returns the original uncropped frame if asked
 * for more. For the same reason there is no 2x retina variant to request:
 * 200x102 is all these files have.
 *
 * Note there is no horizontal margin to reclaim either â€” three of the four run
 * edge to edge â€” so scaling a logo past its box only collides its neighbour.
 */
const LOGO_INK_PAD = 4;

function financingLogo(file: string, ink: number) {
  const height = ink + LOGO_INK_PAD;
  return {
    // `quality` for the same reason every other CDN image on the site carries
    // it (see ~/lib/cdnImage) — the default is ~q85 and these are flat vector
    // marks, which is the case that loses the least from a lower setting.
    src: `${SHOPIFY_FILES}/${file}.avif?v=1783667298&width=200&height=${height}&crop=center&quality=70`,
    /**
     * Share of the row this mark takes, proportional to its aspect ratio.
     * Because each image then fills its own share, every logo resolves to the
     * SAME height â€” row width divided by the sum of these weights â€” at any
     * container width. That is what lets the strip grow with the column
     * instead of sitting at a fixed size with the slack dumped between logos.
     */
    weight: 200 / height,
  };
}

/**
 * These are Gold Custom's own merchant application links, not the lenders'
 * marketing homepages â€” each carries a code that attributes the application to
 * this store (Acima `location_guid`, Progressive's `GoldCustomLA` portal,
 * Synchrony's `mmc` merchant code). Sending a customer to the bare homepage
 * instead loses that attribution, so keep the query strings intact.
 *
 * Shared with the /policies/finance page via FINANCE_LINKS.
 */
const FINANCING_PARTNERS = [
  {
    name: 'Acima Leasing',
    href: FINANCE_LINKS.acima,
    ...financingLogo('acima', 90),
  },
  {
    name: 'American First Finance',
    href: FINANCE_LINKS.americanFirst,
    ...financingLogo('american', 94),
  },
  {
    name: 'Progressive Leasing',
    href: FINANCE_LINKS.progressive,
    ...financingLogo('progressive_leasing', 75),
  },
  {
    name: 'Synchrony',
    href: FINANCE_LINKS.synchrony,
    ...financingLogo('synchrony', 44),
  },
];

function FinancingPartners() {
  const {publish} = useAnalytics();

  // A click here sends the shopper to start a lease/financing application on
  // the partner's own site — the same "shopper handed off to start something
  // with intent" shape as the appointment form, so it's reported the same way
  // (see AppointmentModal), just under its own name rather than the generic
  // `generate_lead` GA4 uses elsewhere. `method` carries which partner,
  // matching how useTrackConversion's newsletter/appointment events use
  // `method` for their own surface. `SubmitApplication`, not `Lead` — Meta's
  // own standard event for this exact case (a credit/lease application), not
  // a generic inquiry.
  const trackFinancingClick = (partner: string) => () =>
    publish('custom_ga4', {
      event: 'finance_link',
      params: {method: partner},
      metaEvent: 'SubmitApplication',
    });

  return (
    <>
      {/* Heading sits outside the bordered box; `aria-labelledby` resolves by
          id across the document, so the section stays named regardless. */}

      <section
        className="product-financing"
        aria-labelledby="product-financing-label"
      >
        <h2 className="product-financing-label" id="product-financing-label">
          Financing available
        </h2>
        <ul className="product-financing-list">
          {FINANCING_PARTNERS.map((partner) => (
            // flex-basis 0 + this grow factor makes the ratios describe the
            // final widths outright, rather than only sharing out leftovers.
            <li key={partner.name} style={{flexGrow: partner.weight}}>
              <a
                href={partner.href}
                target="_blank"
                // Third-party lenders: `noopener` because of target=_blank, and
                // `nofollow` so a commercial partner link can't be read as a
                // link scheme or bleed ranking signal off the store.
                rel="noopener noreferrer nofollow"
                className="product-financing-link"
                onClick={trackFinancingClick(partner.name)}
              >
                <img
                  src={partner.src}
                  alt={partner.name}
                  loading="lazy"
                  decoding="async"
                />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * Placeholder for the rail while its deferred query resolves.
 *
 * It used to be `fallback={null}`, which collapsed the section to zero height
 * — so every switch to a sibling product (a Karat or Length value, which is a
 * different product and therefore a real navigation) made the page jump as the
 * rail vanished and popped back. That jump is most of what reads as "the page
 * reloaded" when nothing is reloading at all.
 *
 * Borrows the carousel's own class names rather than defining a parallel
 * layout, so the placeholder inherits the real rail's track padding, 1.5rem
 * gap, card width and the .pdp-similar mobile overrides — and cannot drift out
 * of alignment with it when those change.
 */
function RelatedProductsSkeleton() {
  return (
    <div className="hcarousel slider-carousel" aria-hidden="true">
      <div className="hcarousel-viewport">
        <div className="hcarousel-track">
          {Array.from({length: 4}).map((_, index) => (
            <article
              className="product-item product-skeleton slider-item"
              key={index}
            >
              <div className="product-image-skeleton" />
              <div className="product-card-body">
                <div className="product-text-skeleton is-title" />
                <div className="product-text-skeleton is-price" />
              </div>
            </article>
          ))}
        </div>
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
        </div>
      </div>
      <Suspense fallback={<RelatedProductsSkeleton />}>
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
                {/* All lazy. The first four used to be eager, which is right
                    for a rail near the top of a collection page and wrong
                    here: this one sits below the gallery, the buy panel, the
                    description and the FAQs, so four eager cards were ~240 KB
                    fetched at LCP priority for a section a phone screen never
                    shows. `<Suspense>` already holds them back to a second
                    payload; `lazy` keeps them out of the first one's way. */}
                {items.map((product) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    className="slider-item"
                    /* .slider-item is `min(240px, 62vw)` — capped at 240px. */
                    sizes="240px"
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

/**
 * The collection segment is echoed into a breadcrumb link, so it is validated
 * rather than trusted — anything that isn't handle-shaped is dropped and the
 * page falls back to the product's own category.
 */
function normalizeCollectionHandle(value: string | null) {
  if (!value) return null;
  const handle = value.trim();
  return /^[a-z0-9][a-z0-9-]*$/i.test(handle) ? handle : null;
}

function buildProductJsonLd({
  product,
  selectedVariant,
  mediaItems,
  origin,
  priceValidUntil,
  validFrom,
}: {
  product: any;
  selectedVariant: any;
  mediaItems: GalleryMedia[];
  origin: string;
  priceValidUntil: string;
  validFrom: string;
}) {
  const images = mediaItems
    .map((item) => (item.kind === 'image' ? item.image?.url : item.thumbUrl))
    .filter((url): url is string => Boolean(url));
  const price = selectedVariant?.price;
  // Must match the <link rel="canonical"> emitted by `meta` above â€” a product
  // that advertises two different URLs splits its own ranking signals.
  const url = absoluteUrl(origin, productCanonicalPath(product));

  // Every variant the page already holds, deduped by id. The query fetches
  // `selectedOrFirstAvailableVariant`, `adjacentVariants` and one
  // `firstSelectableVariant` per option value — Hydrogen deliberately does NOT
  // fetch the full variants() connection, so this is the complete set available
  // without a second round-trip. Each entry is a real variant with a real SKU
  // and price; nothing here is synthesised from option names.
  const variantById = new Map<string, any>();
  for (const variant of [
    selectedVariant,
    ...(product.adjacentVariants ?? []),
    ...(product.options ?? []).flatMap((option: any) =>
      (option.optionValues ?? []).map(
        (value: any) => value.firstSelectableVariant,
      ),
    ),
  ]) {
    if (variant?.id && !variantById.has(variant.id)) {
      variantById.set(variant.id, variant);
    }
  }

  // schema.org URLs for the option axes this product actually varies by, so
  // `variesBy` describes THIS product rather than a fixed guess. Anything with
  // no sensible schema.org property is left out rather than mapped to a
  // near-miss — an option Google cannot interpret is better absent than wrong.
  const VARIES_BY: Record<string, string> = {
    karat: 'https://schema.org/material',
    material: 'https://schema.org/material',
    metal: 'https://schema.org/material',
    color: 'https://schema.org/color',
    colour: 'https://schema.org/color',
    size: 'https://schema.org/size',
    length: 'https://schema.org/size',
    width: 'https://schema.org/width',
  };
  const variesBy = (product.options ?? [])
    .map((option: any) => VARIES_BY[String(option?.name ?? '').toLowerCase()])
    .filter(
      (value: string | undefined, index: number, all: (string | undefined)[]) =>
        value && all.indexOf(value) === index,
    );

  const hasVariant = [...variantById.values()].map((variant) => ({
    '@type': 'Product',
    // The variant's own option wording ('10K / 20"'), not the parent title —
    // `hasVariant` entries that all share one name describe nothing.
    name:
      variant.title && variant.title !== 'Default Title'
        ? `${product.title} — ${variant.title}`
        : product.title,
    sku: cleanSku(variant.sku),
    mpn: cleanSku(variant.sku),
    image: variant.image?.url || undefined,
    offers: variant.price
      ? {
          '@type': 'Offer',
          url,
          price: Number(variant.price.amount).toFixed(2),
          priceCurrency: variant.price.currencyCode,
          priceValidUntil,
          validFrom,
          availability: variant.availableForSale
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {'@id': `${origin}/#organization`},
          shippingDetails: offerShippingDetails(variant.price),
          hasMerchantReturnPolicy: MERCHANT_RETURN_POLICY,
        }
      : undefined,
  }));

  return {
    '@context': 'https://schema.org',
    // ProductGroup, not Product: these pieces vary by karat and size, and a
    // single Product node could only ever advertise the selected variant's
    // price. The parent keeps its own `offers` as well, so the canonical
    // price/availability signal that was already indexed does not disappear.
    '@type': hasVariant.length > 1 ? 'ProductGroup' : 'Product',
    ...(hasVariant.length > 1
      ? {
          productGroupID: product.id,
          ...(variesBy.length ? {variesBy} : {}),
          hasVariant,
        }
      : {}),
    // Stable node id so the Offer and the sitewide Organization resolve into
    // one graph rather than three unrelated fragments. Retrieval-based AI
    // engines follow these references; without them the price, the seller and
    // the product read as facts about three different things.
    '@id': `${url}#product`,
    name: product.title,
    url,
    mainEntityOfPage: url,
    brand: {
      '@type': 'Brand',
      name: SITE.name,
    },
    // Falls back to the sitewide description (via metaDescription, same
    // helper the <meta> tag uses) rather than `undefined` — a product with no
    // authored description or SEO description would otherwise publish
    // Product markup with no `description` field at all.
    description: metaDescription(
      product.seo?.description || product.description,
    ),
    image: images.length ? images : undefined,
    // No `|| product.handle` fallback. A URL slug is not a manufacturer part
    // number, and inventing one publishes a fabricated identifier that Google
    // may try to match against real product feeds. Omitted is honest; `sku`
    // below already carries the real identifier when there is one.
    mpn: cleanSku(selectedVariant?.sku),
    sku: cleanSku(selectedVariant?.sku),
    offers: price
      ? {
          '@type': 'Offer',
          url,
          // The API returns a bare decimal — "440.0" — while og:price:amount
          // publishes "440.00" for the same variant. Two prices that differ in
          // text is a needless mismatch for anything reconciling the two.
          price: Number(price.amount).toFixed(2),
          priceCurrency: price.currencyCode,
          priceValidUntil,
          validFrom,
          availability: selectedVariant?.availableForSale
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {'@id': `${origin}/#organization`},
          shippingDetails: offerShippingDetails(price),
          hasMerchantReturnPolicy: MERCHANT_RETURN_POLICY,
        }
      : undefined,
  };
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
    # VideoObject.uploadDate. See buildVideoJsonLd's caller for why this
    # stands in for the real upload date.
    publishedAt
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
    # New Arrival badge — see cardBadges() in ProductItem.tsx.
    publishedAt
    # Resolve each card's canonical /collections/<category>/products/<handle>
    # link. Without them the card falls back to the flat path, which 301s.
    productType
    category {
      name
    }
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
    # Card badges. Tags drive Karat/Diamond and best-sellers
    # membership drives Best Seller. See cardBadges() in
    # ProductItem.tsx for why only those, and only from here.
    tags
    collections(first: 15) {
      nodes {
        handle
      }
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
      # Card badges: a Sale badge must come from a real
      # compare-at price, never from a tag someone typed.
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
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
