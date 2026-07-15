import {useLoaderData, Link} from 'react-router';
import type {Route} from './+types/wishlist';
import {getWishlist, toggleWishlist} from '~/lib/wishlist';
import {ProductItem} from '~/components/ProductItem';

// POST here (from the heart button) to toggle a handle. The signed session
// cookie is the store, so we commit it back on the response.
export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const handle = String(form.get('handle') ?? '');
  if (!handle) {
    return Response.json({wishlist: getWishlist(context.session), added: false});
  }
  const wasWished = getWishlist(context.session).includes(handle);
  const wishlist = toggleWishlist(context.session, handle);
  return Response.json(
    {wishlist, added: !wasWished},
    {headers: {'Set-Cookie': await context.session.commit()}},
  );
}

// GET /wishlist renders the saved products. Resolve by handle directly instead
// of using storefront search syntax, so saved handles cannot disappear because
// a search query parsed differently than expected.
export async function loader({context}: Route.LoaderArgs) {
  const handles = getWishlist(context.session);
  if (!handles.length) return {products: []};

  const products = await Promise.all(
    handles.map(async (handle) => {
      const data = await context.storefront.query(WISHLIST_PRODUCT_QUERY, {
        variables: {handle},
      });
      return data.product;
    }),
  );

  return {products: products.filter(Boolean)};
}

export default function WishlistPage() {
  const {products} = useLoaderData<typeof loader>();

  return (
    <section className="home-section wishlist-page">
      <div className="section-inner">
        <div className="editorial-heading">
          <h1 className="editorial-title">Your Wishlist</h1>
        </div>

        {products.length ? (
          <div className="products-grid">
            {products.map((product: any) => (
              <ProductItem key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="cart-empty">
            <p className="cart-empty-title">Your wishlist is empty</p>
            <p className="cart-empty-text">
              Tap the heart on any piece to save it here for later.
            </p>
            <Link className="btn btn-primary" to="/collections" prefetch="intent">
              Browse jewelry
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

const WISHLIST_PRODUCT_QUERY = `#graphql
  fragment WishlistProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query WishlistProduct(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...WishlistProduct
    }
  }
` as const;
