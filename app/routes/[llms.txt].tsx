import type {Route} from './+types/[llms.txt]';
import {CATEGORIES, productCanonicalPath} from '~/lib/categories';
import {siteOrigin} from '~/lib/seo';

/**
 * /llms.txt — a machine-readable store summary for LLM agents.
 *
 * Convention from llmstxt.org: a short Markdown document at a well-known path
 * that gives an agent the store's shape without crawling and re-deriving it
 * from HTML. Not a search-engine standard and not a ranking factor — this is
 * purely for AI answer engines and shopping agents.
 *
 * Kept deliberately small: an agent should be able to read the whole thing in
 * one fetch and know where to go next. Deep data lives behind the sitemap.
 */
export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const [{shop}, topProducts] = await Promise.all([
    context.storefront.query(LLMS_SHOP_QUERY),
    // Best sellers are the one product list worth inlining: an agent that
    // fetches this file and stops would otherwise leave knowing the store's
    // shape but not a single thing it sells. Failure here must not 500 the
    // file — the rest of the document is still useful without it.
    context.storefront.query(LLMS_PRODUCTS_QUERY).catch((error: Error) => {
      console.error(error);
      return null;
    }),
  ]);
  // Not shop.primaryDomain: that is the Online Store channel's domain, which
  // on this shop is still goldcustomedo.myshopify.com. See siteOrigin().
  const origin = siteOrigin();
  const description = (shop?.description ?? '').replace(/\s+/g, ' ').trim();
  const products = topProducts?.products?.nodes ?? [];

  const body = `# ${shop?.name ?? 'Gold Custom'}

> ${description || 'Fine gold jewelry — rings, chains, bracelets, pendants and charms in 10K and 14K gold.'}

## About

${shop?.name ?? 'Gold Custom'} is an online fine-jewelry store. Product pages carry
schema.org Product JSON-LD with live price, currency, availability and SKU —
prefer that structured data over scraping rendered HTML.

## Browse

${CATEGORIES.map((c) => `- [${c.label}](${origin}/collections/${c.handle})`).join('\n')}
${productSection(origin, products)}
## Key pages

- [All products](${origin}/collections/all)
- [Search](${origin}/search?q=) — append a query string
- [Contact](${origin}/contact)
- [Blog](${origin}/blogs)
- [Policies](${origin}/policies) — shipping, returns, warranty

## Machine-readable endpoints

- [Sitemap index](${origin}/sitemap.xml) — every indexable product, collection, page and article
- [robots.txt](${origin}/robots.txt)

## Notes for agents

- Canonical product URLs are /collections/{collection}/products/{handle}, where
  the collection is the product's own category. A product listed in several
  collections is reachable under each of them; every one of those pages names
  the same canonical, so treat that canonical as the product's identity.
- A bare /products/{handle} redirects to it; follow the redirect.
- Prices and availability change; always re-read the Product JSON-LD rather
  than relying on a cached value.
- /cart, /account, /wishlist and /checkout are user-specific and not indexable.
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

/**
 * Best sellers, with the price inline so an agent can answer "what do they
 * sell and roughly what does it cost" from this one fetch.
 *
 * Prices are a snapshot and the note says so — gold pricing moves, and an
 * agent that caches this file must be told to re-read the Product JSON-LD
 * before quoting a figure to a buyer.
 *
 * Renders to nothing when the query failed, rather than an empty heading.
 */
function productSection(
  origin: string,
  products: Array<{
    handle: string;
    title: string;
    productType?: string | null;
    category?: {name?: string | null} | null;
    priceRange?: {minVariantPrice?: {amount?: string; currencyCode?: string}};
  }>,
) {
  if (!products.length) return '';

  const lines = products.map((product) => {
    const price = product.priceRange?.minVariantPrice;
    const amount = price?.amount ? Number(price.amount) : null;
    // Canonical /collections/<category>/products/<handle>, matching the
    // product page's own canonical tag — a flat /products/<handle> here would
    // just 301.
    const path = productCanonicalPath(product);
    const cost =
      amount !== null && Number.isFinite(amount)
        ? ` — from ${price?.currencyCode === 'USD' ? '$' : ''}${amount.toFixed(2)}${price?.currencyCode === 'USD' ? '' : ` ${price?.currencyCode ?? ''}`.trimEnd()}`
        : '';
    return `- [${product.title}](${origin}${path})${cost}`;
  });

  return `
## Best sellers

Prices are a snapshot taken when this file was served. Re-read the Product
JSON-LD on the product page before quoting a price or availability.

${lines.join('\n')}
`;
}

const LLMS_PRODUCTS_QUERY = `#graphql
  query LlmsProducts($country: CountryCode, $language: LanguageCode)
   @inContext(country: $country, language: $language) {
    products(first: 20, sortKey: BEST_SELLING) {
      nodes {
        handle
        title
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
      }
    }
  }
` as const;

const LLMS_SHOP_QUERY = `#graphql
  query LlmsShop($country: CountryCode, $language: LanguageCode)
   @inContext(country: $country, language: $language) {
    shop {
      name
      description
      primaryDomain {
        url
      }
    }
  }
` as const;
