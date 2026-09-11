/**
 * Collection-page structured data check: every collection must publish a
 * CollectionPage and an ItemList that describes the products actually
 * rendered, wired to each other and to the sitewide #website node.
 *
 * Re-derives everything from the served HTML and shares no code with the app,
 * so a bug in the app cannot make this script agree with it — same rule as
 * seo-audit.mjs beside it.
 *
 * Usage:
 *   node scripts/verify-collection-schema.mjs                        # local
 *   node scripts/verify-collection-schema.mjs https://goldcustom.com # prod
 *
 * Local run needs a server up: `npm run dev`, or
 * `npm run build && npx shopify hydrogen preview --port 3112`.
 *
 * Sampled deliberately across collection SIZES (a 124-product category, a
 * 353, a 1,594), plus a deep page and a filtered one — the failure modes are
 * different at each: an ItemList that silently describes only the first batch,
 * or one that keeps describing the unfiltered set.
 *
 * Google's Rich Results Test is a hosted tool with no API, so it cannot run
 * here; this checks the same structure it reads. Paste a live URL into it for
 * the visual confirmation.
 *
 * Exit code is 1 if anything failed, so CI can gate on it.
 */

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const WHITE_GOLD = encodeURIComponent(
  JSON.stringify({variantOption: {name: 'metal', value: '10K White Gold'}}),
);

const PAGES = [
  ['/collections/bracelets', 'small collection'],
  ['/collections/chains', 'medium collection'],
  ['/collections/rings', 'large collection'],
  ['/collections/rings?show=60', 'deep page (60 shown)'],
  [`/collections/pendants?filter=${WHITE_GOLD}`, 'filtered collection'],
];

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Every JSON-LD node on the page, flattening any @graph wrappers. */
function jsonLdNodes(html) {
  return [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ].flatMap(([, raw]) => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [{'@type': 'UNPARSEABLE'}];
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.flatMap((node) => node['@graph'] ?? [node]);
  });
}

for (const [path, label] of PAGES) {
  console.log(`\n${label}  ${path}`);
  const html = await (await fetch(BASE + path)).text();
  // The grid's own cards, counted from the markup rather than from the data —
  // the point of the ItemList is that it matches what is on the page.
  const cards = (html.match(/class="product-item"/g) || []).length;
  const nodes = jsonLdNodes(html);

  check('JSON-LD parses', !nodes.some((n) => n['@type'] === 'UNPARSEABLE'));

  const page = nodes.find((n) => n['@type'] === 'CollectionPage');
  const list = nodes.find((n) => n['@type'] === 'ItemList');
  check('CollectionPage node', Boolean(page));
  check('ItemList node', Boolean(list));
  check(
    'BreadcrumbList node',
    Boolean(nodes.find((n) => n['@type'] === 'BreadcrumbList')),
  );
  if (!page || !list) continue;

  check('CollectionPage has a name', Boolean(page.name), page.name);
  check(
    'CollectionPage has an absolute url',
    /^https?:\/\//.test(page.url ?? ''),
  );
  check(
    'CollectionPage.isPartOf points at #website',
    Boolean(page.isPartOf?.['@id']?.endsWith('/#website')),
  );
  check(
    'CollectionPage.mainEntity resolves to the ItemList',
    page.mainEntity?.['@id'] === list['@id'],
    list['@id'],
  );

  const items = list.itemListElement ?? [];
  check(
    'ItemList describes every rendered card',
    items.length === cards,
    `${items.length} entries / ${cards} cards`,
  );
  check(
    'numberOfItems matches the entries',
    list.numberOfItems === items.length,
    String(list.numberOfItems),
  );
  check(
    'every entry is a ListItem',
    items.every((i) => i['@type'] === 'ListItem'),
  );
  check(
    'positions run 1..n in render order',
    items.every((i, index) => i.position === index + 1),
  );
  check(
    'every entry is named',
    items.every((i) => typeof i.name === 'string' && i.name.length > 0),
  );
  check(
    'every url is the canonical product url',
    items.every((i) =>
      /^https?:\/\/[^/]+\/collections\/[^/]+\/products\/[^/?#]+$/.test(
        i.url ?? '',
      ),
    ),
    items[0]?.url,
  );
  check(
    'no duplicate urls',
    new Set(items.map((i) => i.url)).size === items.length,
  );

  // The Product node inside each entry — what an assistant reads to answer
  // "gold Cuban chains under $500, in stock" without opening 30 pages.
  const products = items.map((i) => i.item).filter(Boolean);
  check('every entry carries a Product', products.length === items.length);
  check(
    'every Product is typed and named',
    products.every((pr) => pr['@type'] === 'Product' && pr.name),
  );
  check(
    'every Product @id matches the product page node',
    products.every((pr, index) => pr['@id'] === `${items[index].url}#product`),
  );
  check(
    'every Product has an image',
    products.every((pr) => /^https?:\/\//.test(pr.image ?? '')),
  );
  check(
    'every Product is branded',
    products.every((pr) => Boolean(pr.brand?.name)),
  );
  check(
    'every Offer has a 2dp price and a currency',
    products.every(
      (pr) =>
        /^\d+\.\d{2}$/.test(pr.offers?.price ?? '') &&
        /^[A-Z]{3}$/.test(pr.offers?.priceCurrency ?? ''),
    ),
    products[0]?.offers?.price,
  );
  check(
    'every Offer states availability',
    products.every((pr) =>
      /schema\.org\/(InStock|OutOfStock)$/.test(pr.offers?.availability ?? ''),
    ),
  );
  // Structured data that disagrees with the visible page is a manual action,
  // so the price in the markup has to be the price on the card.
  const shown = [
    ...html.matchAll(
      /class="product-price"[^>]*>(?:<[^>]+>)*\$([\d,]+(?:\.\d{2})?)/g,
    ),
  ].map((m) => Number(m[1].replace(/,/g, '')));
  check(
    'first prices in the markup match the Offers',
    shown.length === 0 ||
      shown
        .slice(0, 5)
        .every(
          (value, index) =>
            Math.abs(value - Number(products[index]?.offers?.price)) < 0.01,
        ),
    `${shown.slice(0, 3).join(',')} vs ${products
      .slice(0, 3)
      .map((pr) => pr.offers?.price)
      .join(',')}`,
  );

  // A 301 inside an ItemList is a wasted crawl of every entry, so sample the
  // ends and the middle rather than trusting the shape alone.
  const sample = [
    items[0],
    items[items.length >> 1],
    items[items.length - 1],
  ].filter(Boolean);
  const codes = [];
  for (const item of sample) {
    const res = await fetch(BASE + new URL(item.url).pathname, {
      redirect: 'manual',
    });
    codes.push(res.status);
  }
  check(
    'sampled item urls answer 200, no redirect',
    codes.every((c) => c === 200),
    codes.join(','),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
