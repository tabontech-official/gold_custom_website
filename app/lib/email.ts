/**
 * Shared Resend plumbing. Started as one copy inside api.appointment.tsx;
 * pulled out once api.custom-jewelry.tsx needed the identical shell/row
 * template and send call — two real call sites, not a hypothetical one.
 */

export function escapeHtml(v: string): string {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[
        c
      ]!,
  );
}

export function emailRow(label: string, value: string): string {
  return `<p style="margin:0 0 10px;font-size:15px"><span style="color:#8a8175">${label}:</span> <strong style="color:#1c1a17">${escapeHtml(value)}</strong></p>`;
}

export function emailShell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#2b2620">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:1px solid #e6ddc9;border-radius:12px;overflow:hidden">
      <tr><td style="background:#1c1a17;padding:24px;text-align:center"><span style="color:#d4af6a;font-size:20px;letter-spacing:3px;text-transform:uppercase">Gold Custom</span></td></tr>
      <tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:22px;font-weight:normal;color:#1c1a17">${title}</h1>${body}</td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #eee4d2;font-size:12px;color:#8a8175;text-align:center">Gold Custom · Fine Jewelry &amp; Watches</td></tr>
    </table></td></tr></table></body></html>`;
}

/**
 * Reads RESEND_API_KEY/RESEND_FROM off the Worker env the same way every
 * caller here needs to — `Env` doesn't declare these (they're store-specific
 * secrets, not part of Hydrogen's own type), hence the one `as any` each call
 * site would otherwise repeat.
 */
export function resendConfig(env: Env): {key?: string; from: string} {
  const key = (env as any).RESEND_API_KEY as string | undefined;
  const from =
    ((env as any).RESEND_FROM as string) ||
    'Gold Custom <onboarding@resend.dev>';
  return {key, from};
}

/**
 * Sends one email through Resend. Best-effort — logs and returns rather than
 * throwing, so a Resend outage never fails the form submission it's attached
 * to (every caller already treats "the inquiry was received" as true once
 * validation passes and the record/customer side succeeds).
 */
export async function sendResendEmail(
  env: Env,
  {
    to,
    subject,
    html,
    attachments,
  }: {
    to: string;
    subject: string;
    html: string;
    /** Resend's own shape: base64 `content`, no data: URI prefix. */
    attachments?: Array<{filename: string; content: string}>;
  },
  logTag: string,
): Promise<void> {
  const {key, from} = resendConfig(env);
  if (!key) {
    console.warn(`[${logTag}] RESEND_API_KEY unset — email skipped`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({from, to, subject, html, attachments}),
  });
  if (!res.ok) console.error(`[${logTag}] Resend ${to}:`, await res.text());
}
