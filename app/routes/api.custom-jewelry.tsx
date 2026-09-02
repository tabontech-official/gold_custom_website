import type {Route} from './+types/api.custom-jewelry';
import {sendEmailJs} from '~/lib/email';

// Custom jewelry inquiry. Mirrors api.appointment: validate, then email the
// details to the store via EmailJS. No customer record is created here —
// unlike a booking, an inquiry isn't a commitment, so there's nothing worth
// putting on file yet.
//
// No reference-photo upload — a file field used to sit here, but EmailJS's
// free-plan request cap (50Kb total, across every field) rejected anything
// but a tiny image with a 413 while the customer still saw "Request
// received" (sendEmailJs swallows send failures so the booking/inquiry
// itself doesn't fail — correct for "EmailJS is down", wrong for "the
// request was too big to ever succeed"). Cut rather than shipped broken.

export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').replace(/\s+/g, ' ').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const contact = String(form.get('contact') ?? '').trim();
  const productType = String(form.get('productType') ?? '').trim();
  const description = String(form.get('description') ?? '').trim().slice(0, 2000);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Please enter a valid email address.';
  if (contact.length < 7) errors.contact = 'Please enter a phone number.';
  if (!productType) errors.productType = 'Please choose a product type.';
  if (description.length < 5)
    errors.description = 'Tell us a little about what you have in mind.';

  if (Object.keys(errors).length) return {ok: false, errors};

  try {
    await sendEmails(context.env, {name, email, contact, productType, description});
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
  // sendEmails in api.appointment.tsx).
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
