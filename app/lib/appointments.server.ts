/**
 * Appointment booking — server only.
 *
 * Flow (all Admin API, server-side): validate → upsert customer → create a
 * `jewelry_appointment` metaobject (one row per booking, never overwritten) →
 * bump the customer's `custom.appointment_count` / `custom.last_appointment_date`
 * summary metafields → notify (Resend). Email failures never fail the booking;
 * a metaobject failure aborts before any email is sent.
 *
 * The Admin token is `env.PRIVATE_STOREFRONT_API_TOKEN` (an `shpat_…` token) and
 * never leaves this module. NEVER import this file from client code.
 */

const ADMIN_API_VERSION = '2025-01';

export type AppointmentInput = {
  name: string;
  email: string;
  date: string; // YYYY-MM-DD
  productTitle: string;
  productHandle: string;
  productId: string;
  variantInfo: string;
};

export type FieldErrors = Partial<Record<'name' | 'email' | 'date', string>>;

// Trims, collapses whitespace, strips control chars. Not HTML-escaping — these
// values go into GraphQL variables (parameterized) and an HTML email where we
// escape at render time, so store them clean but literal.
function clean(value: unknown, max = 200): string {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, ' ') // drop control chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// ponytail: hand-rolled instead of Zod — three fields, and Zod is only a
// transitive dep here. RFC-lite email + not-in-the-past date is all this needs.
export function parseAppointment(form: FormData): {
  data?: AppointmentInput;
  errors?: FieldErrors;
} {
  const name = clean(form.get('name'), 120);
  const email = clean(form.get('email'), 200).toLowerCase();
  const date = clean(form.get('date'), 10);

  const errors: FieldErrors = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Please enter a valid email address.';

  // Compare calendar dates in UTC — a bare YYYY-MM-DD parses as UTC midnight,
  // so anchor "today" to UTC midnight too and allow same-day bookings.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date) : null;
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  if (!parsed || Number.isNaN(parsed.getTime()))
    errors.date = 'Please choose an appointment date.';
  else if (parsed.getTime() < todayUtc.getTime())
    errors.date = 'Please choose a date that is not in the past.';

  if (Object.keys(errors).length) return {errors};

  return {
    data: {
      name,
      email,
      date,
      productTitle: clean(form.get('productTitle'), 200),
      productHandle: clean(form.get('productHandle'), 200),
      productId: clean(form.get('productId'), 200),
      variantInfo: clean(form.get('variantInfo'), 200),
    },
  };
}

type AdminEnv = {
  PUBLIC_STORE_DOMAIN: string;
  // Preferred: a dedicated Admin API token (Settings → Develop apps). Falls
  // back to PRIVATE_STOREFRONT_API_TOKEN only if the former is unset.
  ADMIN_API_ACCESS_TOKEN?: string;
  PRIVATE_STOREFRONT_API_TOKEN?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  NOTIFY_EMAIL?: string;
};

async function adminGraphql<T = any>(
  env: AdminEnv,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token':
          env.ADMIN_API_ACCESS_TOKEN || env.PRIVATE_STOREFRONT_API_TOKEN || '',
      },
      body: JSON.stringify({query, variables}),
    },
  );
  const json = (await res.json()) as {data?: T; errors?: unknown};
  if (!res.ok || json.errors) {
    throw new Error(
      `Shopify Admin API error: ${JSON.stringify(json.errors ?? res.status)}`,
    );
  }
  return json.data as T;
}

// Return the existing customer id for this email, or create one. customerCreate
// races are avoided by the leading lookup; on the rare create-race Shopify
// returns a TAKEN userError, which we surface as a re-lookup.
async function upsertCustomer(
  env: AdminEnv,
  name: string,
  email: string,
): Promise<string> {
  const found = await adminGraphql<{customers: {nodes: {id: string}[]}}>(
    env,
    `#graphql
      query FindCustomer($q: String!) {
        customers(first: 1, query: $q) { nodes { id } }
      }`,
    {q: `email:${email}`},
  );
  const existing = found.customers.nodes[0]?.id;
  if (existing) return existing;

  const [firstName, ...rest] = name.split(' ');
  const created = await adminGraphql<{
    customerCreate: {
      customer: {id: string} | null;
      userErrors: {field: string[]; message: string}[];
    };
  }>(
    env,
    `#graphql
      mutation CreateCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }`,
    {
      input: {
        firstName,
        lastName: rest.join(' ') || undefined,
        email,
      },
    },
  );

  const id = created.customerCreate.customer?.id;
  if (id) return id;

  // Lost a create race (email now taken): look it up again.
  const taken = created.customerCreate.userErrors.some((e) =>
    /taken/i.test(e.message),
  );
  if (taken) {
    const retry = await adminGraphql<{customers: {nodes: {id: string}[]}}>(
      env,
      `#graphql
        query FindCustomer($q: String!) {
          customers(first: 1, query: $q) { nodes { id } }
        }`,
      {q: `email:${email}`},
    );
    if (retry.customers.nodes[0]?.id) return retry.customers.nodes[0].id;
  }
  throw new Error(
    `customerCreate failed: ${JSON.stringify(created.customerCreate.userErrors)}`,
  );
}

