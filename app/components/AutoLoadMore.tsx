import {useEffect, useRef} from 'react';

/**
 * Invisible sentinel that auto-triggers Hydrogen's <NextLink> when it scrolls
 * into view, so the user never has to press "Load More". Place it right before
 * the NextLink; it clicks the next `a.load-more-btn` sibling in the same
 * `.load-more-bar`. `isLoading` gates re-clicks while a page is fetching.
 */
export function AutoLoadMore({
  hasNextPage,
  isLoading,
}: {
  hasNextPage: boolean;
  isLoading: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!hasNextPage) return;
    const sentinel = ref.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || isLoading) return;
        // The NextLink renders as an anchor in the same load-more-bar.
        const link = sentinel.parentElement?.querySelector<HTMLAnchorElement>(
          'a.load-more-btn:not(.is-ghost)',
        );
        link?.click();
      },
      // Start loading a screenful early so content is ready before the user
      // reaches the bottom — feels seamless, not like an empty scroll.
      {rootMargin: '600px 0px'},
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isLoading]);

  return <span ref={ref} aria-hidden="true" style={{width: 0, height: 0}} />;
}
