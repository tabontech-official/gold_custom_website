import {useLoaderData, Link} from 'react-router';
import type {Route} from './+types/policies._index';
import {Breadcrumb} from '~/components/Breadcrumb';
import type {PoliciesQuery, PolicyItemFragment} from 'storefrontapi.generated';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';
import {CacheStatic} from '~/lib/cache';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Store Policies',
    description: `Shipping, returns, refunds, warranty and privacy policies for ${SITE.name}.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/policies'),
  });


export async function loader({context}: Route.LoaderArgs) {
  const data: PoliciesQuery = await context.storefront.query(POLICIES_QUERY, {
    cache: CacheStatic(),
  });

  const shopPolicies = data.shop;
  const policies: PolicyItemFragment[] = [
    shopPolicies?.privacyPolicy,
    shopPolicies?.shippingPolicy,
    shopPolicies?.termsOfService,
    shopPolicies?.refundPolicy,
    shopPolicies?.subscriptionPolicy,
  ].filter((policy): policy is PolicyItemFragment => policy != null);

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies};
}

export default function Policies() {
  const {policies} = useLoaderData<typeof loader>();

  return (
    <main className="policies-page">
      <div className="section-inner">
        <Breadcrumb items={[{label: 'Home', to: '/'}, {label: 'Policies'}]} />
      </div>
      <section className="policies-hero">
        <div className="section-inner">
          <p className="policy-kicker">Gold Custom · Customer care</p>
          <h1>Policies</h1>
          <p>
            Everything you need to know about shopping with Gold Custom, in one
            clear place.
          </p>
        </div>
      </section>
      <section className="section-inner policies-directory">
        <div className="policies-directory-intro">
          <p className="policy-kicker">Browse policies</p>
          <h2>Choose a topic</h2>
        </div>
        <div className="policies-grid">
          {policies.map((policy) => (
            <Link
              className="policy-card-link"
              key={policy.id}
              to={`/policies/${policy.handle}`}
            >
              <span className="policy-card-number" aria-hidden="true">
                {String(policies.indexOf(policy) + 1).padStart(2, '0')}
              </span>
              <span className="policy-card-title">{policy.title}</span>
              <span className="policy-card-action">
                Read policy <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      subscriptionPolicy {
        id
        title
        handle
      }
    }
  }
` as const;
