import type {Route} from './+types/api.appointment';
import {sendEmailJs} from '~/lib/email';

// Private-consultation request. Mirrors the newsletter (api.subscribe): create
// the customer via the Storefront API (TAKEN = already on file, fine), then
// email the appointment details to the store + a confirmation to the customer.
// No Admin API, no metaobjects, no metafields.
export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').replace(/\s+/g, ' ').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const date = String(form.get('date') ?? '').trim();
  const productTitle = String(form.get('productTitle') ?? '').trim();
  const productHandle = String(form.get('productHandle') ?? '').trim();
  const variantInfo = String(form.get('variantInfo') ?? '').trim();
  const message = String(form.get('message') ?? '').trim().slice(0, 1000);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Please enter a valid email address.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Please choose a date.';
  if (Object.keys(errors).length) return {ok: false, errors};

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
            // ponytail: throwaway password — passwordless customer accounts;
            // the record only needs to exist + carry marketing consent.
            password: crypto.randomUUID(),
            acceptsMarketing: true,
          },
        },
      },
    );

    const err = customerCreate?.customerUserErrors?.[0];
    // TAKEN = already a customer; not an error for our purposes.
    if (err && err.code !== 'TAKEN') return {ok: false, error: err.message};

    // Emails are best-effort — a booking is "received" even if email is off.
    await sendEmails(context.env, {
      name,
      email,
      date,
      productTitle,
      productHandle,
      variantInfo,
      message,
    });

    return {ok: true};
  } catch (error) {
    console.error('[appointment]', error);
    return {ok: false, error: 'Something went wrong. Please try again.'};
  }
}

type Details = {
  name: string;
  email: string;
  date: string;
  productTitle: string;
  productHandle: string;
  variantInfo: string;
  message: string;
};

function prettyDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
}

// Sends the store alert via EmailJS. If credentials are unset, quietly skips
// (booking still succeeds) — see sendEmailJs.
//
// One variable per field, so the template can lay each out as its own row
// instead of printing one pre-wrapped text blob. Every value is sent as a
// string — EmailJS drops a missing variable's row silently, but an empty
// string still renders the row's label, so absent optional fields are sent
// as '' and the template uses EmailJS's {{#var}}...{{/var}} section syntax
// to omit the whole row.
//
// Values are plain text, never HTML: EmailJS escapes template variable
// content (a live send proved it — `<br>` came back as the literal text
// "<br>"), so any tag put in here renders as visible characters.
async function sendEmails(env: Env, d: Details): Promise<void> {
  const notify = (env as any).NOTIFY_EMAIL as string | undefined;
  if (!notify) {
    console.warn('[appointment] NOTIFY_EMAIL unset — store alert skipped');
    return;
  }
  const templateId = (env as any).EMAILJS_TEMPLATE_APPOINTMENT as
    | string
    | undefined;

  const productUrl = d.productHandle
    ? `https://goldcustom.com/products/${d.productHandle}`
    : '';

  await sendEmailJs(
    env,
    {
      templateId,
      templateParams: {
        to_email: notify,
        name: d.name,
        email: d.email,
        requested_date: prettyDate(d.date),
        product: d.productTitle,
        variant: d.variantInfo,
        product_url: productUrl,
        message: d.message,
        time: new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date()),
      },
    },
    'appointment',
  );
}

const APPOINTMENT_CUSTOMER_MUTATION = `#graphql
  mutation AppointmentCustomer($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer { id }
      customerUserErrors { code message }
    }
  }
` as const;
