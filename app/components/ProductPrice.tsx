import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {formatUsd, savingsFor} from '~/lib/discount';

export function ProductPrice({
  price,
  compareAtPrice,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
}) {
  // Only a verified markdown is struck through. A bad compare-at shows the price alone.
  const savings =
    price && compareAtPrice
      ? savingsFor(price.amount, compareAtPrice.amount)
      : null;
  return (
    <div className="product-price">
      {savings && price && compareAtPrice ? (
        <div className="product-price-on-sale">
          <Money data={price} />
          <s>
            <Money data={compareAtPrice} />
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
   