// Run with: node --test app/lib/ajaxProduct.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {toAjaxProduct, toLiquidPrice} from './ajaxProduct.ts';

const usd = (amount: string) => ({amount, currencyCode: 'USD'});

const product = {
  id: 'gid://shopify/Product/9397320089848',
  title: '10K Solid Gold Miami Cuban Bracelet',
  handle: '10k-miami-cuban',
  descriptionHtml: '<p>Solid gold.</p>',
  vendor: 'Gold Custom',
  productType: 'Bracelet',
  publishedAt: '2024-01-01T00:00:00Z',
  options: [
    {name: 'Gold Purity', optionValues: [{name: '10K'}, {name: '14K'}]},
    {name: 'Length', optionValues: [{name: '7"'}, {name: '8"'}]},
  ],
  images: {
    nodes: [
      {id: 'gid://shopify/ProductImage/1', url: 'https://cdn/a.jpg'},
      {id: 'gid://shopify/ProductImage/2', url: 'https://cdn/b.jpg'},
    ],
  },
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/47953363468536',
        title: '10K / 7"',
        sku: 'SMCUB-7',
        availableForSale: true,
        price: usd('308.0'),
        compareAtPrice: usd('400.0'),
        // Deliberately out of the product's option order — the mapper has to
        // flatten by option NAME, not by array position.
        selectedOptions: [
          {name: 'Length', value: '7"'},
          {name: 'Gold Purity', value: '10K'},
        ],
        image: {id: 'gid://shopify/ProductImage/2'},
      },
      {
        id: 'gid://shopify/ProductVariant/47953363468537',
        title: '14K / 8"',
        availableForSale: false,
        price: usd('612.5'),
        selectedOptions: [
          {name: 'Gold Purity', value: '14K'},
          {name: 'Length', value: '8"'},
        ],
      },
    ],
  },
};

test('flattens options into Liquid option1..3, in the product option order', () => {
  const [first, second] = toAjaxProduct(product).product.variants;

  assert.equal(first.option1, '10K');
  assert.equal(first.option2, '7"');
  assert.equal(first.option3, null);
  assert.equal(second.option1, '14K');
  assert.equal(second.option2, '8"');
});

test('reports ids as numbers, the way the AJAX API does', () => {
  const {product: mapped} = toAjaxProduct(product);

  assert.equal(mapped.id, 9397320089848);
  assert.equal(mapped.variants[0].id, 47953363468536);
  assert.equal(mapped.variants[0].image_id, 2);
  assert.equal(mapped.variants[1].image_id, null);
  assert.equal(mapped.image?.id, 1);
});

test('pads prices to the currency precision', () => {
  const {product: mapped} = toAjaxProduct(product);

  assert.equal(mapped.currency, 'USD');
  assert.equal(mapped.variants[0].price, '308.00');
  assert.equal(mapped.variants[0].compare_at_price, '400.00');
  assert.equal(mapped.variants[1].price, '612.50');
  assert.equal(mapped.variants[1].compare_at_price, null);
  // Zero-decimal currencies must not grow cents.
  assert.equal(toLiquidPrice({amount: '3080', currencyCode: 'JPY'}), '3080');
});

test('carries availability through, so the popup can grey out sold-out options', () => {
  const {product: mapped} = toAjaxProduct(product);

  assert.equal(mapped.variants[0].available, true);
  assert.equal(mapped.variants[1].available, false);
});
