/**
 * The financing lead form (components/FinancingLink.tsx → /api/financing-lead).
 *
 * The shopper is a click away from the lender's application, so the form is
 * three things only — name, phone, budget — plus an optional call/text
 * consent. Validated by the same function in the browser (instant field
 * errors, before the lender's tab opens) and on the server, so the two can
 * never disagree about what is acceptable.
 *
 * Plain TS with no app imports, so `node app/lib/financingLead.test.ts` runs it.
 */

/** Total budget, not monthly: Acima and Progressive are lease-to-own. */
export const BUDGETS = [
  {label: 'Under $500', below: 500},
  {label: '$500–$1,000', below: 1000},
  {label: '$1,000–$2,500', below: 2500},
  {label: '$2,500–$5,000', below: 5000},
  {label: '$5,000+', below: Infinity},
] as const;

/** The band the piece's own price sits in — the form's starting choice. */
export function budgetForPrice(price?: number | null) {
  if (!(Number(price) > 0)) return undefined;
  return BUDGETS.find((budget) => Number(price) < budget.below)!.label;
}

/**
 * US numbers to E.164 ("(555) 123-4567" → "+15551234567"), which is what
 * Shopify stores and matches customers on. Anything with an explicit country
 * code is kept as typed. Null when it can't be a phone number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** On every lead's customer, new or returning — one filter in Customers. */
export const LEAD_TAG = 'financing-lead';

type AdminRequest = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<{data?: any; errors?: unknown}>;

/**
 * The Shopify customer a lead belongs to, so it shows in Customers and its
 * record can be linked (the link is what notifies staff).
 *
 *  - Someone with this number already: that customer, tagged.
 *  - Otherwise a new phone-only customer.
 *  - Shopify checks numbers against real area codes, which the form can't
 *    ("+1 545 …" → "Phone is invalid"). Then the customer is created WITHOUT
 *    the phone, with the number as typed in the note — a mistyped number must
 *    not make a lead invisible.
 */
export async function customerForLead(
  request: AdminRequest,
  lead: {name: string; phone: string},
): Promise<string | undefined> {
  const found = await request(CUSTOMER_BY_PHONE_QUERY, {
    query: `phone:${lead.phone}`,
  });
  const existing: string | undefined = found.data?.customers?.nodes?.[0]?.id;
  if (existing) {
    await request(TAGS_ADD_MUTATION, {id: existing, tags: [LEAD_TAG]});
    return existing;
  }

  const [firstName, ...rest] = lead.name.split(' ');
  const base = {
    firstName,
    lastName: rest.join(' ') || undefined,
    tags: [LEAD_TAG],
  };
  const create = async (input: Record<string, unknown>) => {
    const result = await request(CUSTOMER_CREATE_MUTATION, {input});
    const payload = result.data?.customerCreate;
    const failure = payload?.userErrors?.[0];
    if (failure) {
      console.error(
        '[financing-lead] customerCreate:',
        JSON.stringify(failure),
      );
    }
    return {
      id: payload?.customer?.id as string | undefined,
      phoneRejected: Boolean(failure?.field?.includes('phone')),
    };
  };

  const withPhone = await create({...base, phone: lead.phone});
  if (withPhone.id || !withPhone.phoneRejected) return withPhone.id;
  // ponytail: a "taken" phone the search index hasn't caught up with also
  // lands here as a second, phone-less customer; merge in admin if it happens.
  return (
    await create({
      ...base,
      note: `Financing lead. Phone as entered, which Shopify rejected as invalid: ${lead.phone}`,
    })
  ).id;
}

// Admin API, so untagged: Storefront codegen must not validate these.
const CUSTOMER_BY_PHONE_QUERY = `
  query FinancingLeadCustomer($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
      }
    }
  }
`;

const TAGS_ADD_MUTATION = `
  mutation FinancingLeadTag($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors {
        field
        message
      }
    }
  }
`;

const CUSTOMER_CREATE_MUTATION = `
  mutation FinancingLeadCustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export type FinancingLead = {
  name: string;
  phone: string;
  budget: string;
  consent: boolean;
  partner: string;
  product: string;
};

export function parseFinancingLead(
  form: FormData,
):
  | {ok: true; lead: FinancingLead}
  | {ok: false; errors: Record<string, string>} {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const name = text('name').replace(/\s+/g, ' ').slice(0, 80);
  const phone = normalizePhone(text('phone'));
  const budget = text('budget');

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Please enter your name.';
  if (!phone) errors.phone = 'Please enter a 10-digit phone number.';
  if (!BUDGETS.some((option) => option.label === budget)) {
    errors.budget = 'Please choose a budget.';
  }
  if (Object.keys(errors).length) return {ok: false, errors};

  return {
    ok: true,
    lead: {
      name,
      phone: phone!,
      budget,
      consent: form.get('consent') === 'on',
      partner: text('partner').slice(0, 60),
      product: text('product').slice(0, 300),
    },
  };
}
