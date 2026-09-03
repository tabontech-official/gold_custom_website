import type {Route} from './+types/api.custom-jewelry';
import {sendEmailJs} from '~/lib/email';
import {
  phoneDigits,
  saveCustomerMetafields,
  uploadReferenceImage,
} from '~/lib/customer-metafields';
import {
  PRODUCT_TYPES,
  readSpecSelections,
  specSummary,
} from '~/lib/customDesignOptions';

// Custom jewelry inquiry. Same customer-record pattern as api.appointment:
// create the customer via the Storefront API (TAKEN = already on file,
// fine), then record the inquiry on the customer's custom.* metafields —
// the chosen product type into custom.product, the visitor's reference
// image into custom.gallery (uploaded to Shopify Files; the old EmailJS
// 50Kb cap doesn't apply since the image never enters the email), and the
// idea into custom.description. The store alert email stays as before.

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
  if (description.length < 5)
    errors.description = 'Tell us a little about what you have in mind.';

  if (Object.keys(errors).length) return {ok: false, errors};

  // The chosen options travel inside the description, so the existing
  // custom.description metafield and email template both carry them with no
  // schema or template changes.
  const specs = specSummary(selections);
  const fullDescription = specs ? `${specs}\n\n${description}` : description;

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

    const saved = await saveCustomerMetafields(
      context.env,
      customerCreate?.customer?.id,
      email,
      {
        name,
        phone: phoneDigits(contact),
        product: productType,
        gallery: galleryId,
        description: fullDescription,
      },
    );

    if (!saved) {
      return {ok: false, error: 'Something went wrong. Please try again.'};
    }

    await sendEmails(context.env, {
      name,
      email,
      contact,
      productType,
      description: fullDescription,
    });
    return {ok: true};
  } catch (error) {
    console.error('[custom-jewelry]', error);
    return {ok: false, error: 'Something went wrong. Please try again.'};
  }
}

type Details = {
  name: string;
  email: string;
  contact: string;
  productType: string;
  description: string;
};

async function sendEmails(env: Env, d: Details): Promise<void> {
  const notify = (env as any).NOTIFY_EMAIL as string | undefined;
  if (!notify) {
    console.warn('[custom-jewelry] NOTIFY_EMAIL unset — store alert skipped');
    return;
  }
  const templateId = (env as any).EMAILJS_TEMPLATE_CUSTOM_JEWELRY as
    | string
    | undefined;

  // One variable per field so the template lays each out as its own row.
  // Values are plain text, never HTML — EmailJS escapes template variable
  // content, so an injected tag renders as visible text (see the note above
  // sendEmails in the pre-metafields api.appointment.tsx history).
  await sendEmailJs(
    env,
    {
      templateId,
      templateParams: {
        to_email: notify,
        name: d.name,
        email: d.email,
        phone: d.contact,
        product_type: d.productType,
        description: d.description,
        time: new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date()),
      },
    },
    'custom-jewelry',
  );
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
