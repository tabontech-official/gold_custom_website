import type {Route} from './+types/api.appointment';
import {emailRow, emailShell, escapeHtml, sendResendEmail} from '~/lib/email';

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

// Sends the store alert + customer confirmation via Resend. If RESEND_API_KEY
// is unset, quietly skips (booking still succeeds).
async function sendEmails(env: Env, d: Details): Promise<void> {
  const notify = (env as any).NOTIFY_EMAIL as string | undefined;
  if (!notify) {
    console.warn('[appointment] NOTIFY_EMAIL unset — store alert skipped');
  }
  const storeUrl = `https://goldcustom.com/products/${d.productHandle}`;
  const when = prettyDate(d.date);

  const messageBlock = d.message
    ? `<div style="margin:16px 0 0;padding:12px 14px;background:#faf6ec;border-left:3px solid #d4af6a">
         <div style="font-size:13px;color:#8a8175;margin-bottom:4px">Message</div>
         <div style="font-size:15px;color:#2b2620;white-space:pre-wrap">${escapeHtml(d.message)}</div>
       </div>`
    : '';

  // Only the store alert depends on NOTIFY_EMAIL; the customer confirmation
  // below is addressed to the booker, so it must still send when this is unset.
  if (notify) {
    await sendResendEmail(
      env,
      {
        to: notify,
        subject: 'New Jewelry Appointment Alert',
        html: emailShell(
          'New Consultation Request',
          `<p style="margin:0 0 18px;color:#4a463f">A customer has requested a private consultation.</p>
       ${emailRow('Customer', d.name)}${emailRow('Email', d.email)}${emailRow('Appointment', when)}
       ${emailRow('Product', d.productTitle)}${d.variantInfo ? emailRow('Variant', d.variantInfo) : ''}
       ${messageBlock}
       <p style="margin:18px 0 0"><a href="${escapeHtml(storeUrl)}" style="color:#b6893f">View product &rarr;</a></p>`,
        ),
      },
      'appointment',
    );
  }

  // Customer confirmation — opt-in, because it needs a VERIFIED SENDING DOMAIN.
  //
  // Resend's shared `onboarding@resend.dev` sender may only deliver to the
  // account owner's own address; every other recipient is rejected 403. The
  // store alert above is fine (it goes to the owner), but this one is addressed
  // to whoever booked, so on a sandbox account it fails 100% of the time and
  // just fills the log with rejections.
  //
  // To turn it on: verify goldcustom.com at resend.com/domains, point
  // RESEND_FROM at an address on that domain, then set
  // SEND_CUSTOMER_EMAILS="true". Until then the booker sees the on-screen
  // confirmation only, which is what the modal already shows.
  if (String((env as any).SEND_CUSTOMER_EMAILS) !== 'true') return;

  await sendResendEmail(
    env,
    {
      to: d.email,
      subject: 'Your Gold Custom Consultation Request',
      html: emailShell(
        `Thank you, ${escapeHtml(d.name.split(' ')[0])}`,
        `<p style="margin:0 0 16px;line-height:1.6;color:#4a463f">We've received your request for a private consultation. One of our jewelry specialists will contact you shortly to confirm the details.</p>
       ${emailRow('Piece', d.productTitle)}${emailRow('Requested date', when)}
       <p style="margin:20px 0 0"><a href="${escapeHtml(storeUrl)}" style="color:#b6893f">View this piece &rarr;</a></p>`,
      ),
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
