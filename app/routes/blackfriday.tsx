import {Link, useLoaderData} from 'react-router';
import {Image} from '@shopify/hydrogen';
import type {Route} from './+types/blackfriday';
import type {BlackFridayCollectionFragment} from 'storefrontapi.generated';
import {Breadcrumb} from '~/components/Breadcrumb';
import {ProductItem} from '~/components/ProductItem';
import {CacheCatalog} from '~/lib/cache';
import {buildProductPath} from '~/lib/categories';
import {cdnLoader} from '~/lib/cdnImage';
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
 * /blackfriday — the campaign landing page.
 *
 * Pricing rule for this page: nothing here states a discount. Product cards
 * show Shopify's own price, and a struck-through compare-at only where Shopify
 * holds a verified one (see lib/discount.ts). Campaign copy that names an
 * offer goes in APPROVED_OFFER, and only once the client has signed it off.
 *
 * Imagery is the store's own: the hero and category tiles are each
 * collection's Shopify image, the cards are each product's featured image.
 */
const APPROVED_OFFER: string | null = null;

const PATH = '/blackfriday';

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
      eyebrow: 'The Featured Edit',
      topTag: 'Top showing rings',
    }),
    specials.products.length
      ? {
          ...specials,
          id: 'todays-specials',
          title: "Today's Specials",
          eyebrow: 'Selected Today',
        }
      : section('todays-specials', 'Best Sellers', data.bestSellers, 8, {
          eyebrow: 'Most Loved',
        }),
    section('chains', 'Chains', data.chains, 4, {eyebrow: 'Gold Chains'}),
    section('earrings', 'Earrings', data.earrings, 4, {
      eyebrow: 'Gold & Diamond',
    }),
    section('bracelets', 'Bracelets', data.bracelets, 4, {
      eyebrow: 'Gold Bracelets',
    }),
  ].filter((s) => s.products.length > 0);

  return {
    sections,
    offer: APPROVED_OFFER,
    hero: data.engagementRings?.image ?? null,
  };
}

type Collection = BlackFridayCollectionFragment | null | undefined;
type CardProduct = BlackFridayCollectionFragment['products']['nodes'][number];
type CollectionImage = NonNullable<BlackFridayCollectionFragment['image']>;

type Section = {
  id: string;
  title: string;
  eyebrow?: string;
  handle: string;
  image: CollectionImage | null;
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
    image: collection?.image ?? null,
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

/** The four category sections that carry a collection photograph. */
const TILE_IDS = ['engagement-rings', 'chains', 'earrings', 'bracelets'];

export default function BlackFridayPage() {
  const {sections, offer, hero} = useLoaderData<typeof loader>();
  const ringsShown = sections.some((s) => s.id === 'engagement-rings');
  const tiles = sections.filter((s) => TILE_IDS.includes(s.id) && s.image);

  return (
    <div className="bf-page">
      <div className="section-inner bf-crumbs">
        <Breadcrumb
          items={[{label: 'Home', to: '/'}, {label: 'Black Friday'}]}
        />
      </div>

      <section
        className={`bf-hero${hero ? '' : ' bf-hero--text'}`}
        aria-labelledby="bf-hero-title"
      >
        {hero && (
          <div className="bf-hero-media">
            <Image
              loader={cdnLoader}
              data={hero}
              alt={
                hero.altText ||
                'Diamond engagement rings from the Gold Custom collection'
              }
              sizes="(min-width: 48em) 65vw, 100vw"
              loading="eager"
              {...{fetchpriority: 'high'}}
            />
          </div>
        )}
        <div className="bf-hero-copy">
          <p className="bf-kicker">
            <span aria-hidden="true" className="bf-kicker-line" />
            Gold Custom · 2026
            <span aria-hidden="true" className="bf-kicker-line" />
          </p>
          <h1 id="bf-hero-title" className="bf-hero-title">
            <span className="bf-hero-title-gold">Black</span>
            <span>Friday</span>
          </h1>
          <p className="bf-hero-tagline">The Black Friday Edit</p>
          <p className="bf-hero-lede">
            Engagement rings, gold chains, earrings and bracelets from the Gold
            Custom collection, gathered on one page.
          </p>
          {offer && <p className="bf-hero-offer">{offer}</p>}
          <div className="bf-actions">
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
      </section>

      {tiles.length > 1 && (
        <nav className="bf-tiles" aria-label="Shop by category">
          <ul className="section-inner">
            {tiles.map((s) => (
              <li key={s.id}>
                <a className="bf-tile" href={`#${s.id}`}>
                  <Image
                    loader={cdnLoader}
                    data={s.image!}
                    alt=""
                    aspectRatio="5/4"
                    sizes="(min-width: 64em) 22vw, 45vw"
                    loading="lazy"
                  />
                  <span className="bf-tile-label">
                    <span className="bf-tile-title">{s.title}</span>
                    <span className="bf-tile-cta">
                      Shop <span aria-hidden="true">→</span>
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {sections.map((s, index) => (
        <section
          key={s.id}
          id={s.id}
          className="bf-section"
          aria-labelledby={`${s.id}-title`}
        >
          <div className="section-inner">
            <header className="bf-section-head">
              <p className="bf-eyebrow">
                <span className="bf-eyebrow-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {s.eyebrow}
              </p>
              <h2 id={`${s.id}-title`} className="bf-section-title">
                {s.title}
              </h2>
              <span aria-hidden="true" className="bf-divider" />
            </header>
            <div className="bf-grid">
              {s.products.map((product) => (
                <div className="bf-card" key={product.id}>
                  <ProductItem
                    product={product}
                    collectionHandle={s.handle}
                    sizes="(min-width: 64em) 22vw, (min-width: 40em) 36vw, 66vw"
                  />
                  <Link
                    className="bf-card-cta"
                    to={buildProductPath(s.handle, product.handle)}
                    prefetch="intent"
                    aria-label={`Shop ${product.title}`}
                  >
                    Shop Now
                  </Link>
                </div>
              ))}
            </div>
            <div className="bf-section-foot">
              <Link
                className="bf-btn bf-btn--ghost"
                to={`/collections/${s.handle}`}
                prefetch="intent"
              >
                Shop All {s.title} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      ))}

      <section className="bf-closing" aria-labelledby="bf-closing-title">
        <div className="section-inner">
          <div className="bf-closing-panel">
            <p className="bf-eyebrow">Gold Custom · Los Angeles</p>
            <h2 id="bf-closing-title" className="bf-section-title">
              Looking for something specific?
            </h2>
            <p className="bf-closing-text">
              Visit our Los Angeles showroom, or have a piece made to order.
            </p>
            <div className="bf-actions">
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
        </div>
      </section>
    </div>
  );
}

const BLACK_FRIDAY_QUERY = `#graphql
  fragment BlackFridayCollection on Collection {
    handle
    # The collection's own photograph: hero (engagement rings) and the
    # category tiles.
    image {
      id
      url
      altText
      width
      height
    }
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
