import {Link} from 'react-router';

/** Pass imageSrc when the campaign photograph is ready. */
export function BlackFridayFeature({
  imageSrc,
  desktopImageSrc,
  imageAlt = '',
}: {
  imageSrc?: string;
  desktopImageSrc?: string;
  imageAlt?: string;
}) {
  return (
    <section
      className="black-friday-feature"
      aria-labelledby="black-friday-feature-title"
    >
      <div className="black-friday-feature-copy">
        <p className="black-friday-feature-brand">Gold Custom</p>
        <h2
          id="black-friday-feature-title"
          className="black-friday-feature-title"
        >
          <span>Black</span>
          <span>Friday</span>
        </h2>
        <p className="black-friday-feature-subtitle">
          Fine Jewellery Offers <span>2026</span>
        </p>
        <p className="black-friday-feature-description">
          Up to 50% off selected jewellery.*
        </p>
        <div className="black-friday-feature-actions">
          <Link to="/collections/engagement-rings" prefetch="intent">
            Shop Engagement Rings
          </Link>
          <Link to="/collections/diamond-stud-earrings" prefetch="intent">
            Shop Diamond Earrings
          </Link>
        </div>
      </div>
      <div
        className="black-friday-feature-media"
        aria-hidden={!imageSrc || undefined}
      >
        {imageSrc && (
          <picture>
            {desktopImageSrc && (
              <source
                media="(min-width: 48.001em)"
                srcSet={desktopImageSrc}
                width={1000}
                height={700}
              />
            )}
            <img
              src={imageSrc}
              alt={imageAlt}
              width={736}
              height={736}
              loading="lazy"
              decoding="async"
            />
          </picture>
        )}
      </div>
    </section>
  );
}
