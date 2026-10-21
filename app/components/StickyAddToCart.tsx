import {useEffect, useState, type RefObject} from 'react';
import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

/**
 * Phone-only buy bar along the bottom of the product page. It slides up once
 * the real Add to bag has scrolled away above the screen, and goes again when
 * that button or the footer comes back into view.
 *
 * It owns no cart logic. Its button clicks the real Add to bag in the buy box,
 * so the ring size line attribute, the pendant photo, the optimistic cart, the
 * drawer opening and the add_to_cart event all stay in the one place that
 * already does them. When the real button cannot add (sold out, already in
 * the bag, a Picture Pendant still without its photo), it takes the shopper
 * to the control that needs them instead.
 *
 * Rendered on the server too, hidden: `visible` starts false on both sides so
 * hydration matches, and the hidden bar's `visibility: hidden` (app.css) keeps
 * it out of the tab order and the accessibility tree.
 */
export function StickyAddToCart({
  buyBox,
  title,
  price,
  availableForSale,
}: {
  /** The purchase card, which holds the real Add to bag. */
  buyBox: RefObject<HTMLElement>;
  title: string;
  price?: MoneyV2;
  availableForSale: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const row = buyBox.current?.querySelector('.product-buy-row');
    if (!row) return;

    let rowAbove = false;
    let footerInView = false;
    let footer: Element | null = null;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === row) {
          // Out of view AND above it: scrolled past, not merely not reached
          // yet — on a phone the buy row starts below the fold.
          rowAbove = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        } else {
          footerInView = entry.isIntersecting;
        }
      }
      // The footer streams in behind a Suspense boundary, so it can still be
      // missing when this effect runs. Picked up by the first callback that
      // finds it; observing it fires a callback of its own with its state.
      if (!footer) {
        footer = document.querySelector('footer.footer');
        if (footer) observer.observe(footer);
      }
      setVisible(rowAbove && !footerInView);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [buyBox]);

  const onClick = () => {
    const box = buyBox.current;
    if (!box) return;
    // The real Add to bag is the one inside the cart <form>. The Picture
    // Pendant's "Add your photo" button borrows .product-atc for its look but
    // sits in no form, and it is exactly the control to send the shopper to.
    const main = box.querySelector<HTMLButtonElement>('form .product-atc');
    if (main && !main.disabled) {
      main.click();
      return;
    }
    // Disabled (sold out, already in the bag): another option is the fix, so
    // the first selector. No Add to bag at all: the buy row's first button,
    // which is the photo upload. A single-variant sold-out piece has neither,
    // and lands on its own disabled "Sold out" button.
    const target =
      (main && box.querySelector<HTMLElement>('.variant-select-trigger')) ||
      box.querySelector<HTMLElement>('.product-buy-row button');
    if (!target) return;
    target.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
    target.focus({preventScroll: true});
  };

  return (
    <div className={`sticky-atc${visible ? ' is-visible' : ''}`}>
      <div className="sticky-atc-info">
        <p className="sticky-atc-title">{title}</p>
        {price && <Money as="span" className="sticky-atc-price" data={price} />}
      </div>
      {/* Never disabled, unlike the button it stands in for: a dead button at
          the bottom of the screen explains nothing, while this one scrolls to
          whatever is blocking the add. Same label as the main button. */}
      <button
        className="btn product-atc sticky-atc-btn"
        onClick={onClick}
        type="button"
      >
        {availableForSale ? 'Add to bag' : 'Sold out'}
      </button>
    </div>
  );
}
