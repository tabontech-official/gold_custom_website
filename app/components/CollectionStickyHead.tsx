import {useEffect, useLayoutEffect, useRef, type ReactNode} from 'react';

// useLayoutEffect warns during SSR (it cannot run there); useEffect is the
// same no-op without the warning. The measurement is client-only work.
const useClientLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Wraps the collection heading + category icon strip so both stay pinned
 * under the header while scrolling. Rendered height varies (title can wrap
 * to two lines, the icon strip differs per breakpoint), so it's measured
 * live and exposed as --sticky-head-height for .collection-toolbar to stack
 * under — a fixed guess would drift out of sync with real content.
 */
export function CollectionStickyHead({children}: {children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);

  useClientLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const setHeight = () =>
      document.documentElement.style.setProperty(
        '--sticky-head-height',
        // Whole pixels: a fractional offset puts the toolbar's sticky edge
        // on a different sub-pixel boundary from this box's bottom edge.
        `${Math.ceil(el.getBoundingClientRect().height)}px`,
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

  // `is-stuck` while the box is pinned. app.css moves it (and the toolbar)
  // up with the hiding header via a transform, which must not apply while
  // the box is still in normal flow. A zero-height sentinel sits where the
  // box's natural top is: once that scrolls above the pin offset, the box is
  // stuck. IntersectionObserver so nothing runs per scroll frame on iOS.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel) return;
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      const pin = parseFloat(getComputedStyle(el).top) || 0;
      observer = new IntersectionObserver(
        ([entry]) =>
          el.classList.toggle(
            'is-stuck',
            !entry.isIntersecting && entry.boundingClientRect.top < pin,
          ),
        {rootMargin: `-${Math.ceil(pin)}px 0px 0px 0px`},
      );
      observer.observe(sentinel);
    };
    observe();
    // The pin offset changes with the breakpoint.
    window.addEventListener('resize', observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', observe);
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      <div className="collection-sticky-head" ref={ref}>
        {children}
      </div>
    </>
  );
}
