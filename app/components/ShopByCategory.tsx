import {Link} from 'react-router';
import {HorizontalCarousel} from '~/components/HorizontalCarousel';
import {CATEGORIES} from '~/lib/categories';

/**
 * Public category images (served from /public). Keyed by collection handle.
 * Shared by the homepage carousel and every other page that reuses this
 * "Shop by Category" section so the visuals stay identical site-wide.
 */
const CATEGORY_IMAGES: Record<string, string> = {
  rings: '/gold%20ring.jpg',
  chains: '/chain.jpg',
  bracelets: '/bracelet.jpg',
  earrings: '/earring.jpg',
  pendants: '/pandents.jpg',
  necklaces: '/neckles.jpg',
  diamond: '/dimond.jpg',
  'engagement-rings': '/enganment.jpg',
};

export function ShopByCategory({
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
    <section className="home-section">
      <div className="section-inner">
        <div className="home-section-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{heading}</h2>
        </div>
        <HorizontalCarousel className="category-carousel" ariaLabel="categories">
          {categories.map((category) => {
            const src = CATEGORY_IMAGES[category.handle];
            return (
              <Link
                key={category.handle}
                to={`/collections/${category.handle}`}
                className="category-tile carousel-item"
              >
                {src ? (
                  <img
                    src={src}
                    alt={category.label}
                    className="category-tile-image"
                  />
                ) : (
                  <span className="category-tile-circle" aria-hidden="true">
                    {category.label.charAt(0)}
                  </span>
                )}
                <span>{category.label}</span>
              </Link>
            );
          })}
        </HorizontalCarousel>
      </div>
    </section>
  );
}
