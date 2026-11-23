import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

type Money = Pick<MoneyV2, 'amount' | 'currencyCode'>;
type Product = {
  title?: string | null;
  handle?: string | null;
  productType?: string | null;
  category?: {name?: string | null} | null;
  collections?: {nodes?: {handle?: string | null}[]} | null;
  selectedOrFirstAvailableVariant?: Variant | null;
  priceRange?: {minVariantPrice: Money};
};
type Variant = {price: Money; compareAtPrice?: Money | null};

/** Frontend campaign presentation only; never mutates Shopify/cart amounts. */
export function promotionPricing(product: Product, variant?: Variant | null) {
  const selected = variant ?? product.selectedOrFirstAvailableVariant;
  const price = selected?.price ?? product.priceRange?.minVariantPrice;
  if (!price) return null;
  const value = Number(price.amount);
  if (!Number.isFinite(value) || value <= 0)
    return {price, compareAtPrice: null, promotional: false};
  const compareAt = selected?.compareAtPrice;
  // Every genuine backend markdown wins, including existing engagement sales.
  if (
    compareAt &&
    Number.isFinite(Number(compareAt.amount)) &&
    Number(compareAt.amount) > value
  ) {
    return {price, compareAtPrice: compareAt, promotional: false};
  }
  const description =
    `${product.title ?? ''} ${product.productType ?? ''} ${product.category?.name ?? ''} ${product.handle ?? ''}`.replace(
      /-/g,
      ' ',
    );
  const inChainCollection = product.collections?.nodes?.some((node) =>
    /\bchains?\b/i.test((node.handle ?? '').replace(/-/g, ' ')),
  );
  const chain =
    (inChainCollection || /\b(chains?|necklaces?)\b/i.test(description)) &&
    !/\b(bracelets?|bangles?|pendants?|charms?|earrings?|rings?)\b/i.test(
      description,
    );
  const percent = chain ? 15 : value > 400 ? 10 : 0;
  if (!percent || price.currencyCode !== 'USD')
    return {price, compareAtPrice: null, promotional: false};
  const cents = Math.round(value * 100);
  const discounted = Math.round((cents * (100 - percent)) / 100);
  return {
    price: {...price, amount: (discounted / 100).toFixed(2)},
    compareAtPrice: price,
    promotional: true,
  };
}
