import {Link} from 'react-router';
import {Image, Money, useAnalytics} from '@shopify/hydrogen';
import {cdnLoader} from '~/lib/cdnImage';
import {analyticsProduct, type AnalyticsProductNode} from '~/lib/analytics';
import type {
  ProductItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {buildProductPath, productCanonicalPath} from '~/lib/categories';
import {useWishlistToggle} from '~/hooks/useWishlistToggle';
import {AddToCartButton, AddedToBagLabel} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <div className="product-image-wrap">
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

        {(['top-left', 'bottom-left', 'bottom-right'] as const).map((slot) => {
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

        {/* Heart sits top-right over the image, always visible. */}
        <div className="product-wishlist-control">
          <WishlistButton handle={product.handle} product={product} />
        </div>
      </div>

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
        <div className="product-card-price">
          <Money data={product.priceRange.minVariantPrice} />
        </div>
      </div>
      {showQuickAdd && <WishlistQuickAdd product={product} />}
    </article>
  );
}

type CardBadge = {
  label: string;
  tone:
    | 'sale'
    | 'best-seller'
    | 'diamond'
    | 'karat'
    | 'construction'
    | 'audience';
  /**
   * Which corner it prints in. One badge per corner, so three marks never
   * stack into a strip — and top-right is never used, because the wishlist
   * heart already lives there.
   */
  slot: 'top-left' | 'bottom-left' | 'bottom-right';
  /** Two marks may share top-left (karat + construction); the rest are solo. */
  pair?: boolean;
};

/** The one collection small enough to be a real distinction: 27 products. */
const BEST_SELLER_COLLECTION = 'best-sellers';

/**
 * Up to two badges per card: one status, one material.
 *
 * Everything here is read from the product, never from a hand-typed marketing
 * tag matched loosely. That matters more than usual on this catalogue: it
 * carries 2,962 distinct tags, and the most common one of all is "Fold Ring" —
 * a typo for "Gold Ring" sitting on 100% of products — alongside internal
 * markers like "Video Edit" and "Batch 1001" (see ~/lib/browseTags). Anything
 * threshold-based or fuzzy would publish the operations team's notes onto the
 * storefront the first time a new marker got popular.
 *
 * Coverage, measured across 1,500 live products:
 *   10K tag 68% · 14K tag 34% (428 carry both) · any diamond tag 58%
 *   best-sellers collection 27 products · sold out and markdowns are rare
 *
 * So most cards show a karat, many add Diamond, and the status badges stay
 * scarce enough to still mean something when they appear.
 *
 * NOT here, and why:
 *  - New Arrival: no product has been published in the last 90 days, and the
 *    new-arrivals collection holds 2,000 of them. There is nothing true to
 *    mark. Trim that collection (or publish new pieces) and it becomes real.
 *  - Trending: same problem, 2,000 products.
 *  - Men's / Women's: 41% and 36% of the catalogue, and on a gendered
 *    collection page it would be on every card at once — it takes the slot
 *    without adding anything. It is the lowest-priority entry below, so it
 *    only appears on a card that has nothing better to say.
 */
function cardBadges(product: any): CardBadge[] {
  const variant = product?.selectedOrFirstAvailableVariant;
  const tags: string[] = Array.isArray(product?.tags) ? product.tags : [];
  const hasTag = (re: RegExp) => tags.some((tag) => re.test(tag));
  const inCollection = (handle: string) =>
    (product?.collections?.nodes ?? []).some(
      (node: any) => node?.handle === handle,
    );

  // --- accolade (bottom-left): what the shop says about the piece -----------
  const accolade: CardBadge[] = inCollection(BEST_SELLER_COLLECTION)
    ? [{label: 'Best Seller', tone: 'best-seller', slot: 'bottom-left'}]
    : [];

  // --- status (bottom-right): what the shopper can act on ------------------
  //
  // Sold Out deliberately has no badge. The card still reports availability —
  // the product page and the add-to-cart button do — but stamping it on the
  // grid tile advertises what cannot be bought, on every pass through the
  // collection. Removing it also frees bottom-right for Diamond far more
  // often, which sells.
  const status = ((): CardBadge | null => {
    const price = Number(variant?.price?.amount);
    const was = Number(variant?.compareAtPrice?.amount);
    // Both must parse. A missing compareAtPrice is NaN and NaN > n is already
    // false, but saying so explicitly keeps a "Sale" off a card whose price
    // failed to parse rather than leaning on that.
    if (Number.isFinite(price) && Number.isFinite(was) && was > price) {
      return {label: 'Sale', tone: 'sale', slot: 'bottom-right'};
    }
    return null;
  })();

  // --- material: karat first, since it is the thing being sold --------------
  //
  // Karat comes from the TITLE, not the tags. Tagging is inconsistent — the
  // rings collection tags karat as "10K Gold Ring" or "10K gold jewelry" while
  // chains use a bare "10K", so an exact tag match left 20 of 24 ring cards
  // with nothing to say. Every title opens with it ("10K Yellow Gold Santa
  // Muerte Ring", "10K/14K Solid Gold 2.5mm Chain"), measured at 24/24 on the
  // rings grid, so the title is the reliable source. Tags stay as a fallback
  // for any title that breaks the pattern.
  const title: string = typeof product?.title === 'string' ? product.title : '';
  const karats = [
    ...new Set(
      [...title.matchAll(/\b(10|14|18|22|24)\s*K\b/gi)].map((m) => m[1]),
    ),
  ];
  if (!karats.length) {
    for (const k of ['10', '14', '18', '22', '24']) {
      if (hasTag(new RegExp(`^${k}k$`, 'i'))) karats.push(k);
    }
  }

  const material: CardBadge[] = [];
  if (karats.length) {
    // "10K/14K Solid Gold" pieces are offered in both, so say both rather than
    // picking one and misdescribing half the orders.
    material.push({
      label: karats.map((k) => `${k}K`).join(' / '),
      tone: 'karat',
      slot: 'top-left',
      // Pairs with construction: "10K · SEMI-SOLID" is one spec line.
      pair: true,
    });
  }
  // Construction, next to the karat — the two together are the spec a chain
  // buyer actually compares ("10K · SEMI-SOLID"). Semi-solid MUST be tested
  // before solid: "Semi-Solid" contains "Solid", so the looser pattern first
  // would relabel every semi-solid chain as solid — a real misdescription on a
  // piece whose price depends on it.
  //
  // Measured over 2,000 products: solid 36% of titles (26% also tagged),
  // semi-solid 0.8%, hollow 0%. Hollow is matched anyway because the catalogue
  // may gain it, and a construction badge that silently skipped the lightest
  // build would be the one worth having.
  const construction = /semi[-\s]?solid/i.test(title)
    ? 'Semi-Solid'
    : /\bhollow\b/i.test(title) || hasTag(/^hollow\b/i)
      ? 'Hollow'
      : /\bsolid\b/i.test(title) || hasTag(/^solid\b/i)
        ? 'Solid'
        : null;
  if (construction) {
    material.push({
      label: construction,
      tone: 'construction',
      slot: 'top-left',
      pair: true,
    });
  }

  if (/diamond/i.test(title) || hasTag(/diamond/i)) {
    material.push({
      label: 'Diamond',
      tone: 'diamond',
      // Top-left is the material corner, but karat and construction already
      // pair there. Diamond takes it only when neither is present; otherwise
      // it prints bottom-right, where it yields to Sale — a price the shopper
      // can act on outranks a description of the piece.
      slot: karats.length || construction ? 'bottom-right' : 'top-left',
    });
  }

  // One badge per corner, claimed in priority order: whoever asks first wins
  // the corner. Sale before Diamond on bottom-right, because a price the
  // shopper can act on outranks a description of the piece.
  //
  // Three marks spread across three corners frame the photograph; the same
  // three stacked in one corner would read as a discount rack, which is the
  // opposite of what a $1,200 piece should look like. Top-right is never
  // claimed — the wishlist heart lives there.
  const placed: CardBadge[] = [];
  const room = (badge: CardBadge) => {
    const here = placed.filter((b) => b.slot === badge.slot);
    if (!here.length) return true;
    // Karat and construction read as one spec line, so they may share the
    // material corner. Nothing else doubles up.
    return badge.pair && here.every((b) => b.pair) && here.length < 2;
  };
  const claim = (badge: CardBadge) => {
    if (room(badge)) placed.push(badge);
  };

  if (status) claim(status);
  accolade.forEach(claim);
  material.forEach(claim);

  // Last resort so a card is never bare — see the note above on why audience
  // is not worth a corner when anything else is available.
  if (placed.length === 0) {
    const slot = 'top-left' as const;
    if (hasTag(/^men('s)?[\s-]/i)) {
      claim({label: "Men's", tone: 'audience', slot});
    } else if (hasTag(/^women('s)?[\s-]/i)) {
      claim({label: "Women's", tone: 'audience', slot});
    }
  }

  return placed;
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

// Heart toggle. Posts to /wishlist and flips optimistically while the request
// is in flight so the shopper never waits on the server. Root revalidates on
// the POST, so the header count and every other card stay in sync.
function WishlistButton({
  handle,
  product,
}: {
  handle: string;
  product?: AnalyticsProductNode;
}) {
  const {fetcher, active} = useWishlistToggle(handle);
  const {publish} = useAnalytics();

  /**
   * Only the add half is reported. `active` is the pre-click state whenever the
   * fetcher is idle, so a click while it is false is an add — and GA4 has an
   * `add_to_wishlist` but no removal counterpart, so a de-select is simply not
   * an event either tool models.
   */
  const trackWishlistAdd = () => {
    if (active || !product) return;
    publish('custom_ga4', {
      event: 'add_to_wishlist',
      products: [analyticsProduct(product)],
      metaEvent: 'AddToWishlist',
    });
  };

  // `role="presentation"` strips the form landmark, not the button. A page
  // showing nine cards was publishing nine anonymous `form` regions into the
  // accessibility tree — an agent scanning landmarks got a wall of
  // indistinguishable "form" entries and no way to tell them apart. There is
  // nothing here to navigate to: the whole form is one toggle, and that button
  // keeps its own label and `aria-pressed`.
  return (
    <fetcher.Form
      method="post"
      action="/wishlist"
      role="presentation"
      onSubmit={trackWishlistAdd}
    >
      <input type="hidden" name="handle" value={handle} />
      <button
        type="submit"
        className={`product-wishlist ${active ? 'is-active' : ''}`}
        aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={active}
      >
        <HeartIcon />
      </button>
    </fetcher.Form>
  );
}
