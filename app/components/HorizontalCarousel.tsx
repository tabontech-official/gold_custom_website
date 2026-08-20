import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {enableDragScroll} from '~/lib/dragScroll';

/**
 * Horizontal scroller on native overflow, with mouse click-drag and overlay
 * prev / next buttons that page through. Item widths come from the caller's
 * item className.
 *
 * This used to be driven by Lenis. Lenis works by cancelling the browser's own
 * scroll and re-driving the position from a `requestAnimationFrame` loop — so
 * every instance held a callback running on the main thread every frame, for
 * the whole life of the page, whether or not anyone was scrolling. On the
 * product page that is two of them, competing with React, the image decode and
 * the third-party widgets for the same 16ms.
 *
 * Native overflow scrolling runs on the compositor instead, off the main
 * thread, so it keeps its frame rate even while the main thread is busy — which
 * is the situation that actually makes a page feel like it stutters. It is also
 * what every other rail in this codebase already uses (see DragScroller), so
 * the two no longer behave differently on the same gesture.
 *
 * What was given up: eased wheel scrolling on desktop. Touch was already native
 * (`syncTouch: false`), and the paging buttons still animate via
 * `scroll-behavior: smooth` on the viewport.
 */
export function HorizontalCarousel({
  children,
  className = '',
  ariaLabel = 'items',
  showButtons = true,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  showButtons?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const wrapper = viewportRef.current;
    if (!wrapper) return;
    const {scrollLeft, scrollWidth, clientWidth} = wrapper;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const wrapper = viewportRef.current;
    if (!wrapper) return;
    update();
    wrapper.addEventListener('scroll', update, {passive: true});
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    if (trackRef.current) observer.observe(trackRef.current);
    const disableDrag = enableDragScroll(wrapper);
    return () => {
      wrapper.removeEventListener('scroll', update);
      observer.disconnect();
      disableDrag();
    };
  }, [update]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const wrapper = viewportRef.current;
    if (!wrapper) return;
    const amount = direction * Math.min(wrapper.clientWidth * 0.85, 640);
    wrapper.scrollBy({left: amount, behavior: 'smooth'});
  }, []);

  return (
    <div className={`hcarousel ${className}`.trim()}>
      <div className="hcarousel-viewport" ref={viewportRef}>
        <div className="hcarousel-track" ref={trackRef}>
          {children}
        </div>
      </div>

      {showButtons && (
        <>
          <button
            type="button"
            className="hcarousel-btn hcarousel-btn-prev"
            aria-label={`Scroll ${ariaLabel} left`}
            onClick={() => scrollByPage(-1)}
            disabled={!canPrev}
          >
            <span aria-hidden="true">&#8249;</span>
          </button>
          <button
            type="button"
            className="hcarousel-btn hcarousel-btn-next"
            aria-label={`Scroll ${ariaLabel} right`}
            onClick={() => scrollByPage(1)}
            disabled={!canNext}
          >
            <span aria-hidden="true">&#8250;</span>
          </button>
        </>
      )}
    </div>
  );
}
