import {PolicyDocument} from '~/components/PolicyDocument';
import {useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import type {SitePolicies} from '~/lib/sitePolicies';

export default function RefundPolicy() {
  const root = useRouteLoaderData<RootLoader>('root');
  const returnsSentence = (root?.sitePolicies as SitePolicies | undefined)?.returns;
  return (
    <PolicyDocument title="Refund & Returns Policy">
      <section>
        {returnsSentence ? (
          <p>{returnsSentence}</p>
        ) : (
          <p>
            If, for any reason, you are not 100% satisfied with your purchase,
            you may request an exchange or store credit within 14 days of
            receipt for eligible items that have not been custom-sized (less
            shipping and handling charges).
          </p>
        )}
      </section>
      <section>
        <h2>Return Conditions</h2>
        <ul>
          <li>
            Returned product must be UNUSED, not engraved or personalized and in
            its original condition. Credit is subject to examination of the
            product by our quality assurance specialists. Any product damaged or
            altered cannot be returned.
          </li>
          <li>
            A product credit will be issued if the product was received as a
            gift and is returned by the recipient. Items that have been
            customized cannot be returned.
          </li>
          <li>
            For any returns, please contact our customer service department by
            email or telephone to request assistance and explain the reasons for
            your request. Following your explanations, our customer service
            representatives determine and validate eligibility for refunds and
            exchanges. The return of parcels without the prior approval of
            Customer Service may be refused, interrupted or delayed.
          </li>
          <li>
            Any item that has received return approval must be returned in its
            original (new), unused condition and with the original labels
            attached. Requests to return items due to quality problems, shipping
            damage, color, style or model or size error must be accompanied by
            photos or other evidence clearly showing the problem with the item
            received. We reserve the right to charge shipping or handling fees
            on all items returned for reasons other than those stated in this
            policy.
          </li>
          <li>
            Items bought via layaway programs (e.g., Partial.ly) are not
            eligible for a full refund and may be subject to a 10% restocking
            fee if you decide to cancel your order.
          </li>
        </ul>
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
      <section>
        <h2>Custom pieces</h2>
        <p>
          <strong>Note:</strong> Please be advised that all custom-made pieces,
          personalized jewelry, and rings that have been sized to order are
          crafted specifically for you. Therefore, these items are considered
          final sale and are strictly non-returnable and non-exchangeable under
          our 14-day policy.
        </p>
      </section>
    </PolicyDocument>
  );
}
