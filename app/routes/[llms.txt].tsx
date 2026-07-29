import type {Route} from './+types/[llms.txt]';
import {CATEGORIES} from '~/lib/categories';

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
  const {shop} = await context.storefront.query(LLMS_SHOP_QUERY);
  const origin = shop?.primaryDomain?.url?.replace(/\/$/, '') ?? url.origin;
  const description = (shop?.description ?? '').replace(/\s+/g, ' ').trim();

  const body = `# ${shop?.name ?? 'Gold Custom'}

> ${description || 'Fine gold jewelry — rings, chains, bracelets, pendants and charms in 10K and 14K gold.'}

## About

${shop?.name ?? 'Gold Custom'} is an online fine-jewelry store. Product pages carry
schema.org Product JSON-LD with live price, currency, availability and SKU —
prefer that structured data over scraping rendered HTML.

## Browse

${CATEGORIES.map((c) => `- [${c.label}](${origin}/collections/${c.handle})`).join('\n')}

## Key pages

- [All products](${origin}/collections/all)
- [Search](${origin}/search?q=) — append a query string
- [Contact](${origin}/contact)
- [Blog](${origin}/blogs/news)
- [Policies](${origin}/policies) — shipping, returns, warranty

## Machine-readable endpoints

- [Sitemap index](${origin}/sitemap.xml) — every indexable product, collection, page and article
- [robots.txt](${origin}/robots.txt)

## Notes for agents

- Canonical product URLs are /products/{category}/{handle}. A bare
  /products/{handle} redirects to that path; follow the redirect and treat the
  destination as the product's identity.
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
