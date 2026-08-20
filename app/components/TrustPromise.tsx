import purityIcon from '~/assets/img/purity.webp?url';
import handmadeIcon from '~/assets/img/handmade.webp?url';
import careIcon from '~/assets/img/care.webp?url';
import secureDeliveryIcon from '~/assets/img/secure-delivery.webp?url';

/**
 * Our Core Values — the four trust promises, their Shopify metaobject override
 * parsing, and the query that fetches it.
 *
 * Lifted out of the homepage route when the section moved to /pages/about-us:
 * importing it from `routes/_index` would have pulled the entire homepage
 * module — hero, every query, every other section — into the About page's
 * bundle for the sake of one component.
 */
// Copy only — this crosses the loader serialization boundary, so it must be
// plain JSON (no JSX). ponytail: don't put React elements in loader data.
// `icon` is a 3D sticker in /public tilted on the right of the card; `signal`
// is the sticker's main hue, mapped to the card's bg tint in app.css. `pill` is
// the status label.
// Every claim here has to be traceable to something the store already states
// elsewhere — the product-page trust badges, the refund policy, or the contact
// page. Generic luxury phrasing ("Master Craft", "Lifetime Care") was replaced
// because it named no fact a competitor couldn't copy verbatim.
export const TRUST_PROMISES = [
  {
    title: 'Our Own Factory',
    pill: 'U.S.A.',
    // Source: product-page trust badge "Made in U.S.A — From our factory to you".
    copy: 'No middleman markup between our bench and your order.',
    icon: handmadeIcon,
    signal: 'gold',
    keys: ['craft', 'mastercraft', 'craftsmanship'],
  },
  {
    title: 'Solid 10K & 14K Gold',
    pill: 'Never plated',
    // Source: the catalogue — every piece is 10K/14K, no plated or filled stock.
    copy: 'Real gold throughout, with the karat stated on every piece.',
    icon: purityIcon,
    signal: 'amber',
    keys: ['purity', 'certifiedpurity'],
  },
  {
    title: 'Built to Your Spec',
    pill: 'Custom',
    // Source: homepage FAQ — design, gold type, gemstones and engraving.
    copy: 'Choose the design, karat, stones and engraving on a custom order.',
    icon: careIcon,
    signal: 'brown',
    keys: ['care', 'lifetimecare'],
  },
  {
    title: 'Downtown L.A',
    pill: 'Appointment',
    // Source: contact page — 550 S Hill St #660, the Jewelry District.
    copy: 'See a piece in person at 550 S Hill St, in the Jewelry District.',
    icon: secureDeliveryIcon,
    signal: 'green',
    keys: ['delivery', 'securedelivery'],
  },
];

export function parseTrustBadges(response: any) {
  const fields = response?.metaobject?.fields;
  if (!Array.isArray(fields)) return TRUST_PROMISES;

  const valueByKey = fields.reduce(
    (result: Record<string, string>, field: any) => {
      if (field?.key && typeof field.value === 'string') {
        result[field.key.replace(/[-_]/g, '').toLowerCase()] = field.value;
      }
      return result;
    },
    {},
  );

  // Override keys live on each badge, not in a title-keyed map — retitling a
  // card used to silently detach it from its Shopify override.
  return TRUST_PROMISES.map((badge) => {
    const copy = badge.keys.map((key) => valueByKey[key]).find(Boolean);
    return copy ? {...badge, copy} : badge;
  });
}

export function TrustPromise({badges}: {badges: typeof TRUST_PROMISES}) {
  return (
    <section className="home-section trust-promise-section">
      <div className="section-inner">
        <div className="editorial-heading trust-promise-heading">
          <h2 className="editorial-title">Our Core Values</h2>
        </div>
        <div className="trust-promise-grid">
          {badges.map((item) => {
            const b = item as (typeof TRUST_PROMISES)[number];
            return (
              <article
                className="trust-promise-card"
                key={item.title}
                data-signal={b.signal ?? 'gold'}
              >
                {b.icon && (
                  <img
                    className="trust-sticker"
                    src={b.icon}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    draggable={false}
                  />
                )}
                {b.pill && (
                  <span className="trust-pill">
                    <span className="trust-pill-dot" aria-hidden="true" />
                    {b.pill}
                  </span>
                )}
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const TRUST_BADGES_QUERY = `#graphql
  query TrustBadges($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    metaobject(
      handle: {
        type: "trust_badges_data"
        handle: "trust-badges-data-qgta9zi1"
      }
    ) {
      fields {
        key
        value
      }
    }
  }
` as const;
