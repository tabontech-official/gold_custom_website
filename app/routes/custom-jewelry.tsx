import {useState} from 'react';
import {Image} from '@shopify/hydrogen';
import {Breadcrumb} from '~/components/Breadcrumb';
import {cdnLoader} from '~/lib/cdnImage';
import type {Route} from './+types/custom-jewelry';
import {CustomDesignBuilder} from '~/components/CustomDesignBuilder';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';
import customDesignStyles from '~/styles/custom-design.css?url';

export const links: Route.LinksFunction = () => [
  {rel: 'stylesheet', href: customDesignStyles},
];

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

/**
 * Two states, one at a time: the welcome hero (photo + pitch + "Start your
 * design"), or the builder alone with the whole width to itself.
 */
export default function CustomJewelry() {
  const [started, setStarted] = useState(false);

  return (
    <main className="svc-page">
      <div className="section-inner svc-crumb">
        <Breadcrumb
          items={[{label: 'Home', to: '/'}, {label: 'Custom Jewelry'}]}
        />
      </div>

      {started ? (
        <CustomDesignBuilder />
      ) : (
        <section className="svc-hero">
          <div className="section-inner svc-hero-inner">
            <div className="svc-hero-content">
              <p className="svc-kicker">Custom jewelry · Los Angeles</p>
              <h1>Made once. For you.</h1>
              <p className="svc-hero-lede">
                Pick the piece, the metal, the stones — a designer turns it
                into a 3D render you approve before we cast a single gram of
                gold.
              </p>
              <div className="svc-actions">
                <button
                  type="button"
                  className="btn btn-primary svc-cta"
                  onClick={() => setStarted(true)}
                >
                  Start your design
                </button>
                <a
                  className="btn svc-cta svc-cta-ghost"
                  href="tel:+13236888837"
                >
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
      )}
    </main>
  );
}
