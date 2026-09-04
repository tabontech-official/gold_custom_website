import type {Route} from './+types/api.appointment';
import {
  createCustomerRecord,
  saveCustomerMetafields,
} from '~/lib/customer-metafields';

export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();

  const name = String(form.get('name') ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();

  const phone = String(form.get('phone') ?? '')
    .trim()
    .slice(0, 30);

  const date = String(form.get('date') ?? '').trim();

  const message = String(form.get('message') ?? '')
    .trim()
    .slice(0, 1000);

  // Present only when the modal was opened from a product page (hidden
  // inputs) — the header's "Book Now" posts neither.
  const productTitle = String(form.get('productTitle') ?? '').trim();
  const productHandle = String(form.get('productHandle') ?? '').trim();
  const variantInfo = String(form.get('variantInfo') ?? '').trim();

  const errors: Record<string, string> = {};

  if (name.length < 2) {
    errors.name = 'Please enter your full name.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) {
    errors.phone = 'Please enter a valid phone number.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please choose a date.';
  }

  if (Object.keys(errors).length) {
    return {ok: false, errors};
  }

  try {
    const [firstName, ...rest] = name.split(' ');

    const {customerCreate} = await context.storefront.mutate(
      APPOINTMENT_CUSTOMER_MUTATION,
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
      return {
        ok: false,
        error: customerError.message,
      };
    }

    // Booked from a product page: auto-fetch the piece's title and first
    // image server-side (never shown in the form) for custom.product and
    // custom.gallery. Booked from the header there's no handle, so both
    // stay empty. Storefront API on purpose — it's public data, needs no
    // extra Admin scope, and returns the MediaImage id that the gallery
    // definition (file_reference) expects.
    let productLine = [productTitle, variantInfo].filter(Boolean).join(' — ');
    let galleryId = '';

    if (productHandle) {
      const {product} = await context.storefront.query(
        APPOINTMENT_PRODUCT_QUERY,
        {variables: {handle: productHandle}},
      );

      if (product) {
        productLine = [product.title, variantInfo].filter(Boolean).join(' — ');
        const media = product.media.nodes[0];
        if (media && 'id' in media) {
          galleryId = media.id;
        }
      }
    }

    // The Customer-record metaobject entry IS the submission now — the
    // per-field customer metafield definitions were replaced by it. The
    // definition has no date field, so the requested date rides in the
    // custom_design JSON.
    const recordId = await createCustomerRecord(context.env, {
      request_type: 'Appointment',
      name,
      email,
      phone,
      product: productLine,
      custom_design: JSON.stringify({requested_date: date}),
      description: message,
      gallery: galleryId,
    });

    if (!recordId) {
      return {
        ok: false,
        error: 'Something went wrong. Please try again.',
      };
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
      return {
        ok: false,
        error: 'Something went wrong. Please try again.',
      };
    }

    return {ok: true};
  } catch (error) {
    console.error('[appointment]', error);

    return {
      ok: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}

const APPOINTMENT_PRODUCT_QUERY = `#graphql
  query AppointmentProduct($handle: String!) {
    product(handle: $handle) {
      title
      media(first: 1) {
        nodes {
          ... on MediaImage {
            id
          }
        }
      }
    }
  }
` as const;

const APPOINTMENT_CUSTOMER_MUTATION = `#graphql
  mutation AppointmentCustomer($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;
