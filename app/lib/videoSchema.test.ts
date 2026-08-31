/**
 * Self-check for the product media → VideoObject JSON-LD path.
 * No test runner in this project, so: `node app/lib/videoSchema.test.ts`
 *
 * The assertions guard the two ways this fails silently: emitting nothing for
 * a page that does have a video, and emitting a VideoObject that Google will
 * reject because a required field is missing.
 */
import assert from 'node:assert/strict';
import {buildVideoJsonLd, type SchemaMedia} from './videoSchema.ts';

const base = {
  name: '10K Cuban Chain',
  description: 'Solid gold Miami Cuban chain.',
  uploadDate: '2024-03-01T00:00:00Z',
  pageUrl: 'https://www.goldcustom.com/collections/chains/products/cuban',
};

const image: SchemaMedia = {kind: 'image', thumbUrl: 'https://cdn/i.jpg'};
const youtube: SchemaMedia = {
  kind: 'external',
  thumbUrl: 'https://cdn/yt.jpg',
  alt: 'Cuban chain on camera',
  embedUrl: 'https://www.youtube.com/embed/abc123',
};
const hosted: SchemaMedia = {
  kind: 'video',
  thumbUrl: 'https://cdn/poster.jpg',
  alt: null,
  sources: [{url: 'https://cdn/clip.mp4', mimeType: 'video/mp4'}],
};

// The common case: a YouTube video in the gallery gets every field Google
// requires, with embedUrl pointing at the YouTube version.
const [video] = buildVideoJsonLd({...base, media: [image, youtube]});
assert.equal(video['@type'], 'VideoObject');
assert.equal(video.name, 'Cuban chain on camera');
assert.equal(video.description, base.description);
assert.equal(video.thumbnailUrl, 'https://cdn/yt.jpg');
assert.equal(video.uploadDate, base.uploadDate);
assert.equal(video.embedUrl, 'https://www.youtube.com/embed/abc123');
for (const field of ['name', 'description', 'thumbnailUrl', 'uploadDate']) {
  assert.ok(video[field as 'name'], `${field} must be present and non-empty`);
}

// Shopify-hosted video uses contentUrl instead, and falls back to the product
// title when the media carries no alt.
const [clip] = buildVideoJsonLd({...base, media: [hosted]});
assert.equal(clip.contentUrl, 'https://cdn/clip.mp4');
assert.equal(clip.embedUrl, undefined);
assert.equal(clip.name, '10K Cuban Chain');

// Images never produce a VideoObject, and ids stay unique per video so two
// videos on one page do not collapse into one node.
const many = buildVideoJsonLd({...base, media: [image, youtube, hosted]});
assert.equal(many.length, 2);
assert.deepEqual(
  many.map((v) => v['@id']),
  [`${base.pageUrl}#video-1`, `${base.pageUrl}#video-2`],
);

// Anything that would publish invalid markup emits nothing at all.
assert.deepEqual(buildVideoJsonLd({...base, media: []}), []);
assert.deepEqual(buildVideoJsonLd({...base, media: [image]}), []);
// No poster frame → no thumbnailUrl → not eligible.
assert.deepEqual(
  buildVideoJsonLd({...base, media: [{...youtube, thumbUrl: null}]}),
  [],
);
// A video with neither an embed nor a source is not a video.
assert.deepEqual(
  buildVideoJsonLd({...base, media: [{...hosted, sources: []}]}),
  [],
);
// No publishedAt on the product → no uploadDate → skip the whole block.
assert.deepEqual(
  buildVideoJsonLd({...base, uploadDate: null, media: [youtube]}),
  [],
);

console.log('videoSchema self-check passed');
