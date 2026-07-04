import {useRef} from 'react';
import {Link} from 'react-router';
import {ProductItem} from '~/components/ProductItem';
import type {
  CollectionItemFragment,
  ProductItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';

type SliderProduct =
  | CollectionItemFragment
  | ProductItemFragment
  | RecommendedProductFragment;

export function ProductSlider({
  eyebrow,
  heading,
  products,
  viewAllTo,
  viewAllLabel = 'View All',
}: {
  eyebrow: string;
  heading: string;
  products: SliderProduct[];
  viewAllTo?: string;
  viewAllLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!products.length) return null;

  function scrollByAmount(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.min(track.clientWidth * 0.85, 640),
      behavior: 'smooth',
    });
  }

  return (
    <section className="slider-section">
      <div className="section-inner">
        <div className="slider-section-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{heading}</h2>
          </div>
          <div className="slider-section-controls">
            {viewAllTo && (
              <Link className="slider-viewall" to={viewAllTo}>
                {viewAllLabel} &rarr;
              </Link>
            )}
            <div className="slider-arrows">
              <button
                aria-label="Scroll left"
                className="slider-arrow reset"
                onClick={() => scrollByAmount(-1)}
                type="button"
              >
                &larr;
              </button>
              <button
                aria-label="Scroll right"
                className="slider-arrow reset"
                onClick={() => scrollByAmount(1)}
                type="button"
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="slider-track" ref={trackRef}>
        {products.map((product, index) => (
          <ProductItem
            key={product.id}
            product={product}
            className="slider-item"
            loading={index < 4 ? 'eager' : undefined}
          />
        ))}
      </div>
    </section>
  );
}
