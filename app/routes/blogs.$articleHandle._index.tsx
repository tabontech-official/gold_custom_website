import {redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/blogs.$articleHandle._index';
import {Image} from '@shopify/hydrogen';
import {cdnLoader} from '~/lib/cdnImage';
import {Breadcrumb} from '~/components/Breadcrumb';
import {
  SITE,
  absoluteUrl,
  breadcrumbJsonLd,
  metaDescription,
  pageSeo,
  rootDataFrom,
  siteOrigin,
} from '~/lib/seo';

/**
 * Articles live one level under /blogs — the Shopify blog ("News") is not part
 * of the URL. Legacy /blogs/<blog>/<article> links redirect here.
 */
export const meta: Route.MetaFunction = ({data, matches, params}) => {
  const article = data?.article;
  const origin = siteOrigin(rootDataFrom(matches));
  const url = absoluteUrl(origin, `/blogs/${params.articleHandle}`);

  return pageSeo({
    title: article?.seo?.title || article?.title || 'Blog',
    description: metaDescription(article?.seo?.description),
    url,
    media: article?.image?.url
      ? {type: 'image', url: article.image.url}
      : undefined,
    jsonLd: article
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            '@id': `${url}#article`,
            headline: article.title,
            description: metaDescription(article.seo?.description),
            url,
            mainEntityOfPage: url,
            datePublished: article.publishedAt,
            image: article.image?.url ? [article.image.url] : undefined,
            author: article.author?.name
              ? {'@type': 'Person', name: article.author.name}
              : {'@type': 'Organization', name: SITE.name},
            publisher: {'@id': `${origin}/#organization`},
          },
          breadcrumbJsonLd(origin, [
            {name: 'Home', path: '/'},
            {name: 'Blog', path: '/blogs'},
            {name: article.title, path: `/blogs/${params.articleHandle}`},
          ]),
        ]
      : undefined,
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
async function loadCriticalData({context, params}: Route.LoaderArgs) {
  const {articleHandle} = params;

  if (!articleHandle) {
    throw new Response('Not found', {status: 404});
  }

  // ponytail: looks the article up in the store's single blog. A second blog
  // would need this to search across blogs.
  const [{blogs}] = await Promise.all([
    context.storefront.query(ARTICLE_QUERY, {
      variables: {articleHandle},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  const blog = blogs.nodes[0];
  const article = blog?.articleByHandle;

  if (!article) {
    // /blogs/news — the old per-blog listing URL — belongs on the post grid.
    // Anything else at this depth is a dead article and stays a 404.
    if (blog && articleHandle === blog.handle) {
      throw redirect('/blogs', 301);
    }
    throw new Response('Not found', {status: 404});
  }

  return {article};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Article() {
  const {article} = useLoaderData<typeof loader>();
  const {title, image, contentHtml, author} = article;

  const publishedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(article.publishedAt));

  return (
    <>
      {/* Same inset as every other route's trail, so it lines up on the left
          instead of following the article's narrower centred column. */}
      <div className="section-inner">
        <Breadcrumb
          items={[
            {label: 'Home', to: '/'},
            {label: 'Blog', to: '/blogs'},
            {label: title},
          ]}
        />
      </div>

      <article className="article">
        <header className="article-header">
          <span className="eyebrow">Blog</span>
          <h1 className="article-title">{title}</h1>
          <div className="article-meta">
            <time dateTime={article.publishedAt}>{publishedDate}</time>
            {author?.name && (
              <>
                <span aria-hidden="true">&middot;</span>
                <address>{author.name}</address>
              </>
            )}
          </div>
        </header>

        {image && (
          <div className="article-hero">
            <Image
              loader={cdnLoader}
              data={image}
              sizes="(min-width: 1100px) 1040px, 100vw"
              loading="eager"
            />
          </div>
        )}

        <div
          className="article-body"
          dangerouslySetInnerHTML={{__html: contentHtml}}
        />
      </article>
    </>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog#field-blog-articlebyhandle
const ARTICLE_QUERY = `#graphql
  query Article(
    $articleHandle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    blogs(first: 1) {
      nodes {
        handle
        articleByHandle(handle: $articleHandle) {
          handle
          title
          contentHtml
          publishedAt
          author: authorV2 {
            name
          }
          image {
            id
            altText
            url
            width
            height
          }
          seo {
            description
            title
          }
        }
      }
    }
  }
` as const;
