import {Link} from 'react-router';
import {ProductItem} from '~/components/ProductItem';
import {HorizontalCarousel} from '~/components/HorizontalCarousel';
import type {
  ProductItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';

type SliderProduct =
  | ProductItemFragment
  | RecommendedProductFragment;

export function ProductSlider({
  eyebrow,
  heading,
  products,
  viewAllTo,
  viewAllLabel = 'View All',
  showArrows = true,
  showHeading = true,
}: {
  eyebrow: string;
  heading: string;
  products: SliderProduct[];
  viewAllTo?: string;
  viewAllLabel?: string;
  showArrows?: boolean;
  showHeading?: boolean;
}) {
  if (!products.length) return null;

  return (
    <section className="slider-section">
      <div className="section-inner">
        {showHeading && (
          <div className="slider-section-header">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h2>{heading}</h2>
            </div>
            {viewAllTo && (
              <div className="slider-section-controls">
                <Link className="slider-viewall" to={viewAllTo}>
                  {viewAllLabel} &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
      <HorizontalCarousel
        className="slider-carousel"
        ariaLabel={heading}
        showButtons={showArrows}
      >
        {products.map((product, index) => (
          <ProductItem
            key={product.id}
            product={product}
            className="slider-item"
            loading={index < 4 ? 'eager' : undefined}
          />
        ))}
      </HorizontalCarousel>
    </section>
  );
}
