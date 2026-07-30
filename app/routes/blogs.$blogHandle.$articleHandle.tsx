import {redirect} from 'react-router';
import type {Route} from './+types/blogs.$blogHandle.$articleHandle';

/**
 * Shopify's own article URL carries the blog handle (/blogs/news/<article>);
 * this storefront serves articles at /blogs/<article>. Permanently redirect the
 * old shape so indexed links and shared URLs keep their destination.
 */
export async function loader({params, request}: Route.LoaderArgs) {
  throw redirect(
    `/blogs/${params.articleHandle}${new URL(request.url).search}`,
    301,
  );
}
