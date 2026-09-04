import type {Route} from './+types/api.custom-jewelry';
import {
  createCustomerRecord,
  saveCustomerMetafields,
  uploadReferenceImage,
} from '~/lib/customer-metafields';
import {
  PRODUCT_TYPES,
  readSpecSelections,
} from '~/lib/customDesignOptions';

// Custom jewelry inquiry. Same customer-record pattern as api.appointment:
// create the customer via the Storefront API (TAKEN = already on file,
// fine), then record the inquiry on the customer's custom.* metafields —
// the chosen product type into custom.product, the visitor's reference
// image into custom.gallery (uploaded to Shopify Files), the structured
// design into custom.custom_design, and the idea into custom.description.
// Notification is Shopify Flow's job: writing custom.request last is the
// event the store's workflow listens for. No email is sent from here.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').replace(/\s+/g, ' ').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const contact = String(form.get('contact') ?? '').trim().slice(0, 30);
  const productType = String(form.get('productType') ?? '').trim();
  const description = String(form.get('description') ?? '').trim().slice(0, 2000);

  const image = form.get('image');
  const imageFile = image instanceof File && image.size > 0 ? image : undefined;

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Please enter a valid email address.';
  if (!/^\d{7,15}$/.test(contact.replace(/\D/g, '')))
    errors.contact = 'Please enter a valid phone number.';
  if (!PRODUCT_TYPES.includes(productType))
    errors.productType = 'Please choose a product type.';
  // Storing the contact details on a customer record requires the visitor's
  // explicit OK — no consent, no processing.
  if (form.get('consent') !== 'yes')
    errors.consent = 'Please agree so we can store your details and reply.';

  // Per-category design options — required, and only values from the
  // category's own option sheet are accepted.
  const {selections, errors: specErrors} = readSpecSelections(
    productType,
    (field) => String(form.get(field) ?? ''),
  );
  Object.assign(errors, specErrors);
  if (imageFile && !imageFile.type.startsWith('image/'))
    errors.image = 'Please upload an image file.';
  if (imageFile && imageFile.size > MAX_IMAGE_BYTES)
    errors.image = 'Please keep the image under 10MB.';
  // Description is optional — the builder's structured selections already
  // describe the piece; free text only adds to them.

  if (Object.keys(errors).length) return {ok: false, errors};

  try {
    const [firstName, ...rest] = name.split(' ');

    const {customerCreate} = await context.storefront.mutate(
      CUSTOM_JEWELRY_CUSTOMER_MUTATION,
      {
        variables: {
          input: {
            email,
            firstName,
            lastName: rest.join(' ') || undefined,
            password: crypto.randomUUID(),
            acceptsMarketing: true,
          },
        },
      },
    );

    const customerError = customerCreate?.customerUserErrors?.[0];

    // Existing customer is acceptable.
    if (customerError && customerError.code !== 'TAKEN') {
      return {ok: false, error: customerError.message};
    }

    // The reference image is part of the request — if it can't be stored,
    // fail visibly rather than silently dropping it.
    let galleryId = '';
    if (imageFile) {
      const uploaded = await uploadReferenceImage(
        context.env,
        imageFile,
        `Custom jewelry reference — ${email}`,
      );
      if (!uploaded) {
        return {ok: false, error: 'Something went wrong. Please try again.'};
      }
      galleryId = uploaded;
    }

    // Every design choice, structured, labeled by the step names the
    // shopper saw. The free-text description stays OUT of here — it has its
    // own field, carrying only what the customer wrote.
    const designJson = JSON.stringify({
      piece: productType,
      details: Object.fromEntries(selections),
      submitted_at: new Date().toISOString(),
    });

    // The Customer-record metaobject entry IS the submission now — the
    // per-field customer metafield definitions were replaced by it.
    const recordId = await createCustomerRecord(context.env, {
      request_type: 'Custom Jewelry Request',
      name,
      email,
      phone: contact,
      product: productType,
      custom_design: designJson,
      description,
      gallery: galleryId,
    });

    if (!recordId) {
      return {ok: false, error: 'Something went wrong. Please try again.'};
    }

    // Point the customer's custom.customer_details reference at the entry —
    // this metafield write is also what fires the Flow notification.
    const saved = await saveCustomerMetafields(
      context.env,
      customerCreate?.customer?.id,
      email,
      {customer_details: recordId},
    );

    if (!saved) {
      return {ok: false, error: 'Something went wrong. Please try again.'};
    }

    return {ok: true};
  } catch (error) {
    console.error('[custom-jewelry]', error);
    return {ok: false, error: 'Something went wrong. Please try again.'};
  }
}

const CUSTOM_JEWELRY_CUSTOMER_MUTATION = `#graphql
  mutation CustomJewelryCustomer($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      customerUserErrors {
        code
        message
      }
    }
  }
` as const;
