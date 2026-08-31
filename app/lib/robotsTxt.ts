/**
 * The robots.txt body. Lives in a lib, not in the route, so the self-check in
 * robotsRules.test.ts can import the real generated text under plain `node`
 * instead of guessing at it by parsing the route's source.
 */
export function robotsTxtData({url, shopId}: {shopId?: string; url?: string}) {
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

/**
 * NOTE ON THE REMOVED `+` RULES
 *
 * Shopify's default robots.txt disallows `/collections/*+*` (and the %2B/%2b
 * encodings, and the /blogs/ equivalents) to keep crawlers out of Liquid's
 * tag-filter URLs — `/collections/rings/gold+diamond`. This storefront has no
 * such URL shape: collection filtering is `?filter.*` query params, handled in
 * collections.$handle.tsx.
 *
 * Carrying those rules over was actively harmful. robots.txt matching is
 * longest-rule-wins and matches the query string too, so `Disallow:
 * /collections/*+*` (20 chars) beat `Allow: /collections/` (13) on every
 * product URL carrying a variant param with a space in its value:
 *
 *   /collections/classic-link-bracelets/products/...?Metal=10K+Yellow+Gold
 *
 * `+` is a space, not a tag separator. That is most of the catalog — anything
 * with a "10K Yellow Gold" style option — and Google reported it as
 * "Blocked by robots.txt", which surfaced in Merchant Center as
 * "Unable to check product pages" across ~1,900 products.
 *
 * Faceted-URL bloat is still covered: the sort_by and double-filter rules
 * above target the shapes this storefront can actually emit.
 */
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
Disallow: */collections/*filter*&*filter*
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
