import type {Route} from './+types/api.subscribe';

/**
 * Newsletter signup. Used by the welcome popup and the footer form.
 *
 * Sends no email — `customerCreate` activates the account, and Shopify's own
 * "Customer account welcome" notification carries the discount code. Nothing
 * here needs to know what that code is.
 *
 * Edit the email at: Shopify Admin -> Settings -> Notifications ->
 * Customer account welcome.
 */
export async function action({request, context}: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {error: 'Please enter a valid email address.'};
  }

  try {
    // Creates a real customer account, not a mailing-list row — the Storefront
    // API has no subscribe-only mutation. That account activation is also what
    // triggers the welcome email.
    const {customerCreate} = await context.storefront.mutate(
      SUBSCRIBE_MUTATION,
      {
        variables: {
          input: {
            email,
            // ponytail: throwaway password — this store uses passwordless
            // customer accounts; the record only carries marketing consent.
            password: crypto.randomUUID(),
            acceptsMarketing: true,
          },
        },
      },
    );

    const error = customerCreate?.customerUserErrors?.[0];
    // TAKEN = customer already exists, which means they're already on file.
    if (error && error.code !== 'TAKEN') {
      return {error: error.message};
    }

    // `email` echoed back so the popup can say where it went — the fetcher's
    // own formData is cleared by then. See WelcomePopup.
    return {success: true, email};
  } catch (error) {
    console.error(error);
    return {error: 'Something went wrong. Please try again.'};
  }
}

const SUBSCRIBE_MUTATION = `#graphql
  mutation NewsletterSubscribe($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      customerUserErrors {
        code
        message
      }
    }
  }
` as const;
