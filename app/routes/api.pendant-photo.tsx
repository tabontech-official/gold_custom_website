import type {Route} from './+types/api.pendant-photo';
import {fileCdnUrl, uploadReferenceImage} from '~/lib/customer-metafields';
import {pendantPhotoError} from '~/lib/pendantPhoto';

/**
 * Picture Pendant photo upload. Takes the shopper's image, puts it in Shopify
 * Files (Content > Files in admin, same store the custom-jewelry references go
 * to) and hands back its CDN URL for the cart line attribute.
 *
 * Server-side, because the Admin API token that can write files must never
 * reach the browser — and because the browser then has nothing to do but post
 * the file it already has: no resizing, no base64, no canvas work.
 */
export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const photo = form.get('photo');
  const productTitle = String(form.get('product') ?? '').slice(0, 120);

  if (!(photo instanceof File)) {
    return {error: 'Please choose a photo.'};
  }

  // The same rules the browser checked. That check is a courtesy to the
  // shopper; this one is the one that decides.
  const invalid = pendantPhotoError(photo);
  if (invalid) return {error: invalid};

  try {
    // Alt text is how the workshop finds the image in admin when they open it
    // from the order, so it names the product it was uploaded for.
    const fileId = await uploadReferenceImage(
      context.env,
      photo,
      `Picture pendant photo${productTitle ? ` — ${productTitle}` : ''}`,
    );
    const url = fileId ? await fileCdnUrl(context.env, fileId) : undefined;

    if (!url) {
      return {error: 'We could not save that photo. Please try again.'};
    }

    return {url};
  } catch (error) {
    console.error('[pendant-photo]', error);
    return {error: 'We could not save that photo. Please try again.'};
  }
}
