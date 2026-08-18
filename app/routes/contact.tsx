import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {Breadcrumb} from '~/components/Breadcrumb';
import {cdnLoader} from '~/lib/cdnImage';
import type {Route} from './+types/contact';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Contact Us',
    description: `Reach the ${SITE.name} team about an order, a return, sizing or a repair in progress. Call, email, or find the answer yourself.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/contact'),
  });

/* Hero photograph, from the store's Shopify Files. Dimensions are the
   original's — Hydrogen's <Image> needs them to reserve the box and to
   build the srcSet, and the CDN serves the resized copies. */
const HERO_IMAGE = {
  url: 'https://cdn.shopify.com/s/files/1/0806/9568/9464/files/contact.png?v=1787056671',
  width: 1254,
  height: 1254,
  altText: 'The Gold Custom concierge team',
};

/* Address, hours and the map live on /showroom — this page is reach-us only.
   Two pages publishing the same NAP compete for the same query and double the
   places an address change has to be made. Link, don't duplicate. */
const SELF_SERVE = [
  {
    to: '/account/orders',
    label: 'Where is my order?',
    body: 'Track a shipment and see every order on your account.',
  },
  {
    to: '/policies/refund-policy',
    label: 'Returns and exchanges',
    body: '14 days to return an unworn piece. Custom orders are final sale.',
  },
  {
    to: '/policies/shipping-policy',
    label: 'Shipping and delivery',
    body: 'Free insured US shipping over $99, signature required on arrival.',
  },
  {
    to: '/repairs',
    label: 'Repair in progress',
    body: 'Turnaround times by service, and how to check on a piece at the bench.',
  },
];

export default function Contact() {
  return (
    <main className="contact-page">
      <div className="section-inner svc-crumb">
        <Breadcrumb items={[{label: 'Home', to: '/'}, {label: 'Contact Us'}]} />
      </div>
      <section className="contact-hero">
        <div className="section-inner svc-hero-inner">
          <div className="svc-hero-content">
            <p className="contact-kicker">Gold Custom concierge</p>
            <h1>Talk to a person.</h1>
            <p>
              Questions about an order, a return, sizing or a repair on the
              bench. Our Los Angeles team answers calls and email Monday through
              Saturday.
            </p>
          </div>

          <div className="svc-hero-media">
            <Image
              loader={cdnLoader}
              data={HERO_IMAGE}
              sizes="(min-width: 60em) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      <section className="contact-content section-inner">
        <div className="contact-details">
          <div className="contact-details-heading">
            <p className="contact-kicker">Reach us directly</p>
            <h2>We&apos;re at your service.</h2>
          </div>

          <div className="contact-cards">
            <a className="contact-card" href="tel:+13236888837">
              <span className="contact-card-label">Call us</span>
              <strong>+1 (323) 688-8837</strong>
              <span>Fastest for anything time-sensitive</span>
            </a>
            <a className="contact-card" href="mailto:mr10k@goldcustom.com">
              <span className="contact-card-label">Email us</span>
              <strong>mr10k@goldcustom.com</strong>
              <span>
                Replies within one business day. Include your order number.
              </span>
            </a>
          </div>

          <p className="contact-visit-note">
            Coming to see us? The showroom&apos;s hours, directions and parking
            are on the <Link to="/showroom">showroom page</Link>.
          </p>

          <Link className="contact-home-link" to="/collections/all">
            Explore the collection
          </Link>
        </div>

        <div className="contact-help">
          <p className="contact-kicker">Answer it yourself</p>
          <h2 className="contact-help-title">
            Most-asked, already written down.
          </h2>
          <ul className="contact-help-list">
            {SELF_SERVE.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>
                  <strong>{item.label}</strong>
                  <span>{item.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
