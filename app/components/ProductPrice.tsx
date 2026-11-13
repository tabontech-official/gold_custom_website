import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {formatUsd, savingsFor} from '~/lib/discount';
import {illustrativePrice} from '~/lib/illustrativePrice';

export function ProductPrice({
  price,
  compareAtPrice,
  illustrativeHandle,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
  illustrativeHandle?: string;
}) {
  // Only a verified markdown is struck through. A bad compare-at shows the price alone.
  const actualSavings =
    price && compareAtPrice
      ? savingsFor(price.amount, compareAtPrice.amount)
      : null;
  const illustrative =
    !actualSavings && price && illustrativeHandle
      ? illustrativePrice(price.amount, illustrativeHandle)
      : null;
  const comparison =
    illustrative && price
      ? {...price, amount: illustrative.comparison}
      : compareAtPrice;
  const savings = actualSavings ?? illustrative;
  return (
    <div className="product-price">
      {savings && price && comparison ? (
        <div className="product-price-on-sale">
          <Money data={price} />
          <s>
            <Money data={comparison} />
          </s>
          <span className="product-savings">
            {savings.percent}% OFF · You save {formatUsd(savings.amount)}
          </span>
        </div>
      ) : price ? (
        <Money data={price} />
      ) : (
        <span>&nbsp;</span>
      )}
      
    </div>
  );
}
