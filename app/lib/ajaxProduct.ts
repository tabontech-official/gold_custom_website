import {parseGid} from '@shopify/hydrogen';

/**
 * Storefront product -> Shopify's `/products/<handle>.json` shape.
 *
 * Liquid storefronts serve that endpoint and Hydrogen does not, so theme-era
 * scripts 404 on it. Reputon's TikTok widget fetches it once per tagged product
 * to fill the "shop this clip" popup — options, per-variant price, availability
 * and the variant id it posts to /cart/add.js. Its fallback when the fetch
 * fails is the stale copy Reputon synced, so without this the popup shows last
 * sync's prices. Sibling of lib/ajaxCart.ts; routes/products.$handle[.json].tsx
 * serves it.
 *
 * One deliberate departure from Shopify's payload: a top-level `currency`,
 * which Liquid's JSON does not carry. The widget builds its price label as
 * `currency + " " + variant.price`, so without it every price in the popup
 * renders as "undefined 308".
 *
 * ponytail: only the fields something is actually reading. Shopify's real
 * payload has ~20 more (tags, template_suffix, grams, published_scope); add one
 * when a script demonstrably wants it.
 */

type Money = {amount: string; currencyCode: string};

type ProductInput = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string | null;
  vendor?: string | null;
  productType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
  options?: Array<{name: string; optionValues?: Array<{name: string}> | null}>;
  // `id` is nullable on Storefront's Image and MediaImage types, so it stays
  // optional here and `numericId` answers null for the ones without one.
  images?: {
    nodes: Array<{id?: string | null; url: string; altText?: string | null}>;
  };
  variants?: {
    nodes: Array<{
      id: string;
      title: string;
      sku?: string | null;
      availableForSale: boolean;
      requiresShipping?: boolean | null;
      price: Money;
      compareAtPrice?: Money | null;
      selectedOptions: Array<{name: string; value: string}>;
      image?: {id?: string | null} | null;
    }>;
  };
};

/** `gid://shopify/ProductVariant/123` -> 123. Liquid reports ids as numbers. */
function numericId(gid: string | null | undefined): number | null {
  const parsed = gid ? Number(parseGid(gid).id) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The Storefront API trims trailing zeros ("308.0"); Liquid pads to the
 * currency's precision ("308.00"). The widget prints the string it is given
 * verbatim, so the padding is the difference between "$308.00" and "$308.0" on
 * the card. Intl supplies the digit count so zero-decimal currencies (JPY) stay
 * whole.
 */
export function toLiquidPrice(money: Money): string {
  const digits = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: money.currencyCode,
  }).resolvedOptions().minimumFractionDigits;

  const amount = Number(money.amount);
  return Number.isFinite(amount) ? amount.toFixed(digits) : money.amount;
}

export function toAjaxProduct(product: ProductInput) {
  const optionNames = (product.options ?? []).map((option) => option.name);
  const variants = product.variants?.nodes ?? [];
  const currency = variants[0]?.price?.currencyCode ?? 'USD';

  return {
    product: {
      id: numericId(product.id),
      title: product.title,
      handle: product.handle,
      body_html: product.descriptionHtml ?? '',
      published_at: product.publishedAt ?? null,
      created_at: product.createdAt ?? null,
      updated_at: product.updatedAt ?? null,
      vendor: product.vendor ?? '',
      product_type: product.productType ?? '',
      // See the header — not part of Shopify's payload, needed for prices.
      currency,
      variants: variants.map((variant, index) => ({
        id: numericId(variant.id),
        product_id: numericId(product.id),
        title: variant.title,
        // Liquid flattens the option values into three positional fields, in
        // the order the product declares its options — that is what the
        // widget's variant matcher compares against.
        option1: optionValueAt(variant, optionNames, 0),
        option2: optionValueAt(variant, optionNames, 1),
        option3: optionValueAt(variant, optionNames, 2),
        sku: variant.sku ?? '',
        requires_shipping: variant.requiresShipping ?? true,
        available: variant.availableForSale,
        // Decimal strings, as Liquid reports them ("308.00", not 30800).
        price: toLiquidPrice(variant.price),
        compare_at_price: variant.compareAtPrice
          ? toLiquidPrice(variant.compareAtPrice)
          : null,
        image_id: numericId(variant.image?.id),
        position: index + 1,
      })),
      images: (product.images?.nodes ?? []).map((image, index) => ({
        id: numericId(image.id),
        src: image.url,
        alt: image.altText ?? null,
        position: index + 1,
      })),
      image: product.images?.nodes?.[0]
        ? {
            id: numericId(product.images.nodes[0].id),
            src: product.images.nodes[0].url,
          }
        : null,
      options: (product.options ?? []).map((option, index) => ({
        name: option.name,
        position: index + 1,
        values: (option.optionValues ?? []).map((value) => value.name),
      })),
    },
  };
}

function optionValueAt(
  variant: {selectedOptions: Array<{name: string; value: string}>},
  optionNames: string[],
  index: number,
): string | null {
  const name = optionNames[index];
  if (!name) return null;
  return (
    variant.selectedOptions.find((option) => option.name === name)?.value ??
    null
  );
}
