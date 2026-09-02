/**
 * Shared EmailJS plumbing. Replaces the Resend integration this file used to
 * hold — Resend's shared sandbox sender could only deliver to the Resend
 * account's own owner address, which made every store-alert email a 403
 * unless a domain got verified. EmailJS's REST API has no such recipient
 * restriction once server-side (non-browser) API access is turned on for
 * the account.
 *
 * Unlike Resend, the email's HTML lives on EmailJS's own dashboard as a
 * template (service_8238tjc / one template per form) — this file only ever
 * sends the template_id plus a flat bag of {{variable}}: value pairs for
 * EmailJS to interpolate. There is no HTML-building helper here anymore
 * because there is nothing left to build; see the two *.html files next to
 * this one for the actual template markup to paste into each EmailJS
 * template's source editor.
 */

/**
 * Reads the four EmailJS values off the Worker env. `Env` doesn't declare
 * these (store-specific secrets, not part of Hydrogen's own type), hence the
 * one `as any` each call site would otherwise repeat.
 */
export function emailJsConfig(env: Env): {
  publicKey?: string;
  privateKey?: string;
  serviceId?: string;
} {
  return {
    publicKey: (env as any).EMAILJS_PUBLIC_KEY as string | undefined,
    privateKey: (env as any).EMAILJS_PRIVATE_KEY as string | undefined,
    serviceId: (env as any).EMAILJS_SERVICE_ID as string | undefined,
  };
}

/**
 * Sends one email through an EmailJS template. Best-effort — logs and
 * returns rather than throwing, so an EmailJS outage or misconfiguration
 * never fails the form submission it's attached to (every caller already
 * treats "the inquiry was received" as true once validation passes).
 *
 * `accessToken` (the private key) is what lets this run from a server at
 * all — EmailJS trusts a browser call by its Origin header, which a Worker
 * request doesn't send, so without the private key every server-side call
 * gets refused as "non-browser". The account also has to have "API calls
 * from non-browser applications" turned on under
 * dashboard.emailjs.com/admin/account/security — the private key alone
 * doesn't bypass that switch.
 */
export async function sendEmailJs(
  env: Env,
  {
    templateId,
    templateParams,
  }: {
    templateId?: string;
    templateParams: Record<string, string>;
  },
  logTag: string,
): Promise<void> {
  const {publicKey, privateKey, serviceId} = emailJsConfig(env);
  if (!publicKey || !privateKey || !serviceId) {
    console.warn(`[${logTag}] EmailJS credentials unset — email skipped`);
    return;
  }
  if (!templateId) {
    console.warn(`[${logTag}] EmailJS template id unset — email skipped`);
    return;
  }
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: templateParams,
    }),
  });
  if (!res.ok) {
    console.error(`[${logTag}] EmailJS ${res.status}:`, await res.text());
  }
}
