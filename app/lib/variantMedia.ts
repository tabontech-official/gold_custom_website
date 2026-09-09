/**
 * Per-variant gallery media.
 *
 * Some products carry a full photo AND video set for each metal — the same
 * ring shot in yellow and in white gold. Shopify has no native way to tie a
 * whole media group to an option value, so the merchant's variant-image app
 * writes the group into each media item's ALT TEXT:
 *
 *   t4option0_0   -> option 0 ("Metal"), its 1st value ("14K Yellow Gold")
 *   t4option0_1   -> option 0, its 2nd value ("14K White Gold")
 *
 * The tag is positional on both halves: option index in `product.options`
 * order, value index in that option's `optionValues` order. Media with no tag
 * belongs to every variant (packaging shots, certificates) and is always kept.
 */
const TAG = /t4option(\d+)_(\d+)/i;

export type TaggedMedia = {alt?: string | null};

/** The option/value indices a media item is tagged for, or null when untagged. */
export function mediaOptionTag(
  alt?: string | null,
): {optionIndex: number; valueIndex: number} | null {
  const match = alt?.match(TAG);
  return match
    ? {optionIndex: Number(match[1]), valueIndex: Number(match[2])}
    : null;
}

/**
 * The media belonging to the currently selected variant.
 *
 * Untagged media always stays. A tagged item stays only when its value is the
 * one selected for that option — so switching Metal swaps the whole group,
 * photos and videos together, rather than only the variant's single image.
 *
 * Falls back to the full list whenever filtering would leave nothing, or when
 * nothing is tagged at all: a product whose tags don't cover the selected
 * value must still show a gallery.
 */
export function mediaForSelectedOptions<T extends TaggedMedia>(
  media: T[],
  options: Array<{name?: string | null; optionValues?: Array<{name?: string | null}> | null}>,
  selectedOptions: Array<{name?: string | null; value?: string | null}>,
): T[] {
  // Option index -> the index of the value currently selected on it.
  const selectedValueIndex = new Map<number, number>();
  options.forEach((option, optionIndex) => {
    const selected = selectedOptions.find(
      (item) => item.name?.toLowerCase() === option.name?.toLowerCase(),
    );
    if (!selected) return;
    const valueIndex = (option.optionValues ?? []).findIndex(
      (value) => value.name?.toLowerCase() === selected.value?.toLowerCase(),
    );
    if (valueIndex >= 0) selectedValueIndex.set(optionIndex, valueIndex);
  });

  const kept = media.filter((item) => {
    const tag = mediaOptionTag(item.alt);
    if (!tag) return true;
    const selected = selectedValueIndex.get(tag.optionIndex);
    // Tagged for an option we can't resolve — keep it rather than blank the
    // gallery on a product whose options were renamed.
    return selected === undefined || selected === tag.valueIndex;
  });

  return kept.length ? kept : media;
}

/**
 * The image the gallery should lead with, given the selected variant's own
 * image URL.
 *
 * Shopify lets a variant point at any image on the product, and the catalog
 * has variants whose image contradicts their option group — EDR9-4's WHITE
 * gold variant is assigned the yellow photo. Leading with it put a yellow
 * ring under a "14K White Gold" selector. So the variant image leads only
 * when it is part of the media this variant is actually showing; otherwise
 * the group's own first image does, and nothing false is ever displayed.
 */
export function galleryLeadImage(
  media: Array<{kind?: string; image?: {url?: string} | null}>,
  selectedImageUrl?: string | null,
): string | undefined {
  if (!selectedImageUrl) return undefined;
  return media.some((item) => item.image?.url === selectedImageUrl)
    ? selectedImageUrl
    : undefined;
}
