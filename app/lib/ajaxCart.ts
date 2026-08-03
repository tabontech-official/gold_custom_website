/**
 * Hydrogen cart -> Shopify AJAX Cart API (`/cart.js`) shape.
 *
 * Liquid storefronts expose the cart at `/cart.js`, and scripts written for a
 * Shopify theme assume it exists — Tidio's chat polls it so agents can see what
 * is in a shopper's bag. Hydrogen has no such endpoint, so those scripts 404.
 * routes/[cart.js].tsx serves this instead.
 *
 * The AJAX API reports money as integer minor units ("$440.00" -> 44000), not
 * decimal strings the way the Storefront API does. Getting that wrong shows a
 * $440 cart as $4.40, so the conversion is the part worth testing.
 *
 * ponytail: only the fields a cart-reading script actually needs. Shopify's
 * real payload has more (taxable, grams, product_description); add one when
 * something is demonstrably reading it.
 */

type Money = {amount: string; currencyCode: string};

type Attribute = {key: string; value?: string | null};

type CartLineInput = {
  id: string;
  quantity: number;
  attributes?: Attribute[] | null;
  cost: {totalAmount?: Money | null; amountPerQuantity?: Money | null};
  merchandise?: {
    id: string;
    title?: string | null;
    requiresShipping?: boolean | null;
    image?: {url: string} | null;
    price?: Money | null;
    compareAtPrice?: Money | null;
    product?: {
      id: string;
      handle: string;
      title: string;
      vendor?: string | null;
    } | null;
    selectedOptions?: Array<{name: string; value: string}> | null;
  } | null;
};

export type CartInput = {
  id?: string | null;
  totalQuantity?: number | null;
  note?: string | null;
  attributes?: Attribute[] | null;
  cost?: {totalAmount?: Money | null; subtotalAmount?: Money | null} | null;
  lines?: {nodes?: CartLineInput[] | null} | null;
  discountCodes?: Array<{code: string; applicable?: boolean | null}> | null;
} | null;

/** "440.00" -> 44000. The AJAX API is integer minor units throughout. */
export function toCents(money?: Money | null): number {
  const amount = Number(money?.amount);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/** `gid://shopify/ProductVariant/123` -> 123 (0 when absent or malformed). */
export function gidToNumber(gid?: string | null): number {
  const id = Number(gid?.split('/').pop());
  return Number.isFinite(id) && id > 0 ? id : 0;
}

const properties = (attributes?: Attribute[] | null) =>
  Object.fromEntries((attributes ?? []).map((a) => [a.key, a.value ?? '']));

export function toAjaxCart(cart: CartInput) {
  const lines = cart?.lines?.nodes ?? [];
  const currency = cart?.cost?.totalAmount?.currencyCode || 'USD';

  const items = lines.map((line) => {
    const variant = line.merchandise;
    const product = variant?.product;
    const variantId = gidToNumber(variant?.id);
    const unit = toCents(line.cost?.amountPerQuantity ?? variant?.price);
    const linePrice = toCents(line.cost?.totalAmount);
    const compareAt = toCents(variant?.compareAtPrice);
    const variantTitle = variant?.title ?? null;
    const productTitle = product?.title ?? '';

    return {
      // Shopify keys a cart item by its variant id, not the line id.
      id: variantId,
      variant_id: variantId,
      product_id: gidToNumber(product?.id),
      key: line.id,
      quantity: line.quantity,
      // "Product - Variant", collapsing the placeholder Shopify uses when a
      // product has no real options.
      title:
        variantTitle && variantTitle !== 'Default Title'
          ? `${productTitle} - ${variantTitle}`
          : productTitle,
      product_title: productTitle,
      variant_title: variantTitle,
      product_has_only_default_variant: variantTitle === 'Default Title',
      variant_options: (variant?.selectedOptions ?? []).map((o) => o.value),
      properties: properties(line.attributes),
      price: unit,
      final_price: unit,
      // Shopify reports the pre-discount unit price here, which is the
      // compare-at when there is one and the price itself otherwise.
      original_price: compareAt || unit,
      line_price: linePrice,
      final_line_price: linePrice,
      original_line_price: compareAt ? compareAt * line.quantity : linePrice,
      total_discount: 0,
      discounts: [],
      vendor: product?.vendor ?? '',
      handle: product?.handle ?? '',
      url: product?.handle
        ? `/products/${product.handle}?variant=${variantId}`
        : '',
      image: variant?.image?.url ?? null,
      featured_image: {url: variant?.image?.url ?? null},
      requires_shipping: variant?.requiresShipping !== false,
      gift_card: false,
      sku: null,
      grams: 0,
    };
  });

  const total = toCents(cart?.cost?.totalAmount);

  return {
    // Not Shopify's cart token — that isn't exposed to the Storefront API.
    // Stable per cart, which is all a cart-reading script needs it for.
    token: gidToNumber(cart?.id?.split('?')[0]) || '',
    note: cart?.note ?? null,
    attributes: properties(cart?.attributes),
    original_total_price: total,
    total_price: total,
    total_discount: 0,
    total_weight: 0,
    item_count: cart?.totalQuantity ?? 0,
    items,
    requires_shipping: items.some((i) => i.requires_shipping),
    currency,
    items_subtotal_price: toCents(cart?.cost?.subtotalAmount),
    cart_level_discount_applications: [],
    discount_codes: (cart?.discountCodes ?? []).map((d) => ({
      code: d.code,
      applicable: d.applicable !== false,
    })),
  };
}
