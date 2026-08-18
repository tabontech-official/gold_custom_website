import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {Breadcrumb} from '~/components/Breadcrumb';
import {cdnLoader} from '~/lib/cdnImage';
import type {Route} from './+types/repairs';
import {AppointmentModal} from '~/components/AppointmentModal';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Jewelry Repair',
    description: `Ring sizing, chain and clasp soldering, stone setting, rhodium plating and restoration — repaired on site at ${SITE.name} in downtown Los Angeles. Free estimates.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/repairs'),
  });

/* Hero photograph, from the store's Shopify Files. Dimensions are the
   original's — Hydrogen's <Image> needs them to reserve the box and to
   build the srcSet, and the CDN serves the resized copies. */
const HERO_IMAGE = {
  url: 'https://cdn.shopify.com/s/files/1/0806/9568/9464/files/ChatGPT_Image_Aug_18_2026_05_18_20_PM.png?v=1787055527',
  width: 1254,
  height: 1254,
  altText: 'Jewelry repair work at the Gold Custom bench',
};

/**
 * Turnaround is the number customers actually call about, so it is a column,
 * not a footnote. Prices are deliberately absent — every repair is quoted
 * after inspection and a published price we cannot honour is worse than none.
 */
const SERVICES = [
  {
    group: 'Rings',
    items: [
      {name: 'Sizing up or down', turnaround: '1–3 days'},
      {name: 'Prong retipping and rebuilding', turnaround: '3–5 days'},
      {name: 'Shank replacement', turnaround: '5–7 days'},
      {name: 'Stone tightening and replacement', turnaround: '2–5 days'},
    ],
  },
  {
    group: 'Chains & bracelets',
    items: [
      {name: 'Solder a broken link', turnaround: 'Same day'},
      {name: 'Clasp or lobster replacement', turnaround: '1–2 days'},
      {name: 'Shorten or lengthen', turnaround: '1–3 days'},
      {name: 'Laser welding on hollow pieces', turnaround: '1–3 days'},
    ],
  },
  {
    group: 'Finishing & restoration',
    items: [
      {name: 'Polish, refinish and steam clean', turnaround: 'Same day'},
      {name: 'Rhodium plating on white gold', turnaround: '2–3 days'},
      {name: 'Hand or laser engraving', turnaround: '2–4 days'},
      {name: 'Antique and heirloom restoration', turnaround: 'Quoted'},
    ],
  },
  {
    group: 'Watches & pearls',
    items: [
      {name: 'Battery replacement', turnaround: 'Same day'},
      {name: 'Band sizing and link removal', turnaround: 'Same day'},
      {name: 'Pearl and bead restringing', turnaround: '3–5 days'},
      {name: 'Crystal replacement', turnaround: 'Quoted'},
    ],
  },
];

const STEPS = [
  {
    title: 'Bring it in or mail it',
    body: 'Walk into the showroom during business hours, or ship it insured to the address below. No appointment needed for a repair drop-off.',
  },
  {
    title: 'Free inspection and quote',
    body: 'A jeweler examines the piece under magnification, photographs its condition, and calls or texts you a firm price before touching it.',
  },
  {
    title: 'You approve, we work',
    body: 'Nothing happens until you say yes. Your stones stay in the piece and never leave the building.',
  },
  {
    title: 'Pickup or insured return',
    body: 'Collect it at the counter, or we ship it back insured and signature-required at no extra charge on repairs over $250.',
  },
];

const FAQS = [
  {
    q: 'How much will my repair cost?',
    a: 'Estimates are free and given after inspection. Simple work like a solder or a battery is quoted at the counter; anything structural is quoted within one business day.',
  },
  {
    q: 'Do you repair jewelry you did not sell?',
    a: 'Yes. Most of what comes across the bench was bought elsewhere, including inherited and antique pieces.',
  },
  {
    q: 'Will my stones be swapped?',
    a: 'No. Every piece is photographed and its stones plotted at intake, and you can watch the work through the counter if you would rather not leave it.',
  },
  {
    q: 'Is the repair guaranteed?',
    a: 'Workmanship is warrantied for six months. If a solder or setting we performed fails in normal wear, bring it back and we redo it at no charge.',
  },
];

export default function Repairs() {
  return (
    <main className="svc-page">
      <div className="section-inner svc-crumb">
        <Breadcrumb
          items={[{label: 'Home', to: '/'}, {label: 'Jewelry Repair'}]}
        />
      </div>
      <section className="svc-hero">
        <div className="section-inner svc-hero-inner">
          <div className="svc-hero-content">
            <p className="svc-kicker">Jewelry repair · Downtown Los Angeles</p>
            <h1>Wearable again by Friday.</h1>
            <p className="svc-hero-lede">
              Sizing, soldering, setting, plating and restoration, done on our
              own bench. Bring the piece in and you get a free estimate before
              anyone picks up a torch.
            </p>
            <div className="svc-actions">
              <a className="btn btn-primary svc-cta" href="tel:+13236888837">
                Call for an estimate
              </a>
              <Link className="btn svc-cta svc-cta-ghost" to="/showroom">
                Drop-off hours and location
              </Link>
            </div>
            <ul className="svc-facts">
              <li>
                <strong>Free</strong>
                <span>Inspection and quote</span>
              </li>
              <li>
                <strong>In-house</strong>
                <span>Your stones never leave</span>
              </li>
              <li>
                <strong>6 months</strong>
                <span>Workmanship warranty</span>
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
        <div className="svc-section-head">
          <p className="svc-kicker">What we repair</p>
          <h2>Most work leaves the bench in under a week.</h2>
        </div>
        <div className="svc-repair-groups">
          {SERVICES.map((group) => (
            <div className="svc-repair-group" key={group.group}>
              <h3>{group.group}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    <span className="svc-chip">{item.turnaround}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="svc-note">
          Turnaround starts when you approve the quote. Rush service is
          available on most repairs — ask at drop-off.
        </p>
      </section>

      <section className="svc-process">
        <div className="section-inner">
          <div className="svc-section-head">
            <p className="svc-kicker">How it works</p>
            <h2>Four steps, no surprises.</h2>
          </div>
          <ol className="svc-steps">
            {STEPS.map((step, i) => (
              <li className="svc-step" key={step.title}>
                <span className="svc-step-num">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="svc-step-body">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-inner svc-section">
        <div className="svc-split">
          <div>
            <p className="svc-kicker">Mail-in repair</p>
            <h2>Not in Los Angeles?</h2>
            <p className="svc-body">
              Ship the piece to us insured for its replacement value. Include
              your name, phone number and a note describing what needs fixing,
              and we will text you a quote the day it arrives.
            </p>
            <a className="svc-inline-link" href="mailto:mr10k@goldcustom.com">
              Email us before you ship <span aria-hidden="true">↗</span>
            </a>
          </div>
          <address className="svc-address">
            <strong>Gold Custom — Repairs</strong>
            550 S Hill St #660
            <br />
            Los Angeles, CA 90013
            <br />
            <a href="tel:+13236888837">+1 (323) 688-8837</a>
          </address>
        </div>
      </section>

      <section className="section-inner svc-section">
        <div className="svc-section-head">
          <p className="svc-kicker">Questions</p>
          <h2>What people ask at the counter.</h2>
        </div>
        <div className="svc-faq">
          {FAQS.map((faq) => (
            <details className="svc-faq-item" key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="svc-band">
        <div className="section-inner">
          <h2>Bring in the piece you stopped wearing.</h2>
          <p>
            Walk in during business hours, or book a time so a jeweler is
            waiting for you.
          </p>
          <div className="svc-actions">
            <AppointmentModal
              triggerLabel="Book a repair drop-off"
              triggerClassName="btn btn-primary svc-cta"
            />
            <Link className="btn svc-cta svc-cta-ghost" to="/custom-jewelry">
              Beyond repair? Redesign it
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
