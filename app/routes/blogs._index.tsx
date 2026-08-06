import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/blogs._index';
import {Image, getPaginationVariables} from '@shopify/hydrogen';
import {cdnLoader} from '~/lib/cdnImage';
import {Breadcrumb} from '~/components/Breadcrumb';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import type {ArticleItemFragment} from 'storefrontapi.generated';
import {SITE, absoluteUrl, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({matches}) =>
  pageSeo({
    title: 'Jewelry Guides & Buying Advice',
    description: `Gold buying guides, care tips and jewelry advice from ${SITE.name}.`,
    url: absoluteUrl(siteOrigin(rootDataFrom(matches)), '/blogs'),
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
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 12,
  });

  // ponytail: the store runs a single blog, so /blogs IS that blog's post grid
  // and /blogs/<handle> redirects here — one page, one URL, no "News" level.
  // Add a second blog and this has to merge both feeds (or list blogs again).
  const [{blogs}] = await Promise.all([
    context.storefront.query(BLOG_ARTICLES_QUERY, {
      variables: {
        ...paginationVariables,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  const blog = blogs.nodes[0];

  if (!blog?.articles) {
    throw new Response('Not found', {status: 404});
  }

  return {blog};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Blogs() {
  const {blog} = useLoaderData<typeof loader>();
  const {articles} = blog;

  return (
    <div className="blog">
      {/* Inside the content inset so the trail lines up on the left with every
          other route's breadcrumb instead of hugging the viewport edge. */}
      <div className="section-inner">
        <Breadcrumb items={[{label: 'Home', to: '/'}, {label: 'Blog'}]} />
        <PaginatedResourceSection<ArticleItemFragment>
          connection={articles}
          resourcesClassName="products-grid"
        >
          {({node: article, index}) => (
            <ArticleItem
              article={article}
              key={article.id}
              loading={index < 3 ? 'eager' : 'lazy'}
            />
          )}
        </PaginatedResourceSection>
      </div>
    </div>
  );
}

function ArticleItem({
  article,
  loading,
}: {
  article: ArticleItemFragment;
  loading?: HTMLImageElement['loading'];
}) {
  const publishedAt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(article.publishedAt!));
  const to = `/blogs/${article.handle}`;
  const detail = articleExcerpt(article);

  return (
    <article className="blog-card" key={article.id}>
      <Link className="blog-card-media" to={to} prefetch="intent" tabIndex={-1}>
        {article.image && (
          <Image
            loader={cdnLoader}
            alt={article.image.altText || article.title}
            aspectRatio="3/2"
            data={article.image}
            loading={loading}
            sizes="(min-width: 768px) 33vw, 100vw"
          />
        )}
      </Link>
      <div className="blog-card-body">
        <time className="blog-card-date" dateTime={article.publishedAt!}>
          {publishedAt}
        </time>
        <h3 className="blog-card-title">
          <Link to={to} prefetch="intent">
            {article.title}
          </Link>
        </h3>
        {detail && <p className="blog-card-excerpt">{detail}</p>}
        <Link className="blog-card-more" to={to} prefetch="intent">
          Read More &rarr;
        </Link>
      </div>
    </article>
  );
}

// Prefer Shopify's stripped excerpt; fall back to the first ~160 chars of the
// article body with tags removed so a card is never left blank.
function articleExcerpt(article: ArticleItemFragment): string {
  if (article.excerpt?.trim()) return article.excerpt.trim();
  const text = (article.contentHtml ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 160 ? `${text.slice(0, 160).trimEnd()}…` : text;
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog
const BLOG_ARTICLES_QUERY = `#graphql
  query BlogArticles(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    blogs(first: 1) {
      nodes {
        title
        handle
        seo {
          title
          description
        }
        articles(
          first: $first,
          last: $last,
          before: $startCursor,
          after: $endCursor
        ) {
          nodes {
            ...ArticleItem
          }
          pageInfo {
            hasPreviousPage
            hasNextPage
            endCursor
            startCursor
          }
        }
      }
    }
  }
  fragment ArticleItem on Article {
    author: authorV2 {
      name
    }
    contentHtml
    excerpt
    handle
    id
    image {
      id
      altText
      url
      width
      height
    }
    publishedAt
    title
  }
` as const;
