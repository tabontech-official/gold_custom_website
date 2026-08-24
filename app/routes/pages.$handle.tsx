import {useState, type FormEvent} from 'react';
import {
  useFetcher,
  useLoaderData,
} from 'react-router';
import {PolicyDocument} from '~/components/PolicyDocument';
import type {Route} from './+types/pages.$handle';
import {Breadcrumb} from '~/components/Breadcrumb';
import {
  TrustPromise,
  parseTrustBadges,
  TRUST_BADGES_QUERY,
} from '~/components/TrustPromise';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {FaqAccordion} from '~/components/FaqAccordion';
import {FAQS_QUERY, buildFaqJsonLd, parseFaqs} from '~/lib/faqs';
import {CacheContent} from '~/lib/cache';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  metaDescription,
  pageSeo,
  rootDataFrom,
  siteOrigin,
} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data, matches}) => {
  const origin = siteOrigin(rootDataFrom(matches));
  const url = absoluteUrl(origin, `/pages/${data?.page.handle ?? ''}`);
  const faqs = data?.faqs ?? [];

  return pageSeo({
    title: data?.page.seo?.title || data?.page.title || '',
    description: metaDescription(data?.page.seo?.description),
    url,
    jsonLd: [
      breadcrumbJsonLd(origin, [
        {name: 'Home', path: '/'},
        {name: data?.page.title ?? '', path: `/pages/${data?.page.handle ?? ''}`},
      ]),
      // Only when the page actually renders the accordion below. FAQPage markup
      // describing Q&A a visitor cannot see is precisely what earns a manual
      // action — see the warning on buildFaqJsonLd.
      ...(faqs.length ? [{...buildFaqJsonLd(faqs), '@id': `${url}#faq`, url}] : []),
    ],
  });
};

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
  // Same one-handle gate as the trust badges above: only the FAQ page pays for
  // the metaobject round trip. The homepage reads the very same `pages_faqs`
  // source, so the two can never drift apart.
  const wantsFaqs = params.handle === FAQ_PAGE_HANDLE;

  const [{page}, trustBadgesResponse, faqsResponse] = await Promise.all([
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
    wantsFaqs
      ? context.storefront
          .query(FAQS_QUERY, {cache: CacheContent()})
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
    faqs: wantsFaqs ? parseFaqs(faqsResponse, FAQ_SECTION_HANDLE) : [],
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
  const {page, trustBadges, faqs} = useLoaderData<typeof loader>();

  // The customer-privacy page gets the same treatment as /policies/* — hero,
  // kicker, 52rem reading column — plus the opt-out controls its body refers
  // to. Everything textual still comes from the backend page.
  if (page.handle === OPT_OUT_PAGE_HANDLE) {
    return (
      <PolicyDocument title={page.title}>
        <div dangerouslySetInnerHTML={{__html: page.body}} />
        <DataSharingOptOut />
      </PolicyDocument>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={[{label: 'Home', to: '/'}, {label: page.title}]} />
      <header>
        <h1>{page.title}</h1>
      </header>
      <main dangerouslySetInnerHTML={{__html: page.body}} />
      {/* Rendered, not just marked up — the JSON-LD above describes exactly
          these questions, and Google requires FAQ markup to match content the
          visitor can actually see. */}
      {faqs.length > 0 && <FaqAccordion faqs={faqs} showHeading={false} />}
      {trustBadges && <TrustPromise badges={trustBadges} />}
    </div>
  );
}

/** The Shopify-managed data-sharing page; its body is authored in the backend,
    only the opt-out controls below are ours. */
const OPT_OUT_PAGE_HANDLE = 'data-sharing-opt-out';

/**
 * The "instructions below" the page body refers to — same flow as Shopify's
 * hosted version of this page:
 *
 * - "Opt out" always opts this browser out via the Customer Privacy API
 *   (loaded on every page by Analytics.Provider; Hydrogen's wrapper injects
 *   the checkout domain and token). AnalyticsBridge reads the same API, so
 *   GA4/Meta go quiet on the next event.
 * - The optional checkbox + email additionally opts out the customer RECORD
 *   through /api/data-sale-opt-out (Admin API dataSaleOptOut). Shopify
 *   validates the email against existing customers and its userError comes
 *   back verbatim if there is no match.
 */
function DataSharingOptOut() {
  const account = useFetcher<{success?: boolean; error?: string}>();
  const [withAccount, setWithAccount] = useState(false);
  const [browser, setBrowser] = useState<'idle' | 'busy' | 'done' | 'error'>(
    'idle',
  );

  const accountBusy = withAccount && account.state !== 'idle';
  const busy = browser === 'busy' || accountBusy;
  const done =
    browser === 'done' && (!withAccount || Boolean(account.data?.success));

  function optOutBrowser() {
    const shopify = (
      window as unknown as {
        Shopify?: {
          customerPrivacy?: {
            setTrackingConsent: (
              consent: Record<string, boolean>,
              callback: (result?: {error?: unknown}) => void,
            ) => void;
          };
        };
      }
    ).Shopify;
    const api = shopify?.customerPrivacy;
    if (!api) {
      // ponytail: the consent script loads at first idle; a click that beats
      // it just asks for a retry instead of queueing.
      setBrowser('error');
      return;
    }
    setBrowser('busy');
    api.setTrackingConsent(
      {
        marketing: false,
        analytics: false,
        preferences: false,
        sale_of_data: false,
      },
      (result) => setBrowser(result?.error ? 'error' : 'done'),
    );
  }

  // One submit drives both halves: the browser consent call always runs; the
  // form only actually posts (account opt-out) when the checkbox is ticked.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    optOutBrowser();
    if (!withAccount) event.preventDefault();
  }

  return (
    <section className="page-optout">
      {done ? (
        <p role="status">
          <strong>You have successfully opted out</strong>
        </p>
      ) : (
        <account.Form
          action="/api/data-sale-opt-out"
          method="post"
          onSubmit={onSubmit}
        >
          <label className="optout-check">
            <input
              checked={withAccount}
              onChange={(event) => setWithAccount(event.target.checked)}
              type="checkbox"
            />
            <span>Don&rsquo;t share data from my account (optional)</span>
          </label>
          {withAccount ? (
            <label className="appt-field">
              <span>Email address</span>
              <input
                autoComplete="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </label>
          ) : null}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? 'Opting out…' : 'Opt out'}
          </button>
        </account.Form>
      )}
      {browser === 'error' ? (
        <p className="appt-error" role="alert">
          The consent service hasn&rsquo;t finished loading — please try again
          in a moment.
        </p>
      ) : null}
      {account.data?.error ? (
        <p className="appt-error" role="alert">
          {account.data.error}
        </p>
      ) : null}
    </section>
  );
}

/** The one page Our Core Values renders on. */
const TRUST_BADGES_PAGE_HANDLE = 'about-us';
// The Shopify page's own handle. The page is titled "FAQ's" but its handle
// is 'faqs' — confirmed against the live Storefront API.
const FAQ_PAGE_HANDLE = 'faqs';
/**
 * The EXACT `pages_faqs` metaobject holding this page's questions.
 *
 * The store has 25 `pages_faqs` entries, all auto-handled `pages-faqs-<random>`
 * — they back the homepage, the collection pages and this one. FAQS_QUERY
 * fetches all of them and `parseFaqs` returns the FIRST that parses, so an
 * unfiltered call here served whichever Shopify listed first (a 15-question
 * collection set) and would have published it as this page's FAQ markup.
 *
 * A prefix like `pages-faqs` matches all 25 and so is no better than no filter
 * at all; only the full handle isolates this one. That makes it brittle by
 * nature: re-create the metaobject in Shopify and the suffix changes. If it
 * goes blank, re-run the handle check and update this constant.
 */
const FAQ_SECTION_HANDLE = 'pages-faqs-dtm3mddc';

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
