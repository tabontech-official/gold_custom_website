import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {Breadcrumb} from '~/components/Breadcrumb';
import {cdnLoader} from '~/lib/cdnImage';
import type {Route} from './+types/custom-jewelry';
import {AppointmentModal} from '~/components/AppointmentModal';
import {CustomJewelryModal} from '~/components/CustomJewelryModal';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Custom Jewelry',
    description: `Design a one-of-a-kind piece with ${SITE.name}. Free consultation, 3D CAD preview before we cast, made in 10K, 14K or 18K gold in downtown Los Angeles.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/custom-jewelry'),
  });

/* Hero photograph, from the store's Shopify Files. Dimensions are the
   original's — Hydrogen's <Image> needs them to reserve the box and to
   build the srcSet, and the CDN serves the resized copies. */
const HERO_IMAGE = {
  url: 'https://cdn.shopify.com/s/files/1/0806/9568/9464/files/custom-gold-jewelry-crafting-process_webp.png?v=1783324139',
  width: 2528,
  height: 1696,
  altText: 'A custom gold ring being crafted at the bench',
};

const STEPS = [
  {
    title: 'Consultation',
    body: 'Bring a photo, a sketch, or just an idea. We talk through metal, stones, weight and budget, and you leave with a written estimate.',
    meta: 'Day 1 · free',
  },
  {
    title: 'CAD design',
    body: 'Our designer models the piece in 3D. You see it from every angle and request changes until it is right — nothing is cast before you approve.',
    meta: 'Days 2–5',
  },
  {
    title: 'Casting',
    body: 'The approved model is grown in wax and cast in your chosen karat gold, then filed and pre-polished by hand.',
    meta: 'Days 6–12',
  },
  {
    title: 'Stone setting',
    body: 'Our setter places every stone by hand under the scope — prong, bezel, pavé or flooded, depending on the design.',
    meta: 'Days 13–18',
  },
  {
    title: 'Final polish & delivery',
    body: 'High polish, final QC against the CAD, appraisal paperwork, and pickup at the showroom or insured shipping to your door.',
    meta: 'Days 19–21',
  },
];

const MAKES = [
  {
    title: 'Engagement & wedding rings',
    body: 'Solitaires, halos, three-stone and matching bands. Natural or lab-grown center stones, sourced to your specs.',
  },
  {
    title: 'Cuban links & chains',
    body: 'Solid or hollow, 6mm to 25mm, in 10K or 14K. Cut to the exact length and gram weight you want.',
  },
  {
    title: 'Pendants & charms',
    body: 'Portrait pendants, initials, religious pieces and logos — built from your artwork or ours.',
  },
  {
    title: 'Nameplates & bar pieces',
    body: 'Any script, any language, cut from solid gold, with optional diamond flooding.',
  },
  {
    title: 'Bracelets & tennis chains',
    body: 'Matched stone sizes end to end, with a box clasp and double safety on every piece.',
  },
];

const FAQS = [
  {
    q: 'How much does a custom piece cost?',
    a: 'It depends on gram weight, karat and stones — a custom pendant can start around $600, while a diamond-set Cuban link runs into five figures. You get a firm written quote at the consultation, before any work starts.',
  },
  {
    q: 'How long does it take?',
    a: 'Most pieces are finished two to four weeks after CAD approval. Tell us your date at the consultation and we will confirm whether we can meet it before you pay a deposit.',
  },
  {
    q: 'Do I have to pay everything upfront?',
    a: 'No. A 50% deposit starts the work and the balance is due at pickup. Financing through our partners is available on custom orders as well.',
  },
  {
    q: 'Can I use my own gold or stones?',
    a: 'Yes. We weigh and test your gold in front of you and credit it against the order. Loose stones are inspected and measured before we design around them.',
  },
];

export default function CustomJewelry() {
  return (
    <main className="svc-page">
      <div className="section-inner svc-crumb">
        <Breadcrumb
          items={[{label: 'Home', to: '/'}, {label: 'Custom Jewelry'}]}
        />
      </div>
      <section className="svc-hero">
        <div className="section-inner svc-hero-inner">
          <div className="svc-hero-content">
            <p className="svc-kicker">Custom jewelry · Los Angeles</p>
            <h1>Made once. For you.</h1>
            <p className="svc-hero-lede">
              Every custom order starts as a conversation and ends as a piece
              that exists exactly once. You approve a 3D render before we cast a
              single gram of gold.
            </p>
            <div className="svc-actions">
              <CustomJewelryModal
                triggerLabel="Start your design"
                triggerClassName="btn btn-primary svc-cta"
              />
              <a className="btn svc-cta svc-cta-ghost" href="tel:+13236888837">
                Call +1 (323) 688-8837
              </a>
            </div>
            <ul className="svc-facts">
              <li>
                <strong>2–4 weeks</strong>
                <span>Typical turnaround</span>
              </li>
              <li>
                <strong>10K · 14K · 18K</strong>
                <span>Solid gold, never plated</span>
              </li>
              <li>
                <strong>Free</strong>
                <span>Consultation and quote</span>
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
          <p className="svc-kicker">What we make</p>
          <h2>If you can describe it, we can build it.</h2>
        </div>
        <div className="svc-grid">
          {MAKES.map((item) => (
            <article className="svc-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* The numbering is real: these stages run in this order and the
          customer's approval gate sits between 02 and 03. */}
      <section className="svc-process">
        <div className="section-inner">
          <div className="svc-section-head">
            <p className="svc-kicker">The process</p>
            <h2>Five stages, one approval gate.</h2>
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
                  <span className="svc-step-meta">{step.meta}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-inner svc-section">
        <div className="svc-split">
          <div>
            <p className="svc-kicker">Materials</p>
            <h2>What goes into the piece.</h2>
            <p className="svc-body">
              We buy stones to order, so you are not paying for inventory
              sitting in a case. Every diamond over 0.50ct arrives with its own
              certificate, and every finished piece leaves with an appraisal for
              your insurer.
            </p>
            <Link className="svc-inline-link" to="/policies/finance">
              Financing and payment plans <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <dl className="svc-specs">
            <div>
              <dt>Metals</dt>
              <dd>
                10K, 14K and 18K in yellow, white or rose. Platinum on request.
              </dd>
            </div>
            <div>
              <dt>Diamonds</dt>
              <dd>Natural and lab-grown, VS–SI, certified over 0.50ct.</dd>
            </div>
            <div>
              <dt>Colored stones</dt>
              <dd>Sapphire, ruby, emerald and moissanite, matched by hand.</dd>
            </div>
            <div>
              <dt>Deposit</dt>
              <dd>50% to begin, balance at pickup.</dd>
            </div>
            <div>
              <dt>Warranty</dt>
              <dd>One year on workmanship, free sizing within 60 days.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section-inner svc-section">
        <div className="svc-section-head">
          <p className="svc-kicker">Questions</p>
          <h2>Before you book.</h2>
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
          <h2>Bring us the idea.</h2>
          <p>
            Consultations are free and take about thirty minutes, in person at
            our downtown showroom or over video.
          </p>
          <div className="svc-actions">
            <AppointmentModal
              triggerLabel="Book a consultation"
              triggerClassName="btn btn-primary svc-cta"
            />
            <Link className="btn svc-cta svc-cta-ghost" to="/showroom">
              Visit the showroom
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
