import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {Breadcrumb} from '~/components/Breadcrumb';
import {cdnLoader} from '~/lib/cdnImage';
import type {Route} from './+types/showroom';
import {AppointmentModal} from '~/components/AppointmentModal';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Showroom',
    description: `Visit the ${SITE.name} showroom at 550 S Hill St #660 in the Los Angeles Jewelry District. Try on chains, rings and custom pieces, or book a private appointment.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/showroom'),
  });

/* Hero photograph, from the store's Shopify Files. Dimensions are the
   original's — Hydrogen's <Image> needs them to reserve the box and to
   build the srcSet, and the CDN serves the resized copies. */
const HERO_IMAGE = {
  url: 'https://cdn.shopify.com/s/files/1/0806/9568/9464/files/gold-custom-showroom-hill-street-la_webp.png?v=1783323755',
  width: 1264,
  height: 848,
  altText: 'The Gold Custom showroom on Hill Street, downtown Los Angeles',
};

/* These must stay in step with `openingHoursSpecification` in app/lib/seo.ts —
   Google matches the markup against what the page says, and hours that
   disagree with the Business Profile read as a stale listing. Change both. */
const HOURS = [
  {day: 'Monday – Saturday', time: '12:00pm – 5:00pm'},
  {day: 'Sunday', time: 'Closed'},
  {day: 'Outside those hours', time: 'By appointment'},
];

const COUNTER = [
  {to: '/collections/all', title: 'Shop the collection', action: 'Browse'},
  {to: '/custom-jewelry', title: 'Custom jewelry', action: 'See the process'},
  {to: '/repairs', title: 'Repairs', action: 'Repair services'},
];

const EXPECT = [
  {
    title: 'Try the weight on',
    body: 'A 10mm Cuban link reads differently in a photo than it does on your neck. Everything in the case can come out and go on.',
  },
  {
    title: 'Loupe anything',
    body: 'Ask for the scope. We will show you the setting, the stone, the stamp and the solder joints on any piece you are considering.',
  },
  {
    title: 'Sizing on the spot',
    body: 'Ring and bracelet sizing is measured at the counter, and most sizing on pieces you buy from us is done free within 60 days.',
  },
  {
    title: 'Start a custom order',
    body: 'Bring a reference photo and leave with a written estimate and a CAD appointment on the calendar.',
  },
];

export default function Showroom() {
  return (
    <main className="svc-page">
      <div className="section-inner svc-crumb">
        <Breadcrumb items={[{label: 'Home', to: '/'}, {label: 'Showroom'}]} />
      </div>
      <section className="svc-hero">
        <div className="section-inner svc-hero-inner">
          <div className="svc-hero-content">
            <p className="svc-kicker">Showroom · Jewelry District</p>
            <h1>See it in person.</h1>
            <p className="svc-hero-lede">
              Suite 660, six floors above Hill Street in downtown Los Angeles.
              Walk in during business hours, or book the room to yourself.
            </p>
            <div className="svc-actions">
              <AppointmentModal
                triggerLabel="Book a private appointment"
                triggerClassName="btn btn-primary svc-cta"
              />
              <a
                className="btn svc-cta svc-cta-ghost"
                href="https://maps.app.goo.gl/252CwsjSZfhSae4B6"
                target="_blank"
                rel="noreferrer"
              >
                Get directions
              </a>
            </div>
            <ul className="svc-facts">
              <li>
                <strong>550 S Hill St #660</strong>
                <span>Los Angeles, CA 90013</span>
              </li>
              <li>
                <strong>Mon–Sat, 12–5</strong>
                <span>Walk-ins welcome</span>
              </li>
              <li>
                <strong>Private room</strong>
                <span>Available by appointment</span>
              </li>
            </ul>
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

      <section className="section-inner svc-section">
        <div className="svc-split">
          <div>
            <p className="svc-kicker">Visit</p>
            <h2>Hours and directions.</h2>
            <dl className="svc-hours">
              {HOURS.map((row) => (
                <div key={row.day}>
                  <dt>{row.day}</dt>
                  <dd>{row.time}</dd>
                </div>
              ))}
            </dl>
            <p className="svc-body">
              We are inside the jewelry building on the corner of 6th and Hill.
              Take the elevators to the sixth floor and turn right. Metered
              street parking and several pay lots sit within a block, and
              Pershing Square station is a four-minute walk.
            </p>
            <div className="svc-actions svc-actions-tight">
              <a className="btn btn-primary svc-cta" href="tel:+13236888837">
                +1 (323) 688-8837
              </a>
              <a
                className="btn svc-cta svc-cta-dark"
                href="mailto:mr10k@goldcustom.com"
              >
                mr10k@goldcustom.com
              </a>
            </div>
          </div>
          <div className="svc-map-wrap">
            <iframe
              className="svc-map"
              title="Gold Custom showroom at 550 S Hill Street, Los Angeles"
              src="https://www.google.com/maps?q=550%20S%20Hill%20St%20%23660%2C%20Los%20Angeles%2C%20CA%2090013&z=16&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              className="svc-map-caption"
              href="https://maps.app.goo.gl/252CwsjSZfhSae4B6"
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <section className="svc-process">
        <div className="section-inner">
          <div className="svc-section-head">
            <p className="svc-kicker">What to expect</p>
            <h2>No pressure, no velvet rope.</h2>
          </div>
          <div className="svc-grid">
            {EXPECT.map((item) => (
              <article className="svc-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-inner svc-section">
        <div className="svc-section-head">
          <p className="svc-kicker">At the counter</p>
          <h2>Everything we do, in one room.</h2>
        </div>
        <div className="svc-nav-grid">
          {COUNTER.map((item, i) => (
            <Link className="svc-nav-card" key={item.to} to={item.to}>
              <span className="svc-nav-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="svc-nav-title">{item.title}</span>
              <span className="svc-nav-action">
                {item.action} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="svc-band">
        <div className="section-inner">
          <h2>Come see it on.</h2>
          <p>
            Book a private appointment and we will have the pieces you are
            interested in out of the case and waiting.
          </p>
          <div className="svc-actions">
            <AppointmentModal
              triggerLabel="Book an appointment"
              triggerClassName="btn btn-primary svc-cta"
            />
            <Link className="btn svc-cta svc-cta-ghost" to="/contact">
              Contact the concierge
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
