import {useCallback, useEffect, useRef, useState} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';

export type VideoCarouselItem = {
  id: string;
  video: string;
  poster?: string | null;
  description?: string | null;
};

const PREVIEW_SECONDS = 4; // how long a card's video loops before pausing
// Embla's loop can't wrap seamlessly when fewer slides exist than fit in the
// viewport (6 per row on desktop) — repeat the source items so the track
// always has enough slides for the loop math to work and the row to fill.
const MIN_SLIDES = 12;

/**
 * TikTok-style video rail: small cards, several per row, infinite loop,
 * auto-scrolling. Each card silently loops its first 4 seconds as a preview;
 * clicking a card opens a full lightbox player with the whole video.
 */
export function VideoCarousel({items}: {items: VideoCarouselItem[]}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {loop: true, align: 'center', containScroll: false},
    [AutoScroll({speed: 0.6, stopOnInteraction: false, stopOnMouseEnter: true})],
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [centerSlide, setCenterSlide] = useState(0);

  const railRef = useRef<HTMLDivElement>(null);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Auto-scroll only while the rail is on screen. Embla's loop is a rAF that
  // never stops on its own, so this section sat near the bottom of the
  // homepage translating a twelve-slide track every frame from first paint —
  // stealing frames from whatever the visitor was actually scrolling past.
  useEffect(() => {
    const el = railRef.current;
    const autoScroll = emblaApi?.plugins()?.autoScroll;
    if (!el || !autoScroll) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) autoScroll.play();
      else autoScroll.stop();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [emblaApi]);

  // Track whichever slide is nearest the viewport center, so only that
  // card's video plays — matches Embla's own scroll progress, so it stays
  // correct through both auto-scroll and drag/arrow navigation.
  useEffect(() => {
    if (!emblaApi) return;
    const onScroll = () => {
      const progress = emblaApi.scrollProgress();
      const slideCount = emblaApi.slideNodes().length;
      const nearest = Math.round(progress * slideCount) % slideCount;
      setCenterSlide(((nearest % slideCount) + slideCount) % slideCount);
    };
    onScroll();
    emblaApi.on('scroll', onScroll);
    emblaApi.on('reInit', onScroll);
    return () => {
      emblaApi.off('scroll', onScroll);
      emblaApi.off('reInit', onScroll);
    };
  }, [emblaApi]);

  if (!items.length) return null;

  const repeatCount = Math.max(1, Math.ceil(MIN_SLIDES / items.length));
  const slides = Array.from({length: repeatCount}, () => items).flat();

  return (
    <section className="home-section video-rail-section">
      <div className="section-inner">
        <div className="editorial-heading video-rail-heading">
          <h2 className="editorial-title">
            Follow us on TikTok
            <span>@goldcustomla</span>
          </h2>
        </div>
        <div className="video-rail" ref={railRef}>
          <div className="video-rail-viewport" ref={emblaRef}>
            <div className="video-rail-container">
              {slides.map((item, index) => (
                <VideoCard
                  key={index}
                  item={item}
                  isActive={index === centerSlide}
                  onClick={() => setOpenIndex(index % items.length)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="video-rail-arrow video-rail-arrow-prev"
            aria-label="Previous videos"
            onClick={scrollPrev}
          >
            &#8249;
          </button>
          <button
            type="button"
            className="video-rail-arrow video-rail-arrow-next"
            aria-label="Next videos"
            onClick={scrollNext}
          >
            &#8250;
          </button>
        </div>
      </div>
      {openIndex !== null && (
        <VideoLightbox
          items={items}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onChangeIndex={setOpenIndex}
        />
      )}
    </section>
  );
}

function VideoCard({
  item,
  isActive,
  onClick,
}: {
  item: VideoCarouselItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only the centered card plays — loop its first PREVIEW_SECONDS as a
  // TikTok-style preview. Every other card stays paused.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !item.video) return;
    if (!isActive) {
      el.pause();
      return;
    }
    el.currentTime = 0;
    el.play().catch(() => {});
    const onTimeUpdate = () => {
      if (el.currentTime >= PREVIEW_SECONDS) el.currentTime = 0;
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [isActive, item.video]);

  return (
    <div
      className={`video-rail-slide${isActive ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <div className="video-rail-card">
        {item.video ? (
          <video
            ref={videoRef}
            className="video-rail-media"
            src={item.video}
            poster={item.poster ?? undefined}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          item.poster && (
            <img
              className="video-rail-media"
              src={item.poster}
              alt=""
              loading="lazy"
              draggable={false}
            />
          )
        )}
        <span className="video-rail-play" aria-hidden="true">
          &#9658;
        </span>
      </div>
    </div>
  );
}

// Simple full-video lightbox: dark backdrop, one video playing with controls,
// a close (×) button, and swipe/click-through prev-next like TikTok/Shorts.
function VideoLightbox({
  items,
  index,
  onClose,
  onChangeIndex,
}: {
  items: VideoCarouselItem[];
  index: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}) {
  const item = items[index];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowUp') onChangeIndex((index - 1 + items.length) % items.length);
      if (event.key === 'ArrowDown') onChangeIndex((index + 1) % items.length);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [index, items.length, onClose, onChangeIndex]);

  if (!item) return null;

  return (
    <div className="video-lightbox" onClick={onClose}>
      <button
        type="button"
        className="video-lightbox-close"
        aria-label="Close"
        onClick={onClose}
      >
        &times;
      </button>
      <div
        className="video-lightbox-stage"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="video-lightbox-player">
          {item.video ? (
            <video
              key={item.id}
              className="video-lightbox-media"
              src={item.video}
              poster={item.poster ?? undefined}
              autoPlay
              controls
              playsInline
              loop
            />
          ) : (
            item.poster && (
              <img className="video-lightbox-media" src={item.poster} alt="" />
            )
          )}
        </div>
        {item.description && (
          <p className="video-lightbox-caption">{item.description}</p>
        )}
      </div>
    </div>
  );
}