async function createAppointmentEntry(
  env: AdminEnv,
  data: AppointmentInput,
): Promise<string> {
  const result = await adminGraphql<{
    metaobjectCreate: {
      metaobject: {id: string} | null;
      userErrors: {field: string[]; message: string}[];
    };
  }>(
    env,
    `#graphql
      mutation CreateAppointment($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }`,
    {
      metaobject: {
        type: 'jewelry_appointment',
        capabilities: {publishable: {status: 'ACTIVE'}},
        fields: [
          {key: 'customer_name', value: data.name},
          {key: 'customer_email', value: data.email},
          {key: 'product_title', value: data.productTitle},
          {key: 'product_handle', value: data.productHandle},
          {key: 'product_id', value: data.productId},
          {key: 'variant_information', value: data.variantInfo},
          {key: 'appointment_date', value: data.date},
          {key: 'status', value: 'requested'},
        ],
      },
    },
  );

  const id = result.metaobjectCreate.metaobject?.id;
  if (!id)
    throw new Error(
      `metaobjectCreate failed: ${JSON.stringify(result.metaobjectCreate.userErrors)}`,
    );
  return id;
}

// Bump the customer summary metafields. Read-modify-write on the counter isn't
// atomic, but two consultations booked in the same millisecond for one customer
// is not a real concern here.
// ponytail: last-write-wins counter; move to a metafield "add" op only if
// concurrent bookings per customer ever actually collide.
async function updateCustomerSummary(
  env: AdminEnv,
  customerId: string,
  date: string,
): Promise<void> {
  const read = await adminGraphql<{
    customer: {count: {value: string} | null} | null;
  }>(
    env,
    `#graphql
      query CustomerCount($id: ID!) {
        customer(id: $id) {
          count: metafield(namespace: "custom", key: "appointment_count") { value }
        }
      }`,
    {id: customerId},
  );
  const next = (Number(read.customer?.count?.value) || 0) + 1;

  await adminGraphql(
    env,
    `#graphql
      mutation SetSummary($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
    {
      metafields: [
        {
          ownerId: customerId,
          namespace: 'custom',
          key: 'appointment_count',
          type: 'number_integer',
          value: String(next),
        },
        {
          ownerId: customerId,
          namespace: 'custom',
          key: 'last_appointment_date',
          type: 'date',
          value: date,
        },
      ],
    },
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]!,
  );
}

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

async function sendEmail(
  env: AdminEnv,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(`[appointment] RESEND_API_KEY unset — skipped email to ${to}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Gold Custom <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    // Booking already succeeded — log and move on, never throw.
    console.error(`[appointment] Resend to ${to} failed: ${await res.text()}`);
  }
}

function storeEmailShell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#2b2620">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:1px solid #e6ddc9;border-radius:12px;overflow:hidden">
      <tr><td style="background:#1c1a17;padding:24px 32px;text-align:center">
        <span style="color:#d4af6a;font-size:20px;letter-spacing:3px;text-transform:uppercase">Gold Custom</span>
      </td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:normal;color:#1c1a17">${title}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #eee4d2;font-size:12px;color:#8a8175;text-align:center">
        Gold Custom · Fine Jewelry &amp; Watches
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">
    <span style="color:#8a8175">${label}:</span>
    <strong style="color:#1c1a17">${escapeHtml(value)}</strong></p>`;
}

async function notify(env: AdminEnv, data: AppointmentInput): Promise<void> {
  const storeUrl = `https://${
    env.PUBLIC_STORE_DOMAIN.includes('myshopify.com')
      ? 'goldcustom.com'
      : env.PUBLIC_STORE_DOMAIN
  }/products/${data.productHandle}`;
  const when = prettyDate(data.date);
  const code = data.variantInfo || data.productId;

  // Internal alert
  await sendEmail(
    env,
    env.NOTIFY_EMAIL || '2038tabonech@mail.com',
    'New Jewelry Appointment Alert',
    storeEmailShell(
      'New Consultation Request',
      `<p style="margin:0 0 20px;font-size:15px;color:#4a463f">A customer has requested a private consultation.</p>
       ${row('Customer', data.name)}
       ${row('Email', data.email)}
       ${row('Appointment', when)}
       ${row('Product', data.productTitle)}
       ${row('Product code', code)}
       <p style="margin:18px 0 0"><a href="${escapeHtml(storeUrl)}" style="color:#b6893f">View product &rarr;</a></p>`,
    ),
  );

  // Customer confirmation
  await sendEmail(
    env,
    data.email,
    'Your Gold Custom Consultation Request',
    storeEmailShell(
      `Thank you, ${escapeHtml(data.name.split(' ')[0])}`,
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a463f">
         We've received your request for a private consultation. One of our jewelry
         specialists will contact you shortly to confirm the details.</p>
       ${row('Piece', data.productTitle)}
       ${row('Requested date', when)}
       <p style="margin:20px 0 0"><a href="${escapeHtml(storeUrl)}" style="color:#b6893f">View this piece &rarr;</a></p>`,
    ),
  );
}

/**
 * Orchestrates a booking. Throws on customer/metaobject failure (caller returns
 * a user-facing error); email is best-effort and never throws out of here.
 */
export async function bookAppointment(
  env: AdminEnv,
  data: AppointmentInput,
): Promise<void> {
  const customerId = await upsertCustomer(env, data.name, data.email);
  await createAppointmentEntry(env, data); // must succeed before emailing
  await updateCustomerSummary(env, customerId, data.date);
  await notify(env, data);
}
