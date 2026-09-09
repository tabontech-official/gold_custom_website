/**
 * Photo upload for Picture Pendant products.
 *
 * The pendant IS the customer's photo — the piece cannot be made without one,
 * so the upload gates Add to Bag rather than sitting beside it as an optional
 * extra.
 *
 * The uploaded image travels as a cart line attribute holding its Shopify
 * Files URL, exactly the mechanism ring sizing already uses (see ringSizes.ts):
 * Shopify surfaces line attributes as line item properties on the order, so the
 * photo arrives at the workshop attached to the line it was uploaded for, and
 * survives cart -> checkout -> order without anything custom in between.
 *
 * PER LINE is the whole point. Two picture pendants with two different photos
 * are two lines with two different attribute values; nothing is stored per
 * cart, per session or per customer, so there is no shared slot for a second
 * upload to overwrite. Shopify also treats lines whose attributes differ as
 * distinct lines, so even the SAME pendant ordered twice with two photos stays
 * two lines rather than merging into quantity 2 and losing one of them.
 */

/** Line item property name shown in the cart and on the Shopify order. */
export const PENDANT_PHOTO_ATTRIBUTE_KEY = 'Your Photo';

/** JPG/PNG/WEBP — what the workshop can actually print from. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** `accept` for the file input: a filter, never the validation. */
export const PENDANT_PHOTO_ACCEPT = ALLOWED_TYPES.join(',');

/**
 * Comfortably above a modern phone photo (4-6MB) and below the point where the
 * upload stalls on a phone connection. Matches the custom-jewelry form's limit.
 */
export const PENDANT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Whether a product is engraved with a customer photo.
 *
 * The "Picture Pendants" tag is the merchant's own designation and the switch
 * for this feature: it currently covers exactly the 100 products in the
 * `picture-pendants` collection, with no product in one set and not the other,
 * so tagging a new pendant in admin turns the upload on with no code change.
 *
 * productType is checked too because the two failures are not symmetric — an
 * upload box on a pendant that does not need one is a stray field, while a
 * missing one ships a blank pendant. It adds no product to the set today.
 *
 * The match is the WHOLE tag, not a substring of it. A substring test ("does
 * this tag contain the words picture pendant") turned the upload on for the
 * diamond Hamsa pendants, which carry the category tag "Diamond Picture
 * Pendants" — a diamond category, not a photo-engraved piece — and asked
 * shoppers for a photo the product has no use for.
 */
export function isPicturePendantProduct(product: {
  tags?: readonly string[] | null;
  productType?: string | null;
}): boolean {
  const says = (text: string) => /^picture\s+pendants?$/i.test(text.trim());
  return (
    (product.tags ?? []).some(says) || says(product.productType ?? '')
  );
}

/**
 * Why a file can't be used, or undefined when it's fine. Shared by the upload
 * form and the API route so the browser and the server never disagree about
 * what is acceptable — the browser check is for the shopper, the server check
 * is the one that counts.
 */
export function pendantPhotoError(file: {
  type: string;
  size: number;
}): string | undefined {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Please upload a JPG, PNG or WEBP image.';
  }
  if (file.size > PENDANT_PHOTO_MAX_BYTES) {
    return `Please keep the photo under ${PENDANT_PHOTO_MAX_BYTES / (1024 * 1024)}MB.`;
  }
  if (file.size === 0) return 'That file is empty. Please choose another.';
  return undefined;
}
