import {CacheCatalog} from '~/lib/cache';
export async function loader({request, context}: any) {
  try {
    const url = new URL(request.url);
    const handle = url.searchParams.get('handle');
    const tag = url.searchParams.get('tag');

    if (!handle) {
      return new Response(JSON.stringify({error: 'missing handle'}), {status: 400});
    }

    const tagRaw = tag && tag !== 'All Products' ? String(tag).replace(/"/g, '\\"') : null;

    // If a tag is provided, use top-level products(query:) to combine collection+tag.
    if (tagRaw) {
      const q = `collection:${handle} tag:\"${tagRaw}\" available_for_sale:true`;
      const queryWithTag = `#graphql
        fragment ProductNode on Product {
          id
          title
          handle
          tags
          selectedOrFirstAvailableVariant {
            id
            availableForSale
          }
          variants(first: 1) {
            nodes {
              id
              availableForSale
            }
          }
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
        }

        query CollectionProducts($q: String, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
          products(first: 48, query: $q) {
            nodes {
              ...ProductNode
            }
          }
        }
      `;

      const result = await context.storefront.query(queryWithTag, {
        variables: {q},
        cache: CacheCatalog(),
      });

      const products = result?.products?.nodes ?? [];
      return new Response(JSON.stringify({products}), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // The header mega menu asks for ONE collection ("Display Products"), which
    // the merchant curates and orders by hand, and then shows the pieces in it
    // that belong to whichever department is hovered. That per-department split
    // needs each product's collection memberships, which the two queries below
    // deliberately do not carry: this endpoint also feeds the collection-page
    // icon strip, and adding 50 collection handles to all 48 products there
    // would be pure payload for a consumer that only wants one image.
    if (url.searchParams.get('withCollections') === '1') {
      const menuQuery = `#graphql
        query MenuDisplayProducts($handle: String!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
          collection(handle: $handle) {
            products(first: 100) {
              nodes {
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
                collections(first: 50) {
                  nodes {
                    handle
                  }
                }
              }
            }
          }
        }
      `;

      const menuResult = await context.storefront.query(menuQuery, {
        variables: {handle},
        cache: CacheCatalog(),
      });

      return new Response(
        JSON.stringify({products: menuResult?.collection?.products?.nodes ?? []}),
        {headers: {'Content-Type': 'application/json'}},
      );
    }

    // No tag — fetch the collection directly to avoid cross-collection matches
    const collectionQuery = `#graphql
      fragment ProductNode on Product {
        id
        title
        handle
        tags
        selectedOrFirstAvailableVariant {
          id
          availableForSale
        }
        variants(first: 1) {
          nodes {
            id
            availableForSale
          }
        }
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
      }

      query CollectionByHandle($handle: String!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
        collection(handle: $handle) {
          image {
            url
            altText
          }
          products(first: 48, filters: {available: true}) {
            nodes {
              ...ProductNode
            }
          }
        }
      }
    `;

    const result = await context.storefront.query(collectionQuery, {
      variables: {handle},
      cache: CacheCatalog(),
    });

    const products = result?.collection?.products?.nodes ?? [];
    const image = result?.collection?.image ?? null;

    return new Response(JSON.stringify({products, image}), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({error: err.message || String(err)}), {status: 500});
  }
}

export const unstable_shouldReload = () => false;
