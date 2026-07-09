import {ReactLenis, type LenisRef} from 'lenis/react';
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {enableDragScroll} from '~/lib/dragScroll';

/**
 * Horizontal scroller powered by Lenis for smooth wheel / trackpad scrolling on
 * desktop and native momentum on touch. Renders overlay prev / next buttons that
 * page through the content. Item widths come from the caller's item className.
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
  const lenisRef = useRef<LenisRef>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const wrapper = lenisRef.current?.wrapper;
    if (!wrapper) return;
    const {scrollLeft, scrollWidth, clientWidth} = wrapper;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const wrapper = lenisRef.current?.wrapper;
    const content = lenisRef.current?.content;
    if (!wrapper) return;
    update();
    wrapper.addEventListener('scroll', update, {passive: true});
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    if (content) observer.observe(content);
    const disableDrag = enableDragScroll(wrapper);
    return () => {
      wrapper.removeEventListener('scroll', update);
      observer.disconnect();
      disableDrag();
    };
  }, [update]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const wrapper = lenisRef.current?.wrapper;
    if (!wrapper) return;
    const amount = direction * Math.min(wrapper.clientWidth * 0.85, 640);
    const target = wrapper.scrollLeft + amount;
    const lenis = lenisRef.current?.lenis;
    if (lenis) lenis.scrollTo(target);
    else wrapper.scrollTo({left: target, behavior: 'smooth'});
  }, []);

  return (
    <div className={`hcarousel ${className}`.trim()}>
      <ReactLenis
        ref={lenisRef}
        className="hcarousel-viewport"
        options={{
          orientation: 'horizontal',
          gestureOrientation: 'horizontal',
          smoothWheel: true,
          syncTouch: false,
          duration: 0.9,
        }}
      >
        <div className="hcarousel-track">{children}</div>
      </ReactLenis>

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
