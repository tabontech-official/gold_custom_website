import {useLayoutEffect, useRef, type ReactNode} from 'react';

/**
 * Wraps the collection heading + category icon strip so both stay pinned
 * under the header while scrolling. Rendered height varies (title can wrap
 * to two lines, the icon strip differs per breakpoint), so it's measured
 * live and exposed as --sticky-head-height for .collection-toolbar to stack
 * under — a fixed guess would drift out of sync with real content.
 */
export function CollectionStickyHead({children}: {children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const setHeight = () =>
      document.documentElement.style.setProperty(
        '--sticky-head-height',
        `${el.getBoundingClientRect().height}px`,
      );
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      // Client-side nav to a page without this component must not leave a
      // stale height behind — .collection-toolbar and the filter rail read
      // this var on every page that uses CollectionFilterSidebar, not just
      // collection pages with a category strip.
      document.documentElement.style.removeProperty('--sticky-head-height');
    };
  }, []);

  return (
    <div className="collection-sticky-head" ref={ref}>
      {children}
    </div>
  );
}
