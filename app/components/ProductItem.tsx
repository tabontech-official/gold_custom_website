import {Link} from 'react-router';
import {Image, Money, useAnalytics} from '@shopify/hydrogen';
import {cdnLoader} from '~/lib/cdnImage';
import {analyticsProduct} from '~/lib/analytics';
import type {
  ProductItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {buildProductPath, productCanonicalPath} from '~/lib/categories';
import {formatUsd, savingsFor} from '~/lib/discount';
import {promotionPricing} from '~/lib/promotionPricing';
import {AddToCartButton, AddedToBagLabel} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';

export function ProductItem({
  product,
  loading,
  className,
  collectionHandle,
  showQuickAdd = false,
  sizes = '(min-width: 45em) 400px, calc(100vw - 3rem)',
}: {
  product: ProductItemFragment | RecommendedProductFragment | any;
  loading?: 'eager' | 'lazy';
  className?: string;
  /**
   * How wide this card actually renders. The default describes the grid
   * (`--grid-item-width`, minus `body > main`'s 1.5rem side margins).
   *
   * Rails and sliders MUST override it: their cards top out at 240–340px, so
   * the grid's `100vw` had them pulling an ~800px image into a 240px box —
   * roughly ten times the pixels needed, times every card on screen.
   */
  sizes?: string;
  /**
   * The collection this card is being shown in, if any. Set, the card links
   * into that collection so the shopper stays where they are browsing; unset
   * (sliders, search, wishlist) the flat path redirects to the canonical URL.
   */
  collectionHandle?: string;
  /** Wishlist cards can add their first available variant without leaving the page. */
  showQuickAdd?: boolean;
}) {
  // Without a collection to stay inside, link straight at the canonical URL
  // instead of the flat path — otherwise every card outside a collection grid
  // costs the shopper a redirect on click. `productCanonicalPath` returns that
  // flat path anyway when the card's query didn't ask for category, so a
  // fragment missing those fields degrades to the old behaviour rather than
  // producing a broken link.
  const productUrl = collectionHandle
    ? buildProductPath(collectionHandle, product.handle)
    : productCanonicalPath(product);
  const image = product.featuredImage;
  const badges = cardBadges(product);
  const pricing = promotionPricing(product);
  const savings = savingsFor(
    pricing?.price.amount,
    pricing?.compareAtPrice?.amount,
  );

  const {publish} = useAnalytics();

  /**
   * GA4 pairs `select_item` with the `view_item_list` the collection route
   * sends, which is what turns a grid into a list-performance report: which
   * collection a shopper clicked from, and in what position. The list name has
   * to match on both sides, so both use the collection handle — a card outside
   * any collection (search, wishlist, a rail) reports the surface it sits on
   * instead of pretending to belong to one.
   */
  const listId = collectionHandle ?? 'other';
  const trackSelect = () =>
    publish('custom_ga4', {
      event: 'select_item',
      params: {item_list_id: listId, item_list_name: listId},
      products: [analyticsProduct(product)],
    });

  return (
    <article
      className={className ? `product-item ${className}` : 'product-item'}
    >
      <div className={`product-image-wrap${savings ? ' has-sale-ribbon' : ''}`}>
        <Link
          prefetch="intent"
          to={productUrl}
          className="product-image-link"
          onClick={trackSelect}
        >
          {image && (
            <Image
              loader={cdnLoader}
              alt={image.altText || product.title}
              aspectRatio="1/1"
              data={image}
              className="product-image"
              loading={loading ?? 'lazy'}
              sizes={sizes}
            />
          )}
        </Link>

        {(['bottom-left', 'bottom-right'] as const).map((slot) => {
          const inSlot = badges.filter((badge) => badge.slot === slot);
          if (!inSlot.length) return null;
          return (
            /* One positioned box per corner, laying its badges out in a row.
               Absolutely positioning each badge instead would need the second
               one offset by the FIRST one's width, which nothing in CSS can
               measure — it would overlap or gap depending on the karat text. */
            <div className={`product-card-badges at-${slot}`} key={slot}>
              {inSlot.map((badge) => (
                <span
                  className={`product-card-badge is-${badge.tone}`}
                  key={badge.label}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {savings && (
        <>
          <span
            className="product-off-badge"
            aria-label={`${savings.percent}% off`}
          >
            <strong>{savings.percent}%</strong>
            <span>OFF</span>
          </span>
          <div className="product-sale-ribbon">
            <span>
              <strong>Black Friday</strong>
              <span>Deal</span>
            </span>
          </div>
        </>
      )}

      <div className="product-card-body">
        {/* h3, not h4. Every grid and rail that renders these cards sits under
            an h2 section heading, so h4 skipped a level and broke the document
            outline — an agent walking the tree sees a gap where a section
            should be. The two places that had a bare h1 above the grid
            (collections, wishlist) now carry a visually-hidden h2, which also
            gives those regions a name worth navigating to. */}
        <Link
          prefetch="intent"
          to={productUrl}
          className="product-item-copy"
          onClick={trackSelect}
        >
          <h3>{product.title}</h3>
        </Link>
        {savings ? (
          <div className="product-card-price is-sale">
            <s className="product-card-was">
              <Money data={pricing!.compareAtPrice!} />
            </s>
            <Money data={pricing!.price} />
          </div>
        ) : (
          <div className="product-card-price">
            <Money
              data={pricing?.price ?? product.priceRange.minVariantPrice}
            />
          </div>
        )}
        {savings ? (
          <div className="product-card-savings">
            You save {formatUsd(savings.amount)}
          </div>
        ) : (
          <div
            className="product-card-savings is-placeholder"
            aria-hidden="true"
          >
            Price saving
          </div>
        )}
      </div>
      {showQuickAdd && <WishlistQuickAdd product={product} />}
    </article>
  );
}
type CardBadge = {
  label: string;
  tone: 'sale' | 'best-seller' | 'new-arrival';
  /** Bottom-right is Sale; bottom-left is the accolade. */
  slot: 'bottom-left' | 'bottom-right';
};

/** The one collection small enough to be a real distinction: 27 products. */
const BEST_SELLER_COLLECTION = 'best-sellers';

/** How long a piece stays marked New Arrival after `publishedAt`. */
const NEW_ARRIVAL_DAYS = 7;

/**
 * Three badges, at most two per card: Sale, Best Seller, New Arrival.
 *
 * ponytail: material/spec badges (karat, construction, Diamond, audience) were
 * removed — they were derived from titles and tags and got them wrong. Add back
 * only from structured product data, never string matching.
 */
function cardBadges(product: any): CardBadge[] {
  const badges: CardBadge[] = [];

  // Best Seller first: rarer than New Arrival, so it wins the shared corner.
  const inBestSellers = (product?.collections?.nodes ?? []).some(
    (node: any) => node?.handle === BEST_SELLER_COLLECTION,
  );
  if (inBestSellers) {
    badges.push({
      label: 'Best Seller',
      tone: 'best-seller',
      slot: 'bottom-left',
    });
    return badges;
  }

  const publishedAt = product?.publishedAt
    ? new Date(product.publishedAt)
    : null;
  if (publishedAt && !Number.isNaN(publishedAt.getTime())) {
    const days = (Date.now() - publishedAt.getTime()) / 86_400_000;
    if (days <= NEW_ARRIVAL_DAYS) {
      badges.push({
        label: 'New Arrival',
        tone: 'new-arrival',
        slot: 'bottom-left',
      });
    }
  }

  return badges;
}

function WishlistQuickAdd({product}: {product: any}) {
  const {open} = useAside();
  const variant = product.selectedOrFirstAvailableVariant;

  if (!variant) return null;

  return (
    <AddToCartButton
      className="wishlist-quick-add"
      disabled={!variant.availableForSale}
      lines={[
        {
          merchandiseId: variant.id,
          quantity: 1,
          selectedVariant: variant,
        },
      ]}
      onClick={() => open('cart')}
      addedChildren={<AddedToBagLabel />}
    >
      {variant.availableForSale ? 'Add to bag →' : 'Sold out'}
    </AddToCartButton>
  );
}
