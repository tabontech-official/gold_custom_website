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
      });

      const products = result?.products?.nodes ?? [];
      return new Response(JSON.stringify({products}), {
        headers: { 'Content-Type': 'application/json' },
      });
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
    });

    const products = result?.collection?.products?.nodes ?? [];

    return new Response(JSON.stringify({products}), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({error: err.message || String(err)}), {status: 500});
  }
}

export const unstable_shouldReload = () => false;
