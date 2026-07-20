import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/account';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

export function shouldRevalidate() {
  return true;
}

export async function loader({context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();

  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}`
      : `Welcome to your account.`
    : 'Account Details';

  return (
    <div className="account account-page">
      <section className="account-hero">
        <div>
          <p className="account-kicker">Gold Custom Club</p>
          <h1>{heading}</h1>
          <p className="account-email">Your private account</p>
        </div>
        <p className="account-hero-copy">
          Manage your orders, details, and delivery addresses in one place.
        </p>
      </section>
      <AccountMenu />
      <main className="account-content">
        <Outlet context={{customer}} />
      </main>
    </div>
  );
}

function AccountMenu() {
  function navClassName({isActive}: {isActive: boolean}) {
    return isActive ? 'account-nav-link is-active' : 'account-nav-link';
  }

  return (
    <nav className="account-nav" aria-label="Account navigation">
      <NavLink to="/account/orders" className={navClassName}>
        Orders
      </NavLink>
      <NavLink to="/account/profile" className={navClassName}>
        Profile
      </NavLink>
      <NavLink to="/account/addresses" className={navClassName}>
        Addresses
      </NavLink>
      <Logout />
    </nav>
  );
}

function Logout() {
  return (
    <Form className="account-logout" method="POST" action="/account/logout">
      <button type="submit">Sign out</button>
    </Form>
  );
}
