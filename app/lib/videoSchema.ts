/**
 * VideoObject JSON-LD for product pages that carry a video.
 *
 * ~150 product videos live on YouTube and reach the page as Shopify
 * `ExternalVideo` media; a handful are still Shopify-hosted `Video`. Neither
 * was described to Google, so none of them were eligible for video rich
 * results. This builds the markup from the media the gallery already
 * normalised — no extra query, no per-product hand-authoring.
 */

/** The subset of the gallery's media shape this needs. Structural on purpose:
 *  keeps the self-check runnable under plain `node`, with no React import. */
type VideoSource = {url: string; mimeType?: string | null};
export type SchemaMedia = {
  kind: 'image' | 'video' | 'external';
  thumbUrl?: string | null;
  alt?: string | null;
  sources?: VideoSource[];
  embedUrl?: string | null;
};

export type VideoJsonLd = {
  '@type': 'VideoObject';
  '@id': string;
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  embedUrl?: string;
  contentUrl?: string;
};

/**
 * One VideoObject per video, in gallery order.
 *
 * A video missing `thumbnailUrl` or `uploadDate` is dropped rather than
 * emitted half-filled: Google requires both, and invalid markup on 150 pages
 * is worse than no markup — it earns a Search Console error instead of a
 * thumbnail. Same stance the Product schema takes on `mpn`.
 */
export function buildVideoJsonLd({
  media,
  name,
  description,
  uploadDate,
  pageUrl,
}: {
  media: SchemaMedia[];
  name: string;
  description: string;
  /** ISO 8601. The product's `publishedAt` — see the caller's note. */
  uploadDate?: string | null;
  pageUrl: string;
}): VideoJsonLd[] {
  if (!uploadDate) return [];

  const videos: VideoJsonLd[] = [];

  for (const item of media) {
    if (item.kind !== 'video' && item.kind !== 'external') continue;

    // YouTube/Vimeo embed for external, the first playable source for hosted.
    const embedUrl = item.kind === 'external' ? item.embedUrl : null;
    const contentUrl =
      item.kind === 'video' ? (item.sources?.[0]?.url ?? null) : null;
    if (!embedUrl && !contentUrl) continue;

    // Shopify generates a poster frame for both media types, so this is
    // normally present; without it the entry is not eligible, so skip it.
    if (!item.thumbUrl) continue;

    videos.push({
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${videos.length + 1}`,
      // `alt` already falls back to the product title upstream, but a media
      // item authored with an empty alt would publish an empty `name`.
      name: item.alt?.trim() || name,
      description,
      thumbnailUrl: item.thumbUrl,
      uploadDate,
      ...(embedUrl ? {embedUrl} : {}),
      ...(contentUrl ? {contentUrl} : {}),
    });
  }

  return videos;
}
