// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/cart
export const CART_QUERY_FRAGMENT = `#graphql
  fragment Money on MoneyV2 {
    currencyCode
    amount
  }
  fragment CartLine on CartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height

        }
        product {
          handle
          title
          id
          vendor
        }
        selectedOptions {
          name
          value
        }
      }
    }
    parentRelationship {
      parent {
        id
      }
    }
  }
  fragment CartLineComponent on ComponentizableCartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height
        }
        product {
          handle
          title
          id
          vendor
        }
        selectedOptions {
          name
          value
        }
      }
    }
    lineComponents {
      ...CartLine
    }
  }
  fragment CartApiQuery on Cart {
    updatedAt
    id
    appliedGiftCards {
      id
      lastCharacters
      amountUsed {
        ...Money
      }
    }
    checkoutUrl
    totalQuantity
    buyerIdentity {
      countryCode
      customer {
        id
        email
        firstName
        lastName
        displayName
      }
      email
      phone
    }
    lines(first: $numCartLines) {
      nodes {
        ...CartLine
      }
      nodes {
        ...CartLineComponent
      }
    }
    cost {
      subtotalAmount {
        ...Money
      }
      totalAmount {
        ...Money
      }
      totalDutyAmount {
        ...Money
      }
      totalTaxAmount {
        ...Money
      }
    }
    note
    attributes {
      key
      value
    }
    discountCodes {
      code
      applicable
    }
  }
` as const;

const MENU_FRAGMENT = `#graphql
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
    resource {
      __typename
      ... on Collection {
        # handle and title come from the COLLECTION, not the menu link.
        #
        # A Shopify menu item carries its own hand-typed title, and renaming a
        # collection does not touch it — which is how "Clover Necklaces" ended
        # up still reading "Women Necklaces" in one menu. handle is also the
        # only reliable dedupe key: the same collection is linked from more
        # than one of the menus that feed the Chains department, and matching
        # on the typed title cannot see that they are the same thing.
        handle
        title
        products(first: 1) {
          nodes {
            id
          }
        }
      }
    }
  }
  fragment ChildMenuItem on MenuItem {
    ...MenuItem
  }
  fragment ParentMenuItem on MenuItem {
    ...MenuItem
    items {
      ...ChildMenuItem
    }
  }
  fragment Menu on Menu {
    id
    items {
      ...ParentMenuItem
    }
  }
` as const;

export const HEADER_QUERY = `#graphql
  fragment Shop on Shop {
    id
    name
    description
    primaryDomain {
      url
    }
    brand {
      logo {
        image {
          url
        }
      }
    }
  }
  query Header(
    $country: CountryCode
    $headerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    shop {
      ...Shop
    }
    menu(handle: $headerMenuHandle) {
      ...Menu
    }
    chainsGroup1: menu(handle: "chains-copy-copy-1") {
      ...Menu
    }
    chainsGroup2: menu(handle: "chains-copy-copy") {
      ...Menu
    }
    chainsGroup3: menu(handle: "chains-copy") {
      ...Menu
    }
    braceletsMenu: menu(handle: "bracelets-1") {
      ...Menu
    }
    earringsMenu: menu(handle: "earrings") {
      ...Menu
    }
    pendantsMenu: menu(handle: "pendants") {
      ...Menu
    }
    chainWithPendantMenu: menu(handle: "chain-with-pendant") {
      ...Menu
    }
    diamondMenu: menu(handle: "diamond") {
      ...Menu
    }
    engagementRingsMenu: menu(handle: "engagement-rings") {
      ...Menu
    }
    ringsMenu: menu(handle: "rings") {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;

export const FOOTER_QUERY = `#graphql
  query Footer(
    $country: CountryCode
    $footerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    menu(handle: $footerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;

/**
 * Everything a product card (ProductItem) renders. Shared by the collection
 * grid and the guides' "Shop the collection" rail, so a card shows and links
 * the same wherever it appears.
 */
export const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    # New Arrival badge — see cardBadges() in ProductItem.tsx.
    publishedAt
    # Products sharing a group name render as one card — see groupProducts.
    groupName: metafield(namespace: "custom", key: "group_name") {
      value
    }
    # Only used to resolve each product's canonical
    # /collections/<category>/products/<handle> path for the ItemList JSON-LD.
    # Without them productCanonicalPath falls back to the flat
    # /products/<handle>, which 301s — and a structured-data list of redirects
    # is worth less than no list at all.
    productType
    category {
      name
    }
    featuredImage {
      id
      altText
      url
      width
      height
    }
    # Card badges. Tags drive Karat/Diamond and best-sellers
    # membership drives Best Seller. See cardBadges() in
    # ProductItem.tsx for why only those, and only from here.
    tags
    collections(first: 15) {
      nodes {
        handle
      }
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
      # The one real identifier in the ItemList's Product nodes — what an
      # agent or a feed matches this piece by when the title is ambiguous.
      # See collectionItemListJsonLd.
      sku
      # Card badges: a Sale badge must come from a real
      # compare-at price, never from a tag someone typed.
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
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
