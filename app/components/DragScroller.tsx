import {useEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {useDragScroll} from '~/lib/dragScroll';

/**
 * Native-overflow horizontal scroller with buttery touch / trackpad momentum
 * plus mouse click-drag. `trackClassName` lets a caller switch the inner layout
 * (e.g. a dual-row grid). Optional glowing next/prev buttons page through, and
 * an optional thin iOS-style scrollbar the user can swipe.
 */
export function DragScroller({
  children,
  className = '',
  trackClassName = '',
  ariaLabel = 'items',
  showButtons = false,
  showScrollbar = false,
}: {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  ariaLabel?: string;
  showButtons?: boolean;
  showScrollbar?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDragScroll(ref);

  function page(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.min(el.clientWidth * 0.8, 620),
      behavior: 'smooth',
    });
  }

  return (
    <div className={`dragscroll ${className}`.trim()}>
      <div className="dragscroll-viewport" ref={ref}>
        <div className={`dragscroll-track ${trackClassName}`.trim()}>
          {children}
        </div>
      </div>
      {showButtons && (
        <>
          <button
            type="button"
            className="dragscroll-btn is-prev"
            aria-label={`Scroll ${ariaLabel} left`}
            onClick={() => page(-1)}
          >
            <span aria-hidden="true">&#8249;</span>
          </button>
          <button
            type="button"
            className="dragscroll-btn is-next"
            aria-label={`Scroll ${ariaLabel} right`}
            onClick={() => page(1)}
          >
            <span aria-hidden="true">&#8250;</span>
          </button>
        </>
      )}
      {showScrollbar && <ScrollProgressBar viewportRef={ref} />}
    </div>
  );
}

/** Thin, swipeable iOS-style scrollbar synced to a scroller's position. */
function ScrollProgressBar({
  viewportRef,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({width: 100, left: 0, visible: false});

  // Keep the thumb size/position in sync with scroll + content size.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const viewport = vp;
    function update() {
      const {clientWidth, scrollWidth, scrollLeft} = viewport;
      if (scrollWidth <= clientWidth + 1) {
        setThumb((t) => (t.visible ? {...t, visible: false} : t));
        return;
      }
      const width = Math.max((clientWidth / scrollWidth) * 100, 12);
      const maxScroll = scrollWidth - clientWidth;
      const left = (scrollLeft / maxScroll) * (100 - width);
      setThumb({width, left, visible: true});
    }
    update();
    viewport.addEventListener('scroll', update, {passive: true});
    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    if (viewport.firstElementChild) ro.observe(viewport.firstElementChild);
    return () => {
      viewport.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [viewportRef]);

  // Drag / tap the bar to scroll the rail.
  useEffect(() => {
    const track = trackRef.current;
    const vp = viewportRef.current;
    if (!track || !vp) return;
    const barTrack = track;
    const viewport = vp;
    let dragging = false;

    function scrollToClientX(clientX: number) {
      const rect = barTrack.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      viewport.scrollLeft = ratio * (viewport.scrollWidth - viewport.clientWidth);
    }
    function onDown(e: PointerEvent) {
      dragging = true;
      viewport.classList.add('is-dragging'); // reuse: disables smooth-scroll while dragging
      barTrack.setPointerCapture(e.pointerId);
      scrollToClientX(e.clientX);
    }
    function onMove(e: PointerEvent) {
      if (dragging) scrollToClientX(e.clientX);
    }
    function onUp(e: PointerEvent) {
      dragging = false;
      viewport.classList.remove('is-dragging');
      try {
        barTrack.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    barTrack.addEventListener('pointerdown', onDown);
    barTrack.addEventListener('pointermove', onMove);
    barTrack.addEventListener('pointerup', onUp);
    return () => {
      barTrack.removeEventListener('pointerdown', onDown);
      barTrack.removeEventListener('pointermove', onMove);
      barTrack.removeEventListener('pointerup', onUp);
    };
  }, [viewportRef]);

  if (!thumb.visible) return null;

  return (
    <div className="dragscroll-bar" ref={trackRef} aria-hidden="true">
      <div
        className="dragscroll-bar-thumb"
        style={{width: `${thumb.width}%`, left: `${thumb.left}%`}}
      />
    </div>
  );
}
