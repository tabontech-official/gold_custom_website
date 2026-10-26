import {Link} from 'react-router';
import type {Route} from './+types/policies.finance';
import {FINANCE_LINKS} from '~/lib/finance';
import {FinancingLink} from '~/components/FinancingLink';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

/**
 * Unlike the other /policies/* pages this one is not a Shopify shop policy —
 * it is a static route, which is why it has to be a real flat route rather
 * than a file under routes/policies/. As a folder file it was never routed at
 * all and /policies/finance 404'd through policies.$handle.
 */
export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Financing & Payment Plans',
    description: `Split your purchase into monthly installments with ${SITE.name}. Apply with Acima, Progressive Leasing, Synchrony or American First Finance.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/policies/finance'),
  });

export default function Finance() {
  return (
    <div className="section-inner home-section">
      <div className="page">
        <h1>Shop Now, Pay Later</h1>

        <p>
          Split your payment into easy monthly installments. We partner with a
          selection of financing providers; you will complete the application on
          the provider’s secure website.
        </p>

        <h2>We Partner With</h2>
        {/* Same lead form as the product page's logo strip — FinancingLink. */}
        <ul>
          <li>
            <FinancingLink
              partner={{
                name: 'American First Finance',
                href: FINANCE_LINKS.americanFirst,
              }}
            >
              American First Finance
            </FinancingLink>{' '}
            — apply on their secure site.
          </li>
          <li>
            <FinancingLink
              partner={{
                name: 'Progressive Leasing',
                href: FINANCE_LINKS.progressive,
              }}
            >
              Progressive Leasing
            </FinancingLink>{' '}
            — lease-to-own financing. Not available in all states.
          </li>
          <li>
            <FinancingLink
              partner={{name: 'Synchrony', href: FINANCE_LINKS.synchrony}}
            >
              Synchrony
            </FinancingLink>{' '}
            — flexible retail financing programs.
          </li>
          <li>
            <FinancingLink
              partner={{name: 'Acima Leasing', href: FINANCE_LINKS.acima}}
            >
              Acima
            </FinancingLink>{' '}
            — affordable payments and lease options.
          </li>
        </ul>

        <h2>How it Works</h2>
        <ol>
          <li>Select the option that fits you best at checkout.</li>
          <li>Complete the application on the provider’s secure website.</li>
          <li>Once approved, text us and we’ll help finalize your purchase.</li>
        </ol>

        <p>
          <Link to="/">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
