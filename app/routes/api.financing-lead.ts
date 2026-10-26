import type {Route} from './+types/api.financing-lead';
import {customerForLead, parseFinancingLead} from '~/lib/financingLead';
import {
  adminRequest,
  createCustomerRecord,
  saveCustomerMetafields,
} from '~/lib/customer-metafields';

const FAILED = 'Something went wrong. Please try again.';

/**
 * Financing lead — name, phone, budget — captured before the shopper leaves
 * for the lender (components/FinancingLink.tsx).
 *
 * Same pipeline as appointments and custom-jewelry requests, so leads land
 * where the team already looks: a "Customer record" metaobject entry
 * (request_type "Financing"), and the customer's custom.customer_details
 * pointed at it, which is the write that fires the staff Flow notification.
 *
 * The record is written FIRST and is the success condition: it alone is the
 * lead. The customer comes after it (customerForLead): matched by phone, or
 * created phone-only — and created without the phone if Shopify rejects the
 * number, so every lead still shows in Customers and still notifies staff.
 * The call/text box is recorded on the lead and nowhere else — nothing here
 * subscribes the number to marketing.
 */
export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();

  // Honeypot: visually hidden, so people leave it empty and form bots don't.
  if (form.get('website')) return {ok: true as const};

  const parsed = parseFinancingLead(form);
  if (!parsed.ok) return {ok: false as const, errors: parsed.errors};
  const {lead} = parsed;

  try {
    const recordId = await createCustomerRecord(context.env, {
      request_type: 'Financing',
      name: lead.name,
      phone: lead.phone,
      product: lead.product,
      description: [
        `Budget: ${lead.budget}`,
        `Partner: ${lead.partner || '—'}`,
        `OK to call or text: ${lead.consent ? 'Yes' : 'No'}`,
      ].join('\n'),
    });
    if (!recordId) return {ok: false as const, error: FAILED};

    // The lead is safe; linking its customer is 2–4 more Admin calls the
    // shopper shouldn't wait on, so it finishes after the response.
    const linkCustomer = async () => {
      const customerId = await customerForLead(
        (query, variables) => adminRequest(context.env, query, variables),
        lead,
      );
      if (customerId) {
        await saveCustomerMetafields(context.env, customerId, '', {
          customer_details: recordId,
        });
      }
    };
    context.waitUntil?.(
      linkCustomer().catch((error) =>
        console.error('[financing-lead] customer', error),
      ),
    );

    return {ok: true as const};
  } catch (error) {
    console.error('[financing-lead]', error);
    return {ok: false as const, error: FAILED};
  }
}
