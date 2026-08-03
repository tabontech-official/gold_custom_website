/**
 * Independent SEO audit. Fetches real pages and re-derives every check from
 * the served HTML — it shares no code with the app, so a bug in the app
 * cannot make this script agree with it.
 *
 * Usage:
 *   node scripts/seo-audit.mjs                       # local preview
 *   node scripts/seo-audit.mjs https://goldcustom.com # production
 *
 * Local run needs the built server up:  npm run build && npx shopify hydrogen preview --port 3112
 *
 * Exit code is 1 if anything failed, so CI can gate on it.
 */

const BASE = (process.argv[2] ?? 'http://localhost:3112').replace(/\/$/, '');

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [32mPASS[0m  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  [31mFAIL[0m  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {'User-Agent': 'seo-audit'},
    redirect: 'follow',
  });
  return {status: res.status, url: res.url, body: await res.text()};
}

/** Every JSON-LD node on the page, flattened out of its script tags. */
function jsonLdNodes(html) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => m[1]);

  return blocks.flatMap((raw) => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [{__invalid: raw.slice(0, 80)}];
    }
  });
}

const canonicalOf = (html) =>
  html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1] ?? null;

const section = (name) => console.log(`\n${name}`);

// ---------------------------------------------------------------------------

section('robots.txt');
{
  const {status, body} = await get('/robots.txt');
  check('serves 200', status === 200, `got ${status}`);
  check(
    'policy pages are crawlable (AI engines cite returns/shipping)',
    !/^Disallow: \/policies\/$/m.test(body),
  );
  check('declares a Sitemap', /^Sitemap:\s*https?:\/\//m.test(body));
  check('checkout stays blocked', /^Disallow: \/checkout$/m.test(body));
  for (const bot of ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'OAI-SearchBot']) {
    check(`names ${bot}`, new RegExp(`User-agent: ${bot}`, 'i').test(body));
  }
}

section('sitemap.xml');
{
  const {status, body} = await get('/sitemap.xml');
  check('serves 200', status === 200, `got ${status}`);
  check('is a sitemap index', /<sitemapindex/.test(body));
}

section('llms.txt');
{
  const {status, body} = await get('/llms.txt');
  check('serves 200', status === 200, `got ${status}`);
  check('lists best sellers', /## Best sellers/.test(body));
  const productLinks = [...body.matchAll(/\((https?:\/\/[^)]*\/products\/[^)]+)\)/g)].map(
    (m) => m[1],
  );
  check('inlines products', productLinks.length >= 10, `${productLinks.length} found`);
  check('inlines prices', /— from \$\d/.test(body));
  check(
    'product links use hierarchical canonical paths (not flat /products/<handle>)',
    productLinks.length > 0 &&
      productLinks.every((u) => u.split('/products/')[1]?.includes('/')),
  );
}

section('homepage');
{
  const {body} = await get('/');
  const h1s = body.match(/<h1[\s>]/g) ?? [];
  check('has exactly one <h1>', h1s.length === 1, `found ${h1s.length}`);
  const types = jsonLdNodes(body).map((n) => n['@type']);
  check('emits Organization', types.includes('Organization'));
  check('emits WebSite', types.includes('WebSite'));
}

