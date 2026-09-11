import {Suspense} from 'react';
import {Await, Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {cdnLoader} from '~/lib/cdnImage';

export type BundleItem = {
  id: string;
  title: string;
  to?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  price?: MoneyV2 | null;
  variantId?: string | null;
  /** Line item properties for this line (ring size, photo). */
  attributes?: Array<{key: string; value: string}>;
};

/**
 * "Frequently Bought Together" — the matching pair, bought in one click.
 *
 * Sits under the gallery in a .pdp-card — heading included — on the same
 * grey surface, and to the same edges, as the trust badges above it. The
 * heading itself is the page's plain h2, the one "You May Also Like" uses, so
 * the two suggestion sections read as one idea rather than two designs.
 *
 * It shows the two PIECES: photo + photo, the total, one button. No product
 * titles, no checkboxes — the titles are three lines of small grey text for
 * something the shopper is looking straight at, and every word of it competes
 * with the buy panel beside it. What the pair looks like and what it costs is
 * the entire offer.
 *
 * The partner arrives deferred (see pairing.ts + the product loader), so the
 * block simply isn't there until it resolves: `fallback={null}`, because the
 * partner may well be nothing at all — a piece with no real match is offered
 * none, and reserving space for a suggestion that never comes would push the
 * trust badges down on every product that has one.
 */
export function FrequentlyBoughtTogether({
  current,
  partner,
}: {
  current: BundleItem;
  partner: Promise<BundleItem | null>;
}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={partner} errorElement={null}>
        {(resolved) =>
          resolved ? <Bundle items={[current, resolved]} /> : null
        }
      </Await>
    </Suspense>
  );
}

function Bundle({items}: {items: BundleItem[]}) {
  const {open} = useAside();
  const lines = items.filter((item) => item.variantId);
  // Both halves or nothing: with no checkboxes there is no way to say "just
  // one", and one of the two is what the buy panel above already sells.
  if (lines.length < 2) return null;

  const currencyCode = items.find((i) => i.price)?.price?.currencyCode ?? 'USD';
  const total = items.reduce(
    (sum, item) => sum + Number(item.price?.amount ?? 0),
    0,
  );

  return (
    <section className="fbt pdp-card">
      <h2 className="fbt-title">Frequently Bought Together</h2>
      <div className="fbt-body">
        <div className="fbt-thumbs">
          {items.map((item, index) => (
            <div className="fbt-thumb-cell" key={item.id}>
              {index > 0 && (
                <span className="fbt-plus" aria-hidden="true">
                  +
                </span>
              )}
              <Thumb item={item} />
            </div>
          ))}
        </div>

        <div className="fbt-buy">
          <p className="fbt-total">
            <span>Total price</span>
            <strong>
              <Money data={{amount: total.toFixed(2), currencyCode}} />
            </strong>
          </p>
          <AddToCartButton
            className="btn fbt-add"
            onClick={() => open('cart')}
            lines={lines.map((item) => ({
              merchandiseId: item.variantId as string,
              quantity: 1,
              ...(item.attributes?.length && {attributes: item.attributes}),
            }))}
          >
            Add both to bag
          </AddToCartButton>
        </div>
      </div>
    </section>
  );
}

/**
 * The image is the only description of the piece here, so it keeps the title
 * as its alt text and its link — a shopper who wants to know what the second
 * one is taps it.
 */
function Thumb({item}: {item: BundleItem}) {
  const image = item.imageUrl ? (
    <Image
      loader={cdnLoader}
      src={item.imageUrl}
      alt={item.imageAlt || item.title}
      aspectRatio="1/1"
      sizes="130px"
      loading="lazy"
    />
  ) : null;
  return item.to ? (
    <Link
      className="fbt-thumb"
      to={item.to}
      prefetch="intent"
      title={item.title}
    >
      {image}
    </Link>
  ) : (
    <div className="fbt-thumb">{image}</div>
  );
}
