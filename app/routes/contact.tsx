import {Link} from 'react-router';
import type {Route} from './+types/contact';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Contact Us',
    description: `Get in touch with the ${SITE.name} concierge about orders, custom pieces, sizing and repairs.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/contact'),
  });

export default function Contact() {
  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="section-inner">
          <p className="contact-kicker">Gold Custom concierge</p>
          <h1>Let&apos;s make it personal.</h1>
          <p>
            Questions about a piece, an order, or a custom design? Our Los
            Angeles team is here to help.
          </p>
        </div>
      </section>

      <section className="contact-content section-inner">
        <div className="contact-details">
          <div className="contact-details-heading">
            <p className="contact-kicker">Connect with us</p>
            <h2>We&apos;re at your service.</h2>
          </div>

          <div className="contact-cards">
            <a className="contact-card" href="tel:+13236888837">
              <span className="contact-card-label">Call us</span>
              <strong>+1 (323) 688-8837</strong>
              <span>Speak with our jewelry concierge</span>
            </a>
            <a className="contact-card" href="mailto:mr10k@goldcustom.com">
              <span className="contact-card-label">Email us</span>
              <strong>mr10k@goldcustom.com</strong>
              <span>We&apos;ll reply as soon as possible</span>
            </a>
            <a
              className="contact-card"
              href="https://maps.app.goo.gl/252CwsjSZfhSae4B6"
              target="_blank"
              rel="noreferrer"
            >
              <span className="contact-card-label">Visit us</span>
              <strong>550 S Hill St #660</strong>
              <span>Los Angeles, CA 90013 · By appointment</span>
            </a>
          </div>

          <Link className="contact-home-link" to="/collections/all">
            Explore the collection
          </Link>
        </div>

        <div className="contact-map-wrap">
          <iframe
            className="contact-map"
            title="Gold Custom location at 550 S Hill Street, Los Angeles"
            src="https://www.google.com/maps?q=550%20S%20Hill%20St%20%23660%2C%20Los%20Angeles%2C%20CA%2090013&z=16&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            className="contact-map-caption"
            href="https://maps.app.goo.gl/252CwsjSZfhSae4B6"
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </main>
  );
}
