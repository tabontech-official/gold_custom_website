import {redirect, useLoaderData, useRouteLoaderData} from 'react-router';
import type {Route} from './+types/collections.$handle';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import {ProductSlider} from '~/components/ProductSlider';
import {CategorySlider} from '~/components/CategorySlider';
import {CollectionSubNav} from '~/components/CollectionSubNav';
import {CollectionPromo} from '~/components/CollectionPromo';
import {FeatureStrip} from '~/components/FeatureStrip';
import type {ProductItemFragment} from 'storefrontapi.generated';
import type {RootLoader} from '~/root';

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `Hydrogen | ${data?.collection.title ?? ''} Collection`}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {handle, ...paginationVariables},
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {
    collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Collection() {
  const {collection} = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData<RootLoader>('root');

  const relatedProducts = collection.products.nodes.slice(0, 8);
  const bestSelling = collection.bestSelling?.nodes ?? [];

  return (
    <div className="collection">
      <section className="collection-hero">
        <div className="section-inner collection-hero-inner">
          <span className="eyebrow">Shop {collection.title}</span>
          <h1>{collection.title}</h1>
          {collection.description && (
            <p className="collection-description">{collection.description}</p>
          )}
        </div>
      </section>

      {rootData?.header && (
        <div className="section-inner">
          <CollectionSubNav
            handle={collection.handle}
            header={rootData.header}
            publicStoreDomain={rootData.publicStoreDomain}
          />
        </div>
      )}

      <ProductSlider
        eyebrow="Discover"
        heading={`Related to ${collection.title}`}
        products={relatedProducts}
      />

      <CollectionPromo
        eyebrow="Our Promise"
        heading="Crafted in Solid Gold, Backed for Life"
        copy="Every piece is hallmarked, insured against wear, and covered by our lifetime warranty and upgrade program."
        ctaLabel="Book a Private Consultation"
        ctaTo="mailto:info@bayamjewelry.com"
      />

      <CategorySlider excludeHandle={collection.handle} />

      <FeatureStrip />

      {bestSelling.length > 0 && (
        <ProductSlider
          eyebrow="Customer Favorites"
          heading="Best Sellers"
          products={bestSelling}
          viewAllTo={`/collections/${collection.handle}`}
          viewAllLabel="Shop All"
        />
      )}

      <section className="home-section is-soft">
        <div className="section-inner">
          <div className="home-section-heading">
            <span className="eyebrow">Full Collection</span>
            <h2>Shop All {collection.title}</h2>
          </div>
          <PaginatedResourceSection<ProductItemFragment>
            connection={collection.products}
            resourcesClassName="products-grid"
          >
            {({node: product, index}) => (
              <ProductItem
                key={product.id}
                product={product}
                loading={index < 8 ? 'eager' : undefined}
              />
            )}
          </PaginatedResourceSection>
        </div>
      </section>

      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
      bestSelling: products(first: 8, sortKey: BEST_SELLING) {
        nodes {
          ...ProductItem
        }
      }
    }
  }
` as const;
