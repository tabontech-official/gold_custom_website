import type {Route} from './+types/[robots.txt]';
import {parseGid} from '@shopify/hydrogen';
import {CacheStatic} from '~/lib/cache';

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);

  // The shop id only adds two checkout `Disallow` lines, but fetching it used
  // to be able to take the whole file down with it: an unhandled query failure
  // threw, `/robots.txt` 500'd, and Google reads a 5xx robots.txt as "disallow
  // the entire site" for up to 12 hours (~30 days if it keeps failing). One
  // API blip on a cold cache therefore de-indexed every product page and broke
  // every Merchant Center landing-page check at once.
  //
  // So: never throw. A robots.txt missing two checkout rules is a rounding
  // error; a robots.txt that does not respond is a site-wide outage.
  let shopId: string | undefined;
  try {
    const {shop} = await context.storefront.query(ROBOTS_QUERY, {
      cache: CacheStatic(),
    });
    shopId = shop?.id ? parseGid(shop.id).id : undefined;
  } catch (error) {
    console.error('robots.txt: shop id lookup failed, serving without it', error);
  }

  const body = robotsTxtData({url: url.origin, shopId});

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      // Full file caches for a day. The degraded one caches for five minutes
      // so the checkout rules come back on the next request that succeeds,
      // instead of being pinned out of the file for 24 hours.
      'Cache-Control': `max-age=${shopId ? 60 * 60 * 24 : 60 * 5}`,
    },
  });
}

function robotsTxtData({url, shopId}: {shopId?: string; url?: string}) {
  const sitemapUrl = url ? `${url}/sitemap.xml` : undefined;

  return `
User-agent: *
${generalDisallowRules({sitemapUrl, shopId})}

User-agent: Googlebot
${generalDisallowRules({sitemapUrl, shopId})}

User-agent: Googlebot-Image
${generalDisallowRules({sitemapUrl, shopId})}

User-agent: adsbot-google
Disallow: /checkouts/
Disallow: /checkout
Disallow: /carts
Disallow: /orders
${shopId ? `Disallow: /${shopId}/checkouts` : ''}
${shopId ? `Disallow: /${shopId}/orders` : ''}
Disallow: /*?*oseid=*
Disallow: /*preview_theme_id*
Disallow: /*preview_script_id*

User-agent: Nutch
Disallow: /

User-agent: AhrefsBot
Crawl-delay: 10
${generalDisallowRules({sitemapUrl, shopId})}

User-agent: AhrefsSiteAudit
Crawl-delay: 10
${generalDisallowRules({sitemapUrl, shopId})}

User-agent: MJ12bot
Crawl-Delay: 10

User-agent: Pinterest
Crawl-delay: 1

${aiCrawlerRules({shopId})}
`.trim();
}

function aiCrawlerRules({shopId}: {shopId?: string}) {
  const answerBots = [
    'OAI-SearchBot',
    'ChatGPT-User',
    'PerplexityBot',
    'Perplexity-User',
    'Claude-User',
    'Claude-SearchBot',
    'Amazonbot',
    'YouBot',         // You.com AI Search
    'Diffbot'         // Often used to parse e-commerce product data for graphs
  ];
  const trainingBots = [
    'GPTBot',
    'ClaudeBot',
    'anthropic-ai',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
    'Meta-ExternalAgent',
    'cohere-ai',      // Cohere training models
    'Bytespider'      // ByteDance / TikTok AI
  ];

  const group = (agent: string) =>
    `User-agent: ${agent}\n${generalDisallowRules({shopId})}`;

  return [
    '# ---- AI answer engines & shopping agents (allowed) ----',
    ...answerBots.map(group),
    '# ---- AI training crawlers (allowed) ----',
    ...trainingBots.map(group),
  ].join('\n\n');
}

function generalDisallowRules({
  shopId,
  sitemapUrl,
}: {
  shopId?: string;
  sitemapUrl?: string;
}) {
  return `Allow: /products/
Allow: /collections/
Allow: /pages/
Allow: /policies/
Disallow: /admin
Disallow: /cart
Disallow: /orders
Disallow: /checkouts/
Disallow: /checkout
${shopId ? `Disallow: /${shopId}/checkouts` : ''}
${shopId ? `Disallow: /${shopId}/orders` : ''}
Disallow: /carts
Disallow: /account
Disallow: /collections/*sort_by*
Disallow: /*/collections/*sort_by*
Disallow: /collections/*+*
Disallow: /collections/*%2B*
Disallow: /collections/*%2b*
Disallow: /*/collections/*+*
Disallow: /*/collections/*%2B*
Disallow: /*/collections/*%2b*
Disallow: */collections/*filter*&*filter*
Disallow: /blogs/*+*
Disallow: /blogs/*%2B*
Disallow: /blogs/*%2b*
Disallow: /*/blogs/*+*
Disallow: /*/blogs/*%2B*
Disallow: /*/blogs/*%2b*
Disallow: /*?*oseid=*
Disallow: /*preview_theme_id*
Disallow: /*preview_script_id*
Disallow: /*/*?*ls=*&ls=*
Disallow: /*/*?*ls%3D*%3Fls%3D*
Disallow: /*/*?*ls%3d*%3fls%3d*
Disallow: /search
Allow: /search/
Disallow: /search/?*
Disallow: /apple-app-site-association
Disallow: /.well-known/shopify/monorail
${sitemapUrl ? `Sitemap: ${sitemapUrl}` : ''}`;
}

const ROBOTS_QUERY = `#graphql
  query StoreRobots($country: CountryCode, $language: LanguageCode)
   @inContext(country: $country, language: $language) {
    shop {
      id
    }
  }
` as const;