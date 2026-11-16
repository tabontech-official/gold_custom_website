import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/pages.black-friday';
import type {BlackFridayCollectionFragment} from 'storefrontapi.generated';
import {Breadcrumb} from '~/components/Breadcrumb';
import {ProductItem} from '~/components/ProductItem';
import {CacheCatalog} from '~/lib/cache';
import {PRODUCT_ITEM_FRAGMENT} from '~/lib/fragments';
import {groupProducts} from '~/lib/productGroups';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageSeo,
  rootDataFrom,
  siteOrigin,
} from '~/lib/seo';
import blackFridayStyles from '~/styles/black-friday.css?url';

/**
 * /pages/black-friday — the campaign landing page.
 *
 * A static route, so it wins over pages.$handle for this one handle; every
 * other /pages/* URL is untouched.
 *
 * Pricing rule for this page: nothing here states a discount. Product cards
 * show Shopify's own price, and a struck-through compare-at only where Shopify
 * holds a verified one (see lib/discount.ts). Campaign copy that names an
 * offer goes in APPROVED_OFFER, and only once the client has signed it off.
 */
const APPROVED_OFFER: string | null = null;

const PATH = '/pages/black-friday';

/**
 * Curated by the merchant in Shopify Admin. When it has products, the section
 * is titled "Today's Specials"; until then it falls back to best sellers under
 * a neutral title, so the page never implies a deal Shopify does not hold.
 */
const SPECIALS_HANDLE = 'todays-specials';

export const links: Route.LinksFunction = () => [
  {rel: 'stylesheet', href: blackFridayStyles},
];

export const meta: Route.MetaFunction = ({matches}) => {
  const origin = siteOrigin(rootDataFrom(matches));
  return pageSeo({
    title: 'Black Friday 2026',
    description:
      'Black Friday at Gold Custom: shop engagement rings, gold chains, earrings and bracelets at current prices.',
    url: absoluteUrl(origin, PATH),
    jsonLd: [
      breadcrumbJsonLd(origin, [
        {name: 'Home', path: '/'},
        {name: 'Black Friday', path: PATH},
      ]),
    ],
  });
};

export async function loader({context}: Route.LoaderArgs) {
  const data = await context.storefront.query(BLACK_FRIDAY_QUERY, {
    variables: {first: 16, specialsHandle: SPECIALS_HANDLE},
    cache: CacheCatalog(),
  });

  const specials = pick(data.todaysSpecials, 8);
  const sections: Section[] = [
    section('engagement-rings', 'Engagement Rings', data.engagementRings, 8, {
      eyebrow: 'Featured',
      topTag: 'Top showing rings',
    }),
    specials.products.length
      ? {...specials, id: 'todays-specials', title: "Today's Specials"}
      : section('todays-specials', 'Best Sellers', data.bestSellers, 8, {
          eyebrow: 'Most loved',
        }),
    section('chains', 'Chains', data.chains, 4, {eyebrow: 'Featured'}),
    section('earrings', 'Earrings', data.earrings, 4, {eyebrow: 'Featured'}),
    section('bracelets', 'Bracelets', data.bracelets, 4, {eyebrow: 'Featured'}),
  ].filter((s) => s.products.length > 0);

  return {sections, offer: APPROVED_OFFER};
}

type Collection = BlackFridayCollectionFragment | null | undefined;
type CardProduct = BlackFridayCollectionFragment['products']['nodes'][number];

type Section = {
  id: string;
  title: string;
  eyebrow?: string;
  handle: string;
  products: CardProduct[];
};

/** In-stock pieces first, one card per product group, `count` of them. */
function pick(collection: Collection, count: number, topTag?: string) {
  let nodes = collection?.products.nodes ?? [];
  nodes = nodes.filter(
    (p) => p.selectedOrFirstAvailableVariant?.availableForSale !== false,
  );
  if (topTag) {
    const isTop = (p: CardProduct) => p.tags.includes(topTag);
    nodes = [...nodes.filter(isTop), ...nodes.filter((p) => !isTop(p))];
  }
  return {
    handle: collection?.handle ?? '',
    products: groupProducts(nodes).slice(0, count),
  };
}

function section(
  id: string,
  title: string,
  collection: Collection,
  count: number,
  opts: {eyebrow?: string; topTag?: string} = {},
): Section {
  return {
    id,
    title,
    eyebrow: opts.eyebrow,
    ...pick(collection, count, opts.topTag),
  };
}

