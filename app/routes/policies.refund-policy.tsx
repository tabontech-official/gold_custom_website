import {Link} from 'react-router';
import {PolicyDocument} from '~/components/PolicyDocument';
import {absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';
import {RETURNS_SUMMARY, TRANSIT_DAMAGE_POLICY} from '~/lib/trustClaims';
import type {Route} from './+types/policies.refund-policy';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Refund & Returns Policy',
    description: RETURNS_SUMMARY,
    url: absoluteUrl(
      siteOrigin(rootDataFrom(matches)),
      '/policies/refund-policy',
    ),
  });

export default function RefundPolicy() {
  return (
    <PolicyDocument title="Refund & Returns Policy">
      <section>
        <h2>Manufacturing Defects</h2>
        <p>
          We make our jewelry in our own factory. For online orders, we accept
          returns only for confirmed manufacturing defects, including on
          custom-made, personalized, or sized-to-order pieces. {RETURNS_SUMMARY}
        </p>
        <p>In-store purchases are final sale, subject to applicable law.</p>
      </section>
      <section>
        <h2>How to Request a Return</h2>
        <p>
          <Link to="/contact">Contact customer service</Link> with your order
          number and photos showing the defect. Wait for return approval before
          sending your item. Approved items should be returned in their
          original, unused condition with the original labels attached. We
          inspect the item to confirm the defect before issuing an exchange or
          store credit.
        </p>
        <p>
          Customers are responsible for return shipping costs. Original shipping
          and handling charges, if paid, are non-refundable. Applicable law may
          require a different remedy.
        </p>
        <p>
          Layaway purchases may be subject to a 10% restocking fee if you cancel
          your order.
        </p>
      </section>
      <section>
        <h2>Damage During Delivery</h2>
        <p>
          {TRANSIT_DAMAGE_POLICY} Keep the packaging and take photos of the item
          and parcel, then <Link to="/contact">contact us</Link> for help with
          the carrier claim. See our{' '}
          <Link to="/policies/shipping-policy">Shipping Policy</Link> for
          details.
        </p>
      </section>
      <section>
        <h2>Product Disclaimers</h2>
        <ul>
          <li>
            All weights are approximate in 10-karat gold. Final weight will vary
            plus or minus 15%.
          </li>
          <li>Jewelry may appear larger in photos to show detail.</li>
          <li>
            The width of some chain models may vary up to 0.5 mm less due to the
            finishing style and polishing during manufacturing.
          </li>
        </ul>
      </section>
    </PolicyDocument>
  );
}
