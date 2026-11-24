import {Link} from 'react-router';
import {PolicyDocument} from '~/components/PolicyDocument';
import {absoluteUrl, pageSeo, PHONE, rootDataFrom, siteOrigin} from '~/lib/seo';
import {SHIPPING_SUMMARY, TRANSIT_DAMAGE_POLICY} from '~/lib/trustClaims';
import type {Route} from './+types/policies.shipping-policy';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Shipping Policy',
    description: SHIPPING_SUMMARY,
    url: absoluteUrl(
      siteOrigin(rootDataFrom(matches)),
      '/policies/shipping-policy',
    ),
  });

export default function ShippingPolicy() {
  return (
    <PolicyDocument title="Shipping Policy">
      <section>
        <h2>United States Shipping</h2>
        <p>{SHIPPING_SUMMARY}</p>
        <p>Express shipping is available for $15.</p>
        <p>Delivery usually takes 4 to 5 business days after dispatch.</p>
      </section>
      <section>
        <h2>Processing Time</h2>
        <p>
          In-stock orders ship within 1 to 2 business days. Custom-made,
          personalized, and sized-to-order pieces ship once production is
          complete. We confirm the estimated timeline when you place your order.
        </p>
      </section>
      <section>
        <h2>Shipping Protection and Tracking</h2>
        <p>All orders ship insured with tracking.</p>
        <p>
          {TRANSIT_DAMAGE_POLICY} If your order arrives damaged, keep the
          packaging, take photos, and <Link to="/contact">contact us</Link> for
          help with the carrier claim.
        </p>
      </section>
      <section>
        <h2>Free Local Pickup</h2>
        <p>
          Pick up your order at 550 S Hill St, Suite 660, Los Angeles, CA 90013.
        </p>
      </section>
      <section>
        <h2>International Shipping</h2>
        <p>
          GoldCustom.com ships within the United States. Canadian customers can
          shop at <a href="https://goldcustom.ca">goldcustom.ca</a>.
        </p>
      </section>
      <section>
        <h2>Questions?</h2>
        <p>
          Call <a href={PHONE.tel}>{PHONE.display}</a> or email{' '}
          <a href="mailto:mr10k@goldcustom.com">mr10k@goldcustom.com</a>.
        </p>
      </section>
    </PolicyDocument>
  );
}
