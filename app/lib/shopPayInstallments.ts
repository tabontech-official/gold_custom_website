/**
 * Data for the `shopify-payment-terms` element — the Shop Pay Installments
 * banner and its "sample plans" modal, rendered on the product page.
 *
 * Shopify's element takes one `shopify-meta` blob, the same one the Liquid
 * storefront produces from `{{ form | payment_terms }}`. The shop-level half of
 * it (the financing plans and the eligible price range) comes from
 * `shop.shopPayInstallmentsPricing`; the per-variant half is derived from the
 * variant's price, which is how the Liquid output reproduces exactly.
 *
 * `shopPayInstallmentsPricing` needs the storefront token to hold the
 * `unauthenticated_read_shop_pay_installments_pricing` access scope. Without it
 * the field returns an ACCESS_DENIED error rather than data, so the caller
 * falls back to FALLBACK_PRICING below and the banner keeps working.
 */

export const SHOP_PAY_INSTALLMENTS_QUERY = `#graphql
  query ShopPayInstallments($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    shop {
      shopPayInstallmentsPricing {
        minPrice { amount currencyCode }
        maxPrice { amount currencyCode }
        financingPlans {
          minPrice { amount currencyCode }
          maxPrice { amount currencyCode }
          terms {
            apr
            loanType
            installmentsCount { count }
          }
        }
      }
    }
  }
` as const;

type Money = {amount: string; currencyCode: string};

/** Shape of `shop.shopPayInstallmentsPricing`, structural so the fallback fits. */
export type InstallmentsPricing = {
  minPrice: Money;
  maxPrice: Money;
  financingPlans: Array<{
    minPrice: Money;
    maxPrice: Money;
    terms: Array<{
      apr: number;
      loanType: string;
      installmentsCount?: {count: number} | null;
    }>;
  }>;
};

const usd = (amount: string): Money => ({amount, currencyCode: 'USD'});

/**
 * The store's Shop Pay Installments settings as of 2026-08-03, transcribed from
 * the Liquid storefront's rendered `shopify-meta`. Used only while the
 * storefront token lacks `unauthenticated_read_shop_pay_installments_pricing`;
 * once that scope is granted the live query supersedes it and this can go.
 *
 * ponytail: a snapshot, not a source of truth — delete it, don't maintain it.
 */
export const FALLBACK_PRICING: InstallmentsPricing = {
  minPrice: usd('35.00'),
  maxPrice: usd('30000.00'),
  financingPlans: [
    {
      minPrice: usd('35.00'),
      maxPrice: usd('49.99'),
      terms: [
        {apr: 0, loanType: 'SPLIT_PAY', installmentsCount: {count: 2}},
      ],
    },
    {
      minPrice: usd('50.00'),
      maxPrice: usd('149.99'),
      terms: [
        {apr: 0, loanType: 'SPLIT_PAY', installmentsCount: {count: 4}},
      ],
    },
    {
      minPrice: usd('150.00'),
      maxPrice: usd('999.99'),
      terms: [
        {apr: 0, loanType: 'SPLIT_PAY', installmentsCount: {count: 4}},
        {apr: 15, loanType: 'INTEREST', installmentsCount: {count: 3}},
        {apr: 15, loanType: 'INTEREST', installmentsCount: {count: 6}},
        {apr: 15, loanType: 'INTEREST', installmentsCount: {count: 12}},
      ],
    },
    {
      minPrice: usd('1000.00'),
      maxPrice: usd('30000.00'),
      terms: [
        {apr: 15, loanType: 'INTEREST', installmentsCount: {count: 3}},
        {apr: 15, loanType: 'INTEREST', installmentsCount: {count: 6}},
        {apr: 15, loanType: 'INTEREST', installmentsCount: {count: 12}},
      ],
    },
  ],
};

/**
 * Builds the `shopify-meta` value for one variant, or null when the variant
 * has no usable price. Money is emitted as display strings ("$1,000.00")
 * because that is what the element parses.
 */
export function buildShopPayMeta({
  pricing,
  variantId,
  price,
  available,
}: {
  pricing: InstallmentsPricing;
  /** Bare numeric variant id — the element rejects Storefront gids. */
  variantId: number;
  price: Money;
  available: boolean;
}) {
  const amount = Number(price.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const currency = price.currencyCode || 'USD';
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);

  const plan = pricing.financingPlans.find(
    (p) =>
      amount >= Number(p.minPrice.amount) && amount <= Number(p.maxPrice.amount),
  );

  // Split-pay count when the price band offers one. Interest-only bands fall
  // back to 2, which is what the Liquid storefront emits for them.
  const terms =
    plan?.terms.find((t) => t.loanType === 'SPLIT_PAY')?.installmentsCount
      ?.count ?? 2;

  return {
    type: 'product',
    currency_code: currency,
    // Gold Custom sells US-only; the element uses this to pick its legal copy.
    country_code: 'US',
    variants: [
      {
        id: variantId,
        price_per_term: money(amount / terms),
        full_price: money(amount),
        eligible: Boolean(plan),
        available,
        number_of_payment_terms: terms,
      },
    ],
    min_price: money(Number(pricing.minPrice.amount)),
    max_price: money(Number(pricing.maxPrice.amount)),
    financing_plans: pricing.financingPlans.map((p) => ({
      min_price: money(Number(p.minPrice.amount)),
      max_price: money(Number(p.maxPrice.amount)),
      terms: p.terms.map((t) => ({
        apr: t.apr,
        loan_type: t.loanType.toLowerCase(),
        installments_count: t.installmentsCount?.count ?? 0,
      })),
    })),
    installments_buyer_prequalification_enabled: true,
  };
}

/** `gid://shopify/ProductVariant/123` -> 123, or null if it isn't one. */
export function variantIdNumber(gid?: string | null) {
  const id = Number(gid?.split('/').pop());
  return Number.isFinite(id) && id > 0 ? id : null;
}
