import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {enableDragScroll} from '~/lib/dragScroll';
import type {ReviewCarouselData} from '~/lib/reviews';

const AUTOSLIDE_MS = 5000;

/**
 * Customer reviews on the product page, laid out like Judge.me's "Cards"
 * review carousel as configured in its widget editor: header with average
 * stars and "from N reviews", rating / title / body / reviewer name on each
 * card (no date, no product), three cards on desktop, arrows below, autoslide
 * every 5s. Which reviews: see carouselReviews.
 *
 * Rendered here from Judge.me's widget API (loadReviewCarousel in the product
 * route) rather than by Judge.me's own carousel script, which needs
 * 'unsafe-eval' in the CSP and Judge.me's platform-independent widgets.
 *
 * Native overflow scrolling, same viewport rules and drag helper as
 * HorizontalCarousel — that component's arrows overlay the sides and it has
 * no autoslide, and changing it would change every product rail.
 */
export function ReviewsCarousel({rating, count, reviews}: ReviewCarouselData) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [paused, setPaused] = useState(false);
  const [photo, setPhoto] = useState<{src: string; alt: string} | null>(null);

  // Native <dialog>: Escape, focus trapping and the backdrop come with it.
  // It lives inside .reviews-carousel, so focus in it holds the autoslide.
  const openPhoto = (src: string, alt: string) => {
    setPhoto({src, alt});
    dialogRef.current?.showModal();
  };

  // One card per step, wrapping past either end, so the autoslide loops and
  // neither arrow ever dead-ends.
  const step = useCallback((direction: 1 | -1) => {
    const viewport = viewportRef.current;
    const card = viewport?.querySelector('li');
    if (!viewport || !card?.parentElement) return;
    const gap = parseFloat(getComputedStyle(card.parentElement).columnGap) || 0;
    const end = viewport.scrollWidth - viewport.clientWidth;
    const next = viewport.scrollLeft + direction * (card.offsetWidth + gap);
    viewport.scrollTo({left: next > end + 4 ? 0 : next < -4 ? end : next});
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () =>
      setOverflows(viewport.scrollWidth > viewport.clientWidth + 4);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    const disableDrag = enableDragScroll(viewport);
    return () => {
      observer.disconnect();
      disableDrag();
    };
  }, []);

  // Held while the shopper is reading (pointer over it, or keyboard focus in
  // it), and never for anyone who asked the OS for reduced motion.
  useEffect(() => {
    if (!overflows || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => step(1), AUTOSLIDE_MS);
    return () => window.clearInterval(timer);
  }, [overflows, paused, step]);

  return (
    <section
      className="reviews-carousel-section"
      aria-labelledby="reviews-carousel-title"
    >
      <div className="section-inner">
        <header className="reviews-carousel-head">
          <h2 className="pdp-faq-title" id="reviews-carousel-title">
            <span>Let customers speak for us</span>
          </h2>
          <p className="reviews-carousel-meta">
            <Stars value={rating} />
            from {count} {count === 1 ? 'review' : 'reviews'}
          </p>
        </header>

        <div
          className="reviews-carousel"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPaused(false);
            }
          }}
        >
          <div
            className="hcarousel-viewport reviews-carousel-viewport"
            ref={viewportRef}
          >
            <ul className="reviews-carousel-track">
              {reviews.map((review) => (
                <li className="review-card" key={review.uuid}>
                  <Stars value={review.rating} />
                  {review.title && (
                    <h3 className="review-card-title">{review.title}</h3>
                  )}
                  <p className="review-card-body">{review.body}</p>
                  {review.pictures_urls?.length ? (
                    <div className="review-card-photos">
                      {review.pictures_urls.map((picture) => (
                        <button
                          key={picture.small}
                          type="button"
                          className="review-card-photo"
                          aria-label={`View ${review.reviewer_name}'s upload larger`}
                          onClick={() =>
                            openPhoto(
                              picture.huge,
                              `Shared by ${review.reviewer_name}`,
                            )
                          }
                        >
                          <img
                            src={picture.small}
                            alt=""
                            width={72}
                            height={72}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="review-card-name">{review.reviewer_name}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Click on the backdrop lands on the <dialog> itself (the image
              fills the box), so that target closes it; Escape is native. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <dialog
            ref={dialogRef}
            className="review-photo-dialog"
            aria-label={photo?.alt ?? 'Customer upload'}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                event.currentTarget.close();
              }
            }}
            onClose={() => setPhoto(null)}
          >
            {photo && <img src={photo.src} alt={photo.alt} />}
            <button
              type="button"
              className="review-photo-close"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </dialog>

          {overflows && (
            <div className="reviews-carousel-arrows">
              <button
                type="button"
                className="reviews-carousel-arrow"
                aria-label="Previous reviews"
                onClick={() => step(-1)}
              >
                <Chevron flip />
              </button>
              <button
                type="button"
                className="reviews-carousel-arrow"
                aria-label="Next reviews"
                onClick={() => step(1)}
              >
                <Chevron />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Five stars filled to `value` out of 5 — see .review-stars. */
function Stars({value}: {value: number}) {
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={`Rated ${Number(value.toFixed(1))} out of 5`}
      style={{'--rating': value} as CSSProperties}
    />
  );
}

function Chevron({flip = false}: {flip?: boolean}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={flip ? {transform: 'scaleX(-1)'} : undefined}
    >
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
