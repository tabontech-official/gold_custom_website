import {
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/pages.$handle';
import {Breadcrumb} from '~/components/Breadcrumb';
import {
  TrustPromise,
  parseTrustBadges,
  TRUST_BADGES_QUERY,
} from '~/components/TrustPromise';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {absoluteUrl, metaDescription, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data, matches}) =>
  pageSeo({
    title: data?.page.seo?.title || data?.page.title || '',
    description: metaDescription(data?.page.seo?.description),
    url: absoluteUrl(
      siteOrigin(rootDataFrom(matches)),
      `/pages/${data?.page.handle ?? ''}`,
    ),
  });

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
  context,
  request,
  params,
}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  // Our Core Values lives on About Us and nowhere else, so its metaobject is
  // only fetched for that one handle — every other page would pay a round trip
  // for a section it never renders. Same 5-minute cache the homepage used when
  // the section lived there: authored content that changes a few times a year.
  const wantsTrustBadges = params.handle === TRUST_BADGES_PAGE_HANDLE;

  const [{page}, trustBadgesResponse] = await Promise.all([
    context.storefront.query(PAGE_QUERY, {
      variables: {
        handle: params.handle,
      },
    }),
    wantsTrustBadges
      ? context.storefront
          .query(TRUST_BADGES_QUERY, {
            cache: context.storefront.CacheCustom({
              mode: 'public',
              maxAge: 300,
              staleWhileRevalidate: 3600,
            }),
          })
          .catch((error: Error) => {
            console.error(error);
            return null;
          })
      : null,
  ]);

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  return {
    page,
    // null, not [], when the section isn't wanted — the component is skipped
    // entirely rather than rendering an empty Core Values block.
    trustBadges: wantsTrustBadges ? parseTrustBadges(trustBadgesResponse) : null,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Page() {
  const {page, trustBadges} = useLoaderData<typeof loader>();

  return (
    <div className="page">
      <Breadcrumb items={[{label: 'Home', to: '/'}, {label: page.title}]} />
      <header>
        <h1>{page.title}</h1>
      </header>
      <main dangerouslySetInnerHTML={{__html: page.body}} />
      {trustBadges && <TrustPromise badges={trustBadges} />}
    </div>
  );
}

/** The one page Our Core Values renders on. */
const TRUST_BADGES_PAGE_HANDLE = 'about-us';

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      handle
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
` as const;
