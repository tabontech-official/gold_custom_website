import type {Route} from './+types/api.data-sale-opt-out';

/**
 * Account-level data-sale opt-out, the "Don't share data from my account"
 * checkbox on /pages/data-sharing-opt-out. Browser-level consent is handled
 * client-side by the Customer Privacy API; opting out the customer RECORD is
 * only possible through the Admin API's dataSaleOptOut mutation, which is why
 * this needs PRIVATE_ADMIN_API_TOKEN (custom app, write_customers scope)
 * while the rest of the storefront runs on Storefront API tokens.
 *
 * Shopify resolves the email to a customer itself — an unknown email comes
 * back as a userError, which we pass through to the visitor.
 */
export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {error: 'Please enter a valid email address.'};
  }

  const token = context.env.PRIVATE_ADMIN_API_TOKEN;
  if (!token) {
    console.error(
      'PRIVATE_ADMIN_API_TOKEN is not set — account-level opt-out is disabled.',
    );
    return {
      error:
        'Account opt-out is temporarily unavailable. Please email mr10k@goldcustom.com instead.',
    };
  }

  try {
    const response = await fetch(
      `https://${context.env.PUBLIC_STORE_DOMAIN}/admin/api/2026-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({
          query: DATA_SALE_OPT_OUT_MUTATION,
          variables: {email},
        }),
      },
    );

    const json = (await response.json()) as {
      data?: {
        dataSaleOptOut?: {
          customerId?: string | null;
          userErrors?: Array<{message: string}>;
        };
      };
      errors?: Array<{message: string}>;
    };

    const userError =
      json.data?.dataSaleOptOut?.userErrors?.[0] ?? json.errors?.[0];
    if (userError) {
      return {error: userError.message};
    }

    return {success: true};
  } catch (error) {
    console.error(error);
    return {error: 'Something went wrong. Please try again.'};
  }
}

const DATA_SALE_OPT_OUT_MUTATION = `#graphql
  mutation DataSaleOptOut($email: String!) {
    dataSaleOptOut(email: $email) {
      customerId
      userErrors {
        field
        message
      }
    }
  }
`;
