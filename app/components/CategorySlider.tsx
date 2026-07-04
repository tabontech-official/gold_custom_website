import {Link} from 'react-router';
import {CATEGORIES} from '~/lib/categories';

export function CategorySlider({
  eyebrow = 'Explore',
  heading = 'Shop by Category',
  excludeHandle,
}: {
  eyebrow?: string;
  heading?: string;
  excludeHandle?: string;
}) {
  const categories = CATEGORIES.filter(
    (category) => category.handle !== excludeHandle,
  );

  return (
    <section className="slider-section">
      <div className="section-inner">
        <div className="slider-section-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{heading}</h2>
          </div>
        </div>
      </div>
      <div className="slider-track category-slider-track">
        {categories.map((category) => (
          <Link
            key={category.handle}
            to={`/collections/${category.handle}`}
            className="category-tile slider-item category-slider-item"
          >
            <span className="category-tile-circle" aria-hidden="true">
              {category.label.charAt(0)}
            </span>
            <span>{category.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
