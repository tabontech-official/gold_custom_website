import {Link} from 'react-router';
import type {Route} from './+types/policies.finance';
import {FINANCE_LINKS} from '~/lib/finance';
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
        {/* Third-party lenders: `noopener` because of target=_blank, and
            `nofollow` so a commercial partner link can't be read as a link
            scheme or bleed ranking signal off the store — same treatment as
            the logo strip on the product page. */}
        <ul>
          <li>
            <a
              href={FINANCE_LINKS.americanFirst}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              American First Finance
            </a>{' '}
            — apply on their secure site.
          </li>
          <li>
            <a
              href={FINANCE_LINKS.progressive}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Progressive Leasing
            </a>{' '}
            — lease-to-own financing. Not available in all states.
          </li>
          <li>
            <a
              href={FINANCE_LINKS.synchrony}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Synchrony
            </a>{' '}
            — flexible retail financing programs.
          </li>
          <li>
            <a
              href={FINANCE_LINKS.acima}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Acima
            </a>{' '}
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
