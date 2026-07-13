import {
  Link,
  redirect,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/blogs._index';
import {Image, getPaginationVariables} from '@shopify/hydrogen';
import {Breadcrumb} from '~/components/Breadcrumb';
import type {BlogsQuery} from 'storefrontapi.generated';

type BlogNode = BlogsQuery['blogs']['nodes'][0];

export const meta: Route.MetaFunction = () => {
  return [{title: `Hydrogen | Blogs`}];
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
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 10,
  });

  const [{blogs}] = await Promise.all([
    context.storefront.query(BLOGS_QUERY, {
      variables: {
        ...paginationVariables,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  // Most stores have a single blog. Listing one lone blog card is pointless —
  // send visitors straight to its articles so /blogs = the post grid.
  if (blogs.nodes.length === 1) {
    throw redirect(`/blogs/${blogs.nodes[0].handle}`);
  }

  return {blogs};
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
  const {blogs} = useLoaderData<typeof loader>();

  return (
    <div className="blogs">
      <Breadcrumb items={[{label: 'Home', to: '/'}, {label: 'Journal'}]} />
      <div className="section-inner">
        <div className="editorial-heading">
          <h1 className="editorial-title">Our Journal</h1>
          <p>Stories, care guides, and behind-the-craft notes.</p>
        </div>
        <div className="blog-index-grid">
          {blogs.nodes.map((blog, index) => (
            <BlogCard
              key={blog.handle}
              blog={blog}
              loading={index < 3 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// One card per blog, fronted by its latest article's cover + excerpt so the
// listing looks editorial instead of a wall of bare titles. Read More jumps to
// the article when there is one, else the blog's own page.
function BlogCard({
  blog,
  loading,
}: {
  blog: BlogNode;
  loading?: HTMLImageElement['loading'];
}) {
  const latest = blog.articles?.nodes?.[0];
  const to = latest
    ? `/blogs/${blog.handle}/${latest.handle}`
    : `/blogs/${blog.handle}`;
  const excerpt = latest?.excerpt?.trim();
  const publishedAt = latest?.publishedAt
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(latest.publishedAt))
    : null;

  return (
    <article className="blog-card">
      <Link className="blog-card-media" to={to} prefetch="intent" tabIndex={-1}>
        {latest?.image && (
          <Image
            alt={latest.image.altText || latest.title}
            aspectRatio="3/2"
            data={latest.image}
            loading={loading}
            sizes="(min-width: 768px) 33vw, 100vw"
          />
        )}
      </Link>
      <div className="blog-card-body">
        <span className="eyebrow">{blog.title}</span>
        {publishedAt && (
          <time className="blog-card-date">{publishedAt}</time>
        )}
        <h3 className="blog-card-title">
          <Link to={to} prefetch="intent">
            {latest?.title ?? blog.title}
          </Link>
        </h3>
        {excerpt && <p className="blog-card-excerpt">{excerpt}</p>}
        <Link className="blog-card-more" to={to} prefetch="intent">
          Read More &rarr;
        </Link>
      </div>
    </article>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog
const BLOGS_QUERY = `#graphql
  query Blogs(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    blogs(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      nodes {
        title
        handle
        seo {
          title
          description
        }
        articles(first: 1) {
          nodes {
            title
            handle
            excerpt
            publishedAt
            image {
              id
              altText
              url
              width
              height
            }
          }
        }
      }
    }
  }
` as const;