section('product page');
{
  // Discover a real product from the sitemap-independent path: the llms.txt list.
  const llms = (await get('/llms.txt')).body;
  const first = llms.match(/\((https?:\/\/[^)]*\/products\/[^)]+)\)/)?.[1];
  const path = first ? new URL(first).pathname : null;
  if (!path) {
    check('found a product to audit', false, 'no product links in llms.txt');
  } else {
    const {body, status} = await get(path);
    check(`product page 200 (${path})`, status === 200, `got ${status}`);

    const nodes = jsonLdNodes(body);
    check('all JSON-LD parses', !nodes.some((n) => n.__invalid));

    const product = nodes.find((n) => n['@type'] === 'Product');
    const org = nodes.find((n) => String(n['@id'] ?? '').endsWith('#organization'));
    const canonical = canonicalOf(body);

    check('has Product JSON-LD', Boolean(product));
    check('has Organization on page', Boolean(org));
    check('has BreadcrumbList', nodes.some((n) => n['@type'] === 'BreadcrumbList'));

    if (product) {
      check(
        'Product url === canonical tag',
        product.url === canonical,
        `jsonld=${product.url} canonical=${canonical}`,
      );
      check('Product has @id', typeof product['@id'] === 'string');
      check('Product has sku', Boolean(product.sku));

      const offer = product.offers;
      check('has Offer', Boolean(offer));
      if (offer) {
        check('Offer url === canonical', offer.url === canonical);
        check('Offer has priceValidUntil', /^\d{4}-\d{2}-\d{2}$/.test(offer.priceValidUntil ?? ''));
        check(
          'priceValidUntil is in the future',
          new Date(offer.priceValidUntil) > new Date(),
        );
        check('Offer has availability', String(offer.availability ?? '').startsWith('https://schema.org/'));
        check('Offer.seller references the Organization', offer.seller?.['@id'] === org?.['@id']);

        const rp = offer.hasMerchantReturnPolicy;
        check('has hasMerchantReturnPolicy', Boolean(rp));
        check('return window is 14 days', rp?.merchantReturnDays === 14);
        check(
          'does NOT claim a full cash refund (policy gives exchange/credit)',
          !JSON.stringify(rp ?? {}).includes('FullRefund'),
        );

        // Free shipping is only truthful at/above $99.
        const price = Number(offer.price);
        const hasShipping = Boolean(offer.shippingDetails);
        check(
          `shipping claim matches $99 threshold (price $${price})`,
          price >= 99 ? hasShipping : !hasShipping,
          hasShipping ? 'claims free shipping' : 'omits shipping',
        );
      }
    }

    check('LCP image carries fetchpriority', /fetchpriority="high"/i.test(body));
  }
}

section('collection page');
{
  const {body, status} = await get('/collections/earrings');
  check('collection 200', status === 200, `got ${status}`);
  const nodes = jsonLdNodes(body);
  const list = nodes.find((n) => n['@type'] === 'ItemList');
  check('has ItemList', Boolean(list));
  if (list) {
    check('ItemList is non-empty', (list.itemListElement ?? []).length > 0);
    check(
      'numberOfItems matches actual entries',
      list.numberOfItems === list.itemListElement?.length,
    );
    check(
      'every entry has absolute url + name + position',
      list.itemListElement.every(
        (i) => /^https?:\/\//.test(i.url ?? '') && i.name && i.position,
      ),
    );
    check(
      'entries use hierarchical canonical paths',
      list.itemListElement.every((i) => i.url.split('/products/')[1]?.includes('/')),
    );
    // The earrings regression: these must NOT be filed under /products/rings/.
    check(
      'earrings are not mis-filed under /products/rings/',
      list.itemListElement.every((i) => !i.url.includes('/products/rings/')),
    );
  }
}

section('blog article');
{
  const index = (await get('/blogs')).body;
  const slug = index.match(/href="\/blogs\/([^"/]+)"/)?.[1];
  if (!slug) {
    check('found an article to audit', false, 'no article links on /blogs');
  } else {
    const {body, status} = await get(`/blogs/${slug}`);
    check(`article 200 (/blogs/${slug})`, status === 200, `got ${status}`);
    const nodes = jsonLdNodes(body);
    const post = nodes.find((n) => n['@type'] === 'BlogPosting');
    const org = nodes.find((n) => String(n['@id'] ?? '').endsWith('#organization'));
    check('has BlogPosting', Boolean(post));
    check('BlogPosting has datePublished', Boolean(post?.datePublished));
    check('BlogPosting has author', Boolean(post?.author?.name));
    check('publisher resolves to Organization', post?.publisher?.['@id'] === org?.['@id']);
  }
}

section('financing page');
{
  const {status, body} = await get('/policies/finance');
  check('/policies/finance serves 200 (was 404)', status === 200, `got ${status}`);
  for (const host of [
    'apply.acima.com',
    'approve.me',
    'synchrony.com/mmc',
    'americanfirstfinance.com',
  ]) {
    check(`links ${host}`, body.includes(host));
  }
  check(
    'lender links are rel=nofollow',
    (body.match(/rel="noopener noreferrer nofollow"/g) ?? []).length >= 4,
  );
}

// ---------------------------------------------------------------------------

console.log(`\n${'-'.repeat(60)}`);
console.log(`${passed} passed, ${failed} failed   (${BASE})`);
if (failed) {
  console.log('\nFailed:');
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(failed ? 1 : 0);
