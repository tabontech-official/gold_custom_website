import {useMemo} from 'react';
import {Image} from '@shopify/hydrogen';

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

  if (!items.length) {
    return <div className="product-gallery-empty" aria-hidden="true" />;
  }

  // 5+ media simply continue the two-column square grid, row by row.
  const count = Math.min(items.length, 4);

  return (
    <div className="product-grid-gallery" data-count={count}>
      {items.map((m) => (
        <GalleryTile key={m.key} media={m} title={title} />
      ))}
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
  const mp4 = sources.filter((s) => !isHls(s.mimeType));
  return mp4.length ? mp4 : sources;
}

function GalleryTile({media: m, title}: {media: GalleryMedia; title: string}) {
  return (
    <div className="pgg-tile">
      {m.kind === 'image' && m.image ? (
        <Image
          data={{
            url: m.image.url,
            altText: m.image.altText,
            width: m.image.width ?? undefined,
            height: m.image.height ?? undefined,
          }}
          alt={m.image.altText || m.alt || title}
          sizes="(min-width: 48em) 30vw, 50vw"
          loading="eager"
        />
      ) : m.kind === 'video' && m.sources?.length ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          className="pgg-media"
          controls
          playsInline
          preload="metadata"
          poster={m.thumbUrl || undefined}
        >
          {playableSources(m.sources).map((source) => (
            <source
              key={source.url}
              src={source.url}
              type={source.mimeType || undefined}
            />
          ))}
        </video>
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
