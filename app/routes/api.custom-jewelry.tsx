import type {Route} from './+types/api.custom-jewelry';
import {emailRow, emailShell, escapeHtml, sendResendEmail} from '~/lib/email';

// Custom jewelry inquiry. Mirrors api.appointment: validate, then email the
// details to the store (+ an opt-in confirmation to the customer) via
// Resend. No customer record is created here — unlike a booking, an inquiry
// isn't a commitment, so there's nothing worth putting on file yet.
//
// One thing api.appointment doesn't have: an optional reference image/sketch,
// attached to the store alert directly rather than uploaded to storage —
// simpler, and the file only ever needs to reach one inbox.
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // Resend's own request cap is ~40MB combined; one photo/PDF fits comfortably under it.

export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').replace(/\s+/g, ' ').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const contact = String(form.get('contact') ?? '').trim();
  const productType = String(form.get('productType') ?? '').trim();
  const description = String(form.get('description') ?? '').trim().slice(0, 2000);
  const file = form.get('document');

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Please enter a valid email address.';
  if (contact.length < 7) errors.contact = 'Please enter a phone number.';
  if (!productType) errors.productType = 'Please choose a product type.';
  if (description.length < 5)
    errors.description = 'Tell us a little about what you have in mind.';

  let attachment: {filename: string; content: string} | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      errors.document = 'That file is too large — please keep it under 8MB.';
    } else {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      attachment = {filename: file.name || 'reference', content: btoa(binary)};
    }
  }

  if (Object.keys(errors).length) return {ok: false, errors};

  try {
    await sendEmails(context.env, {
      name,
      email,
      contact,
      productType,
      description,
      attachment,
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
  attachment?: {filename: string; content: string};
};

async function sendEmails(env: Env, d: Details): Promise<void> {
  const notify = (env as any).NOTIFY_EMAIL as string | undefined;
  if (!notify) {
    console.warn('[custom-jewelry] NOTIFY_EMAIL unset — store alert skipped');
  }

  const attachmentNote = d.attachment
    ? `<p style="margin:0 0 10px;font-size:15px"><span style="color:#8a8175">Reference:</span> <strong style="color:#1c1a17">${escapeHtml(d.attachment.filename)}</strong> (attached)</p>`
    : '';

  if (notify) {
    await sendResendEmail(
      env,
      {
        to: notify,
        subject: `New Custom Jewelry Request — ${d.productType}`,
        html: emailShell(
          'New Custom Jewelry Request',
          `<p style="margin:0 0 18px;color:#4a463f">A customer wants a custom piece made.</p>
       ${emailRow('Customer', d.name)}${emailRow('Email', d.email)}${emailRow('Phone', d.contact)}
       ${emailRow('Product type', d.productType)}
       ${attachmentNote}
       <div style="margin:16px 0 0;padding:12px 14px;background:#faf6ec;border-left:3px solid #d4af6a">
         <div style="font-size:13px;color:#8a8175;margin-bottom:4px">Description</div>
         <div style="font-size:15px;color:#2b2620;white-space:pre-wrap">${escapeHtml(d.description)}</div>
       </div>`,
        ),
        attachments: d.attachment ? [d.attachment] : undefined,
      },
      'custom-jewelry',
    );
  }

  // Same opt-in gate as api.appointment — see the note there for why this
  // stays off until RESEND_FROM is on a verified sending domain.
  if (String((env as any).SEND_CUSTOMER_EMAILS) !== 'true') return;

  await sendResendEmail(
    env,
    {
      to: d.email,
      subject: 'Your Gold Custom Custom Jewelry Request',
      html: emailShell(
        `Thank you, ${escapeHtml(d.name.split(' ')[0])}`,
        `<p style="margin:0 0 16px;line-height:1.6;color:#4a463f">We've received your custom jewelry request. One of our designers will reach out to talk through your idea and get you a quote.</p>
       ${emailRow('Product type', d.productType)}`,
      ),
    },
    'custom-jewelry',
  );
}
