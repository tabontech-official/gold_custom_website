import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {formatUsd, savingsFor} from '~/lib/discount';
import {promotionPricing} from '~/lib/promotionPricing';

export function ProductPrice({
  price,
  compareAtPrice,
  product,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
  product?: Parameters<typeof promotionPricing>[0];
}) {
  const pricing =
    product && price
      ? promotionPricing(product, {price, compareAtPrice})
      : null;
  const displayedPrice = (pricing?.price as MoneyV2 | undefined) ?? price;
  const displayedComparison =
    (pricing?.compareAtPrice as MoneyV2 | null | undefined) ?? compareAtPrice;
  const savings =
    displayedPrice && displayedComparison
      ? savingsFor(displayedPrice.amount, displayedComparison.amount)
      : null;
  return (
    <div className="product-price">
      {savings && displayedPrice && displayedComparison ? (
        <div className="product-price-on-sale">
          <Money data={displayedPrice} />
          <s>
            <Money data={displayedComparison} />
          </s>
          <span className="product-savings">
            {savings.percent}% OFF · You save {formatUsd(savings.amount)}
          </span>
        </div>
      ) : displayedPrice ? (
        <Money data={displayedPrice} />
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}
