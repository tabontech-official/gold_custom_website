/**
 * Self-check for the browsable tag list.
 * No test runner in this project, so: `npx tsx app/lib/browseTags.test.ts`
 *
 * The round-trip cases matter more than they look: a tag whose quoting is
 * wrong produces an EMPTY results page rather than an error, so nothing
 * downstream would fail loudly.
 *
 * ponytail: plain asserts. `npx tsx app/lib/browseTags.live.ts` is the
 * companion check that every tag still matches products in the live shop —
 * that one needs credentials, so it stays out of here.
 */
import assert from 'node:assert/strict';
import {
  BROWSE_GROUPS,
  allBrowseTags,
  browseLabel,
  tagFromSearchTerm,
  tagSearchPath,
  tagSearchTerm,
} from './browseTags';

// Double-quoted, because a third of these tags contain an apostrophe.
assert.equal(tagSearchTerm('Cross Pendants'), 'tag:"Cross Pendants"');
assert.equal(tagSearchTerm("Men's Earrings"), 'tag:"Men\'s Earrings"');

// Round-trip: whatever we link to, the results page can name again.
for (const entry of allBrowseTags()) {
  assert.equal(
    tagFromSearchTerm(tagSearchTerm(entry.tag)),
    entry.tag,
    `round-trip failed for ${entry.tag}`,
  );
}

// A quote inside a tag must not break out of the term.
assert.equal(tagSearchTerm('12" Chain'), 'tag:"12\\" Chain"');
assert.equal(tagFromSearchTerm('tag:"12\\" Chain"'), '12" Chain');

// Ordinary searches are not tag searches.
assert.equal(tagFromSearchTerm('gold ring'), null);
assert.equal(tagFromSearchTerm(''), null);
assert.equal(tagFromSearchTerm('tag:Rings'), null); // unquoted: not ours

// The path is a usable, encoded URL.
assert.equal(
  tagSearchPath('Cross Pendants'),
  '/search?q=tag%3A%22Cross%20Pendants%22',
);
assert.ok(!tagSearchPath("Men's Earrings").includes(' '));

// Labels: default to the raw tag, override where Shopify's spelling is wrong.
assert.equal(browseLabel({tag: 'Chains'}), 'Chains');
assert.equal(
  browseLabel({tag: "Men's Jewelery", label: "Men's Jewelry"}),
  "Men's Jewelry",
);

// No duplicate tags across groups — the same tag in two places is a bug, and
// two entries pointing at one results page reads as broken navigation.
const seen = new Set<string>();
for (const entry of allBrowseTags()) {
  assert.ok(!seen.has(entry.tag), `duplicate tag: ${entry.tag}`);
  seen.add(entry.tag);
}

// Nothing empty, and every group has content.
assert.ok(BROWSE_GROUPS.length > 0);
for (const group of BROWSE_GROUPS) {
  assert.ok(group.title.trim(), 'group missing title');
  assert.ok(group.blurb.trim(), `group ${group.title} missing blurb`);
  assert.ok(group.tags.length, `group ${group.title} has no tags`);
  for (const entry of group.tags) {
    assert.ok(entry.tag.trim(), `empty tag in ${group.title}`);
    assert.ok(browseLabel(entry).trim(), `empty label in ${group.title}`);
  }
}

// The workflow markers found in the catalogue walk must never appear here.
const INTERNAL = [
  'Fold Ring',
  'Video Edit',
  'Des Done',
  'Need Variants',
  'Need data',
  'Need des',
  'Old draft',
  'Show',
  'Updated',
  'kunza_added',
];
for (const bad of INTERNAL) {
  assert.ok(!seen.has(bad), `internal tag leaked into the browse list: ${bad}`);
}
for (const tag of seen) {
  assert.ok(
    !/^batch\b|\bbatch \d|^\d+ new$/i.test(tag),
    `batch marker leaked into the browse list: ${tag}`,
  );
}

console.log(
  `browseTags: all assertions passed (${BROWSE_GROUPS.length} groups, ${seen.size} tags)`,
);

// --- browseNameKey ----------------------------------------------------------
import {browseNameKey} from './browseTags';

// A tag and the collection that covers it must collapse to one key.
assert.equal(browseNameKey('Cross Pendants'), browseNameKey('cross-pendants'));
assert.equal(browseNameKey("Men's Bracelets"), browseNameKey('mens-bracelet'));
assert.equal(browseNameKey('10K Gold'), browseNameKey('10k gold'));
// Genuinely different things must not collide.
assert.notEqual(browseNameKey('Cross Pendants'), browseNameKey('Diamond Cross'));
assert.notEqual(browseNameKey('Gift for Her'), browseNameKey('Gift for Him'));

console.log('browseTags: browseNameKey ok');
