/**
 * The browsable slice of the shop's product tags.
 *
 * The catalogue carries 2,962 distinct tags across 4,282 products, but 2,130 of
 * them sit on four products or fewer, and the highest-volume tag of all is
 * `Fold Ring` — a typo for "Gold Ring" applied to 91% of the catalogue.
 * Alongside it live pure workflow markers: `Video Edit` (996 products),
 * `Des Done`, `Need Variants`, `Female Ring Batch 2`, `Batch 1001`…`Batch 1010`.
 *
 * So this is an allowlist, not a threshold. Anything auto-derived would publish
 * the operations team's internal notes to customers the moment a new marker
 * crossed whatever cut-off we picked.
 *
 * `tag` must match the Shopify tag byte-for-byte — it goes into the search
 * query. `label` is what shoppers read, which is how tags with typos
 * (`Men's Jewelery`) or database-ish shapes (`Men-Ring`) still get a clean
 * name on the page. Counts in the comments are from the catalogue walk on
 * 2026-08-05; they drift, and nothing reads them.
 */
export type BrowseTag = {
  /** Verbatim Shopify tag. Changing this silently empties the results page. */
  tag: string;
  /** Shopper-facing name. Defaults to `tag`. */
  label?: string;
};

export type BrowseGroup = {
  title: string;
  /** One-line orientation under the group heading. */
  blurb: string;
  tags: BrowseTag[];
};

export const BROWSE_GROUPS: BrowseGroup[] = [
  {
    title: 'Ring Styles',
    blurb: 'Shapes and settings that cut across the ring collections.',
    tags: [
      {tag: 'Statement Ring', label: 'Statement Rings'}, // 96
      {tag: 'Everyday Ring', label: 'Everyday Rings'}, // 83
      {tag: 'Dainty Gold Ring', label: 'Dainty Rings'}, // 76
      {tag: 'Pave Ring', label: 'Pavé Rings'}, // 37
      {tag: 'Promise Ring', label: 'Promise Rings'}, // 31
      {tag: 'baguette diamond ring', label: 'Baguette Diamond Rings'}, // 26
    ],
  },
  {
    title: 'Personalised',
    blurb: 'Made with a name, a letter or a photograph on it.',
    tags: [
      {tag: 'Initial Pendant', label: 'Initial Pendants'}, // 139
      {tag: 'Personalized Jewelry'}, // 123
      {tag: 'Diamond Initial', label: 'Diamond Initials'}, // 112
      {tag: 'Custom Jewelry'}, // 105
      {tag: 'Monogram', label: 'Monogram Pendants'}, // 98
      {tag: 'Letter Pendant', label: 'Letter Pendants'}, // 61
      {tag: 'Name Necklace', label: 'Name Necklaces'}, // 28
    ],
  },
  {
    title: 'Motifs & Symbols',
    blurb: 'Individual symbols, finer-grained than the religious collections.',
    tags: [
      {tag: 'Diamond Cross', label: 'Diamond Crosses'}, // 35
      {tag: 'Butterfly Ring', label: 'Butterfly Rings'}, // 35
      {tag: 'gold flower ring', label: 'Flower Rings'}, // 24
      {tag: 'Crown Pendant', label: 'Crown Pendants'}, // 20
      {tag: 'Saint Jude Pendant', label: 'Saint Jude Pendants'}, // 18
      {tag: 'Butterfly Necklace', label: 'Butterfly Necklaces'}, // 18
      {tag: 'Virgin Mary ring', label: 'Virgin Mary Rings'}, // 15
    ],
  },
  {
    title: 'Metal & Stones',
    blurb: 'Real gold throughout, with the karat stated on every piece.',
    tags: [
      {tag: '10K', label: '10K Gold'}, // 1118
      {tag: '14K', label: '14K Gold'}, // 512
      {tag: 'Yellow Gold'}, // 218
      {tag: 'Solid Gold'}, // 196
      {tag: 'Italian', label: 'Italian Made'}, // 85
      {tag: 'Cubic Zirconia'}, // 70
      {tag: 'White Gold'}, // 41
      {tag: 'Real Diamonds'}, // 38
      {tag: '10K White Gold'}, // 19
      {tag: '14K White Gold'}, // 18
    ],
  },
  {
    title: 'Gifts & Occasions',
    blurb: 'Pieces bought for someone else, by the reason they are bought.',
    tags: [
      {tag: 'Gift for Her'}, // 265
      {tag: 'Birthday Gift', label: 'Birthday Gifts'}, // 208
      {tag: 'Anniversary Gift', label: 'Anniversary Gifts'}, // 250+
      {tag: 'Gift for Him'}, // 51
      {tag: "Valentine's Day"}, // 50
      {tag: "Mother's Day"}, // 41
      {tag: 'Holiday Gift', label: 'Holiday Gifts'}, // 29
    ],
  },
  {
    title: 'Looks',
    blurb: 'Broad strokes, for when the piece matters less than the feel.',
    tags: [
      {tag: 'Fine Jewelry'}, // 352
      {tag: 'Unisex'}, // 172
      {tag: 'Hip Hop Jewelry'}, // 75
    ],
  },
];

/** Shopper-facing name for a tag entry. */
export function browseLabel(entry: BrowseTag): string {
  return entry.label ?? entry.tag;
}

/**
 * Build the Shopify search term for a tag.
 *
 * DOUBLE quotes, deliberately. Shopify's search syntax accepts `tag:'…'` too,
 * but a third of these tags contain an apostrophe (`Men's Earrings`) and the
 * single-quoted form silently matches nothing for them — verified against the
 * live Storefront API: `tag:'Men's Earrings'` → 0 hits, `tag:"Men's Earrings"`
 * → the full set. A wrong quote here fails as an empty results page, not an
 * error, so it would be easy to miss.
 */
export function tagSearchTerm(tag: string): string {
  return `tag:"${tag.replace(/"/g, '\\"')}"`;
}

/** Link target for a browsable tag. */
export function tagSearchPath(tag: string): string {
  return `/search?q=${encodeURIComponent(tagSearchTerm(tag))}`;
}

/**
 * Inverse of `tagSearchTerm`: pull the tag back out of a search term so the
 * results page can show "Cross Pendants" instead of `tag:"Cross Pendants"`.
 * Returns null for ordinary searches.
 */
export function tagFromSearchTerm(term: string): string | null {
  const match = /^tag:"((?:[^"\\]|\\.)*)"$/.exec(term.trim());
  return match ? match[1].replace(/\\"/g, '"') : null;
}

/** Every browsable tag, flattened. Used by the sitemap-ish listings and tests. */
export function allBrowseTags(): BrowseTag[] {
  return BROWSE_GROUPS.flatMap((group) => group.tags);
}

/**
 * Loose key for comparing a tag against a collection title, so the sidebar can
 * hide a tag the Categories list already links to. Ignores case, punctuation
 * and a trailing plural, which is what separates "Cross Pendants" the tag from
 * "Cross Pendants" the collection.
 */
export function browseNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
}
