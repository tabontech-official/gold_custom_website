import {useEffect, useMemo, useRef, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import {cdnWidth, cdnLoader} from '~/lib/cdnImage';
import type Hls from 'hls.js';

export type GalleryMedia = {
  key: string;
  kind: 'image' | 'video' | 'external';
  /** Thumbnail / poster url (available for every media type). */
  thumbUrl?: string | null;
  alt?: string | null;
  /** image */
  image?: {
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  /** video */
  sources?: Array<{url: string; mimeType?: string | null}>;
  /** external video */
  embedUrl?: string | null;
};

/**
 * Product media as a bounded editorial grid. The layout adapts to the media
 * count: 1 = one large square, 2 = two vertical rectangles, 3 = one tall
 * feature plus two stacked squares, 4+ = uniform squares in two columns.
 * When the shopper switches variant, that variant's image moves to the
 * feature (first) position.
 */
export function ProductGallery({
  media,
  selectedImageUrl,
  title = 'Product',
}: {
  media: GalleryMedia[];
  selectedImageUrl?: string | null;
  title?: string;
}) {
  // The selected variant's image leads the grid.
  const items = useMemo<GalleryMedia[]>(() => {
    const list = [...(media ?? [])];
    if (!selectedImageUrl) return list;
    const index = list.findIndex(
      (m) => m.kind === 'image' && m.image?.url === selectedImageUrl,
    );
    if (index > 0) {
      list.unshift(list.splice(index, 1)[0]);
    } else if (index === -1) {
      list.unshift({
        key: selectedImageUrl,
        kind: 'image',
        thumbUrl: selectedImageUrl,
        image: {url: selectedImageUrl, altText: title},
      });
    }
    return list;
  }, [media, selectedImageUrl, title]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    setActiveKey(null);
  }, [selectedImageUrl]);

  if (!items.length) {
    return <div className="product-gallery-empty" aria-hidden="true" />;
  }

  const activeItem = items.find((item) => item.key === activeKey) ?? items[0];
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === activeItem.key),
  );
  // Wraps at both ends: with the thumbnail rail hidden on mobile these arrows
  // are the only way through the set, and a dead-ended arrow reads as broken.
  const step = (delta: number) =>
    setActiveKey(
      items[(activeIndex + delta + items.length) % items.length].key,
    );

  // Read through a ref so the swipe listeners below can stay bound across
  // index changes instead of being torn down and rebuilt after every gesture.
  const stepRef = useRef(step);
  stepRef.current = step;

  const stageRef = useRef<HTMLDivElement>(null);
  // Live finger offset, so the photo moves under the thumb instead of sitting
  // still until the gesture happens to cross the commit threshold.
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Touch swipe, same gesture model as the homepage hero: lock the axis first
  // and only call preventDefault once the drag reads horizontal, so a vertical
  // flick still scrolls the page instead of being swallowed by the gallery.
  // Not shared with the hero's hook — that one is built around its cloned,
  // auto-advancing track, and this only needs to pick the next key.
  const canSwipe = items.length > 1;
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !canSwipe) return;

    let start: {x: number; y: number} | null = null;
    let axis: 'h' | 'v' | null = null;
    let dx = 0;

    const onStart = (event: TouchEvent) => {
      // A press that begins on an arrow is a tap, not a swipe.
      if (
        event.target instanceof Element &&
        event.target.closest('button') !== null
      ) {
        return;
      }
      start = {x: event.touches[0].clientX, y: event.touches[0].clientY};
      axis = null;
      dx = 0;
    };

    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const moveX = event.touches[0].clientX - start.x;
      const moveY = event.touches[0].clientY - start.y;
      if (!axis && Math.abs(moveX) + Math.abs(moveY) > 8) {
        axis = Math.abs(moveX) > Math.abs(moveY) ? 'h' : 'v';
      }
      if (axis === 'h') {
        event.preventDefault();
        dx = moveX;
        setDragging(true);
        setDrag(dx);
      }
    };

    const onEnd = () => {
      // A twelfth of the stage is enough to commit — the same ratio the hero
      // uses, and short enough that a thumb flick counts without a full drag.
      if (axis === 'h' && Math.abs(dx) > (el.clientWidth || 1) * 0.12) {
        stepRef.current(dx < 0 ? 1 : -1);
      }
      start = null;
      axis = null;
      dx = 0;
      setDragging(false);
      setDrag(0);
    };

    el.addEventListener('touchstart', onStart, {passive: true});
    el.addEventListener('touchmove', onMove, {passive: false});
    el.addEventListener('touchend', onEnd, {passive: true});
    el.addEventListener('touchcancel', onEnd, {passive: true});
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [canSwipe]);

  return (
    <div
      className="product-grid-gallery"
      data-count={Math.min(items.length, 9)}
    >
      {items.length > 1 && (
        <div className="pgg-rail" aria-label="Product media">
          {items.map((m) => {
            const selected = m.key === activeItem.key;
            return (
              <button
                className={`pgg-thumb ${selected ? 'is-selected' : ''}`}
                key={m.key}
                type="button"
                aria-label={`View ${mediaLabel(m.kind)}`}
                aria-pressed={selected}
                onClick={() => setActiveKey(m.key)}
              >
                <GalleryThumb media={m} title={title} />
                {m.kind !== 'image' && (
                  <span className="pgg-video-mark" aria-hidden="true">
                    ▶
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="pgg-stage" ref={stageRef}>
        {/* Damped to ~40% of the finger: the photo tracks the gesture enough to
            feel physical, but never slides so far that the empty stage behind
            it shows.

            Every image is mounted at once and stacked, with only the active
            one at opacity 1 — swapping is then a pure crossfade between two
            already-decoded layers. Remounting a single tile per change (what
            `key` used to do) tears the old photo out before the new one has
            painted, which is the blink. Videos and embeds still mount only
            while active: preloading a stack of them is not worth a fade. */}
        <div
          className={`pgg-swipe${dragging ? ' is-dragging' : ''}`}
          style={
            drag ? {transform: `translate3d(${drag * 0.4}px,0,0)`} : undefined
          }
        >
          {items.map((m) =>
            m.kind === 'image' || m.key === activeItem.key ? (
              <GalleryTile
                key={m.key}
                media={m}
                title={title}
                featured
                active={m.key === activeItem.key}
              />
            ) : null,
          )}
        </div>
        {/* Mobile paging, laid over the image. The rail is hidden below 48em —
            thumbnails there are too small to tell two gold chains apart and
            cost a whole row of height — so stepping lives on the photo itself
            and the shopper can also just swipe it. */}
        {items.length > 1 && (
          <div className="pgg-nav">
            <button
              aria-label="Previous image"
              className="pgg-nav-btn"
              onClick={() => step(-1)}
              type="button"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              aria-label="Next image"
              className="pgg-nav-btn"
              onClick={() => step(1)}
              type="button"
            >
              <ArrowIcon direction="right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Shopify's Video.sources mixes MP4 renditions with an HLS stream
 * (application/x-mpegURL), which non-Safari browsers can't play natively and
 * won't fall back from. Drop HLS when an MP4 exists so playback works
 * everywhere; keep original order otherwise.
 */
const isHls = (mime?: string | null) => /mpegurl/i.test(mime ?? '');

function playableSources(sources: NonNullable<GalleryMedia['sources']>) {
  const mp4 = sources.filter(
    (s) => /mp4/i.test(s.mimeType ?? '') || /\.mp4(?:\?|$)/i.test(s.url),
  );
  return mp4.length ? mp4 : sources;
}

function GalleryThumb({media: m, title}: {media: GalleryMedia; title: string}) {
  const thumbUrl = m.kind === 'image' ? m.image?.url : m.thumbUrl;

  // 8rem rail, so 400w covers a DPR-3 phone.
  //
  // `lazy`, and that word is doing the most work on this page: the rail is
  // `display: none` below 48em, and a lazy image inside a hidden subtree never
  // intersects, so the browser skips it outright. Eager downloaded all dozen
  // of them on every phone — for a rail nobody can see — straight out of the
  // featured shot's bandwidth. On desktop the rail is at the fold and these
  // still arrive immediately, just behind the photo instead of ahead of it.
  return (
    <span className="pgg-tile">
      {thumbUrl ? (
        <img
          src={cdnWidth(thumbUrl, 400)}
          alt={m.alt || title}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="pgg-thumb-fallback" />
      )}
    </span>
  );
}

function GalleryTile({
  media: m,
  title,
  featured = false,
  active = true,
}: {
  media: GalleryMedia;
  title: string;
  featured?: boolean;
  /** Stage tiles are all mounted; only the active one is visible and hoverable. */
  active?: boolean;
}) {
  // Hover-to-zoom on the featured image: pan the transform-origin to the
  // cursor so the shopper can inspect detail without any forced crop at rest.
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const isZoomable = featured && m.kind === 'image' && !!m.image;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomable) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <div
      /**
       * The stack hides inactive photos with `opacity: 0`, which hides them
       * from eyes and from nobody else — opacity is not `visibility` or
       * `display`, so all of them stay in the accessibility tree. A shopper on
       * a screen reader, or an agent reading the page, met the same product
       * image announced once per photo in the set: two here, twelve on a
       * product with twelve shots, every one with the identical alt text.
       *
       * Safe to hide wholesale because a non-active tile is only ever an image:
       * the parent mounts video and embed tiles solely while they are active,
       * so there is never a focusable control sealed inside an `aria-hidden`
       * subtree (which would be its own violation).
       */
      aria-hidden={!active}
      className={`${featured ? 'pgg-feature' : 'pgg-tile'}${
        zoom ? ' is-zoomed' : ''
      }${active ? ' is-active' : ''}`}
      onMouseEnter={isZoomable ? () => setZoom(true) : undefined}
      onMouseLeave={isZoomable ? () => setZoom(false) : undefined}
      onMouseMove={onMove}
    >
      {m.kind === 'image' && m.image ? (
        <Image
          data={{
            url: m.image.url,
            altText: m.image.altText,
          // Provide conservative fallbacks so the browser can compute an
          // intrinsic aspect ratio and reserve space before images decode,
          // reducing CLS when product image dimensions are missing.
          width: m.image.width ?? 1200,
          height: m.image.height ?? 1200,
        }}
        alt={m.image.altText || m.alt || title}
          sizes={featured ? '(min-width: 48em) 52vw, 100vw' : '96px'}
          loader={cdnLoader}
          /**
           * Only the visible photo is eager. Every image in the set is mounted
           * at once (see the stacking note above) and they were ALL eager, so a
           * product with eight shots pulled eight full-stage images — roughly a
           * megabyte — in parallel with the one the shopper is waiting to see.
           * That, not the file size of any single image, is what put LCP at
           * 7.4s on a phone.
           *
           * The stack still loads, so the crossfade keeps its already-decoded
           * layers; it just queues behind the LCP instead of racing it.
           */
          loading={active ? 'eager' : 'lazy'}
          /**
           * The featured shot is the product page's LCP element. `eager` only
           * stops it being deferred; it still queues at default priority
           * alongside its own siblings. This promotes it and demotes them.
           *
           * Spread, and lowercase, on purpose: React 18.3 has no built-in
           * handling for this attribute, so the camelCase spelling that
           * `@types/react` advertises logs "React does not recognize the
           * fetchPriority prop" and the lowercase spelling is what actually
           * reaches the DOM cleanly. Drop the spread when React 19 lands.
           */
          {...(featured && active
            ? {fetchpriority: 'high'}
            : {fetchpriority: 'low'})}
          style={featured ? {transformOrigin: origin} : undefined}
        />
      ) : m.kind === 'video' && m.sources?.length ? (
        <VideoPlayer
          key={m.key}
          sources={m.sources}
          poster={m.thumbUrl}
          preload={featured ? 'auto' : 'metadata'}
        />
      ) : m.kind === 'external' && m.embedUrl ? (
        <iframe
          className="pgg-media"
          src={m.embedUrl}
          title={m.alt || title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : null}
    </div>
  );
}

function VideoPlayer({
  sources,
  poster,
  preload,
}: {
  sources: NonNullable<GalleryMedia['sources']>;
  poster?: string | null;
  preload: 'auto' | 'metadata';
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const orderedSources = playableSources(sources);
  const hlsSource = sources.find((source) => isHls(source.mimeType));
  const hasMp4 = orderedSources.some(
    (source) =>
      /mp4/i.test(source.mimeType ?? '') || /\.mp4(?:\?|$)/i.test(source.url),
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasMp4 || !hlsSource?.url) return;

    let hls: Hls | null = null;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsSource.url;
      return;
    }

    void import('hls.js').then(({default: Hls}) => {
      if (!videoRef.current || !Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(hlsSource.url);
      hls.attachMedia(videoRef.current);
    });

    return () => {
      hls?.destroy();
    };
  }, [hasMp4, hlsSource?.url]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={videoRef}
      className="pgg-media"
      controls
      playsInline
      preload={preload}
      poster={poster || undefined}
    >
      {hasMp4 &&
        orderedSources.map((source) => (
          <source
            key={source.url}
            src={source.url}
            type={source.mimeType || undefined}
          />
        ))}
    </video>
  );
}

/**
 * Shaft-and-head arrow, the same mark the footer's Subscribe control uses —
 * a drawn line rather than a bare chevron, so the two controls read as one
 * vocabulary. Declared locally because that is how every icon in this codebase
 * is done; there is no shared icon module to reuse.
 */
function ArrowIcon({direction}: {direction: 'left' | 'right'}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1.15rem"
      viewBox="0 0 24 24"
      width="1.15rem"
      style={direction === 'left' ? {transform: 'scaleX(-1)'} : undefined}
    >
      <path
        d="M4 12h15"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="m13 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function mediaLabel(kind: GalleryMedia['kind']) {
  if (kind === 'video') return 'product video';
  if (kind === 'external') return 'product video';
  return 'product image';
}