export default function BlackFridayPage() {
  const {sections, offer} = useLoaderData<typeof loader>();
  const ringsShown = sections.some((s) => s.id === 'engagement-rings');

  return (
    <div className="bf-page">
      <div className="section-inner bf-crumbs">
        <Breadcrumb
          items={[{label: 'Home', to: '/'}, {label: 'Black Friday'}]}
        />
      </div>

      <section className="bf-hero" aria-labelledby="bf-hero-title">
        <div className="bf-hero-copy">
          <p className="bf-eyebrow">Gold Custom · 2026</p>
          <h1 id="bf-hero-title" className="bf-hero-title">
            <span>Black</span> <span>Friday</span>
          </h1>
          <p className="bf-hero-lede">
            Engagement rings, chains, earrings and bracelets from the Gold
            Custom collection, in one place.
          </p>
          {offer && <p className="bf-hero-offer">{offer}</p>}
          <div className="bf-hero-actions">
            {ringsShown ? (
              <a className="bf-btn bf-btn--gold" href="#engagement-rings">
                Shop Engagement Rings
              </a>
            ) : (
              <Link
                className="bf-btn bf-btn--gold"
                to="/collections/engagement-rings"
                prefetch="intent"
              >
                Shop Engagement Rings
              </Link>
            )}
            <Link
              className="bf-btn bf-btn--ghost"
              to="/collections/all"
              prefetch="intent"
            >
              Shop All Jewelry
            </Link>
          </div>
        </div>
        <div className="bf-hero-media">
          <img
            src="/black%20friday%20sale%20cover.jpg"
            alt="Diamond stud earrings and a diamond ring on jewellery stands"
            width={736}
            height={736}
            {...{fetchpriority: 'high'}}
            decoding="async"
          />
        </div>
      </section>

      {sections.length > 1 && (
        <nav className="bf-jump" aria-label="Black Friday sections">
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {sections.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className={`bf-section bf-section--${s.products.length > 4 ? 'wide' : 'compact'}`}
          aria-labelledby={`${s.id}-title`}
        >
          <div className="section-inner">
            <header className="bf-section-head">
              <div>
                {s.eyebrow && <p className="bf-eyebrow">{s.eyebrow}</p>}
                <h2 id={`${s.id}-title`} className="bf-section-title">
                  {s.title}
                </h2>
              </div>
              <Link
                className="bf-viewall"
                to={`/collections/${s.handle}`}
                prefetch="intent"
              >
                Shop all <span aria-hidden="true">→</span>
              </Link>
            </header>
            <div className="bf-grid">
              {s.products.map((product) => (
                <ProductItem
                  key={product.id}
                  product={product}
                  collectionHandle={s.handle}
                  sizes="(min-width: 64em) 22vw, (min-width: 48em) 23vw, 62vw"
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="bf-closing">
        <div className="section-inner">
          <h2 className="bf-section-title">Looking for something specific?</h2>
          <p>Visit our Los Angeles showroom, or have a piece made to order.</p>
          <div className="bf-hero-actions bf-closing-actions">
            <Link
              className="bf-btn bf-btn--gold"
              to="/custom-jewelry"
              prefetch="intent"
            >
              Start a Custom Piece
            </Link>
            <Link
              className="bf-btn bf-btn--ghost"
              to="/showroom"
              prefetch="intent"
            >
              Visit the Showroom
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const BLACK_FRIDAY_QUERY = `#graphql
  fragment BlackFridayCollection on Collection {
    handle
    products(first: $first) {
      nodes {
        ...ProductItem
      }
    }
  }
  query BlackFridayLanding(
    $country: CountryCode
    $language: LanguageCode
    $first: Int!
    $specialsHandle: String!
  ) @inContext(country: $country, language: $language) {
    engagementRings: collection(handle: "engagement-rings") {
      ...BlackFridayCollection
    }
    todaysSpecials: collection(handle: $specialsHandle) {
      ...BlackFridayCollection
    }
    bestSellers: collection(handle: "best-sellers") {
      ...BlackFridayCollection
    }
    chains: collection(handle: "chains") {
      ...BlackFridayCollection
    }
    earrings: collection(handle: "earrings") {
      ...BlackFridayCollection
    }
    bracelets: collection(handle: "bracelets") {
      ...BlackFridayCollection
    }
  }
  ${PRODUCT_ITEM_FRAGMENT}
` as const;
