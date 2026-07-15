import {useEffect, useMemo, useRef, useState} from 'react';
import {Image} from '@shopify/hydrogen';
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
  const thumbs = items.slice(0, 5);
  const showSliderButtons = items.length > 1;
  const goToItem = (direction: -1 | 1) => {
    const nextIndex = (activeIndex + direction + items.length) % items.length;
    setActiveKey(items[nextIndex].key);
  };

  return (
    <div className="product-grid-gallery">
      <GalleryTile media={activeItem} title={title} featured />
      {showSliderButtons && (
        <div className="pgg-slider-controls" aria-label="Product gallery controls">
          <button
            type="button"
            className="pgg-slider-btn"
            aria-label="Previous product media"
            onClick={() => goToItem(-1)}
          >
            {'<'}
          </button>
          <button
            type="button"
            className="pgg-slider-btn"
            aria-label="Next product media"
            onClick={() => goToItem(1)}
          >
            {'>'}
          </button>
        </div>
      )}
      {thumbs.length > 1 && (
        <div className="pgg-thumbs" aria-label="Product media">
          {thumbs.map((m) => {
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
      <div className="pgg-preload" aria-hidden="true">
        {items
          .filter((m) => m.kind === 'image' && m.image?.url)
          .map((m) => (
            <img key={m.key} src={m.image!.url} alt="" loading="eager" />
          ))}
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

  return (
    <span className="pgg-tile">
      {thumbUrl ? (
        <img src={thumbUrl} alt={m.alt || title} loading="eager" />
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
}: {
  media: GalleryMedia;
  title: string;
  featured?: boolean;
}) {
  return (
    <div className={featured ? 'pgg-feature' : 'pgg-tile'}>
      {m.kind === 'image' && m.image ? (
        <Image
          data={{
            url: m.image.url,
            altText: m.image.altText,
            width: m.image.width ?? undefined,
            height: m.image.height ?? undefined,
          }}
          alt={m.image.altText || m.alt || title}
          sizes={featured ? '(min-width: 48em) 52vw, 100vw' : '96px'}
          loading="eager"
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
    (source) => /mp4/i.test(source.mimeType ?? '') || /\.mp4(?:\?|$)/i.test(source.url),
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

function mediaLabel(kind: GalleryMedia['kind']) {
  if (kind === 'video') return 'product video';
  if (kind === 'external') return 'product video';
  return 'product image';
}
