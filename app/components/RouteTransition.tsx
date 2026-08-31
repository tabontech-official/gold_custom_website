import {useNavigation, useLocation} from 'react-router';
import {
  isPageChange,
  routeSkeletonVariant,
  shouldShowSkeleton,
} from '~/lib/routeTransition';

/**
 * Feedback for cross-page navigation.
 *
 * React Router runs the destination route's loader BEFORE it renders anything,
 * so between the tap and the new page there is a window where the old page is
 * still fully on screen and nothing indicates that anything happened. On this
 * store that window measured 0.5-0.7s of server render on a warm local cache;
 * on a phone, with network round-trips on top, it reads as a dead tap — people
 * tap again, or conclude the link is broken.
 *
 * Nothing here makes the loader faster. It makes the wait legible: the shell
 * you already trust stays put, and the region that is actually changing is
 * replaced by a shape-matched placeholder.
 */

/**
 * The pathname being navigated TO, or null when we are not changing page.
 *
 * Returns the destination rather than a boolean so callers get the pathname
 * without re-reading `navigation.location` — which is only defined while the
 * router is busy, and whose narrowing does not survive a hook boundary.
 *
 * Deliberately not "any time the router is busy". Collection filters, sorting
 * and pagination all navigate to the same pathname with new search params, and
 * they render their own inline loading state — blanking the whole grid for
 * those would be a downgrade, not an improvement. Form submissions are
 * excluded for the same reason: they have local pending UI.
 */
function useNavigatingTo(): string | null {
  const navigation = useNavigation();
  const location = useLocation();

  if (navigation.state !== 'loading') return null;
  return isPageChange(navigation.location.pathname, location.pathname)
    ? navigation.location.pathname
    : null;
}

/**
 * Thin determinate-looking bar pinned under the header. It is pure CSS: it
 * starts immediately and eases toward 90% without ever arriving, because the
 * real duration is unknowable up front. It disappears when the route commits.
 */
export function RouteProgressBar() {
  const navigatingTo = useNavigatingTo();
  if (!navigatingTo) return null;

  return (
    <div className="route-progress" role="presentation">
      <div className="route-progress-bar" />
    </div>
  );
}

/**
 * Picks the placeholder that matches where the visitor is going, so the layout
 * that appears is the layout that stays. A single generic spinner would shift
 * everything the moment real content arrived, which is the layout-shift the
 * skeleton exists to avoid.
 */
export function RouteSkeleton({pathname}: {pathname: string}) {
  switch (routeSkeletonVariant(pathname)) {
    case 'product':
      return <ProductPageSkeleton />;
    case 'collection':
      return <CollectionPageSkeleton />;
    case 'article':
      return <ArticlePageSkeleton />;
    default:
      return <GenericPageSkeleton />;
  }
}

/**
 * Wraps the routed content. While changing page it swaps in the destination's
 * skeleton; otherwise it is transparent.
 *
 * `aria-busy` plus a polite live region is what makes this work for screen
 * readers — visually the shimmer says "loading", and this is the equivalent
 * announcement. The skeleton bones themselves are aria-hidden so a reader does
 * not walk through a tree of meaningless empty boxes.
 */
export function RouteTransition({children}: {children: React.ReactNode}) {
  const navigatingTo = useNavigatingTo();
  const {pathname} = useLocation();

  if (!navigatingTo) return <>{children}</>;
  // Product → product keeps the current page mounted rather than blanking it.
  // See shouldShowSkeleton for why. RouteProgressBar still reports the wait.
  if (!shouldShowSkeleton(navigatingTo, pathname)) return <>{children}</>;

  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        Loading page
      </span>
      <div aria-hidden="true">
        <RouteSkeleton pathname={navigatingTo} />
      </div>
    </div>
  );
}

/** One shimmering bone. `w`/`h` are any CSS length. */
function Bone({
  w = '100%',
  h = '1rem',
  radius,
  className = '',
}: {
  w?: string;
  h?: string;
  radius?: string;
  className?: string;
}) {
  return (
    <span
      className={`route-bone ${className}`}
      style={{width: w, height: h, borderRadius: radius}}
    />
  );
}

/** Mirrors the collection grid: breadcrumb, title, then a card grid. */
function CollectionPageSkeleton() {
  return (
    <div className="section-inner route-skeleton">
      <Bone w="12rem" h="0.75rem" />
      <Bone w="16rem" h="2rem" className="route-skeleton-title" />
      <div className="route-skeleton-grid">
        {Array.from({length: 8}).map((_, index) => (
          <div className="route-skeleton-card" key={index}>
            <Bone h="auto" radius="0" className="route-skeleton-thumb" />
            <Bone w="82%" h="0.85rem" />
            <Bone w="38%" h="0.85rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the PDP: gallery on the left, buy column on the right. */
function ProductPageSkeleton() {
  return (
    <div className="section-inner route-skeleton">
      <Bone w="14rem" h="0.75rem" />
      <div className="route-skeleton-pdp">
        <Bone h="auto" radius="0" className="route-skeleton-gallery" />
        <div className="route-skeleton-buybox">
          <Bone w="70%" h="1.6rem" />
          <Bone w="40%" h="1.2rem" />
          <Bone w="100%" h="0.85rem" />
          <Bone w="90%" h="0.85rem" />
          <Bone w="100%" h="3rem" radius="999px" />
          <Bone w="100%" h="3rem" radius="999px" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors an article: hero image, headline, paragraph rules. */
function ArticlePageSkeleton() {
  return (
    <div className="section-inner route-skeleton">
      <Bone w="10rem" h="0.75rem" />
      <Bone h="auto" radius="0" className="route-skeleton-hero" />
      <Bone w="80%" h="2rem" className="route-skeleton-title" />
      {Array.from({length: 6}).map((_, index) => (
        <Bone key={index} w={index % 3 === 2 ? '60%' : '100%'} h="0.85rem" />
      ))}
    </div>
  );
}

function GenericPageSkeleton() {
  return (
    <div className="section-inner route-skeleton">
      <Bone w="16rem" h="2rem" className="route-skeleton-title" />
      {Array.from({length: 5}).map((_, index) => (
        <Bone key={index} w={index % 3 === 2 ? '55%' : '100%'} h="0.85rem" />
      ))}
    </div>
  );
}
