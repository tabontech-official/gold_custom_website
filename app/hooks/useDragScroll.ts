import {useEffect, type RefObject} from 'react';

export function useDragScroll(trackRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let activePointerId = -1;
    const dragThreshold = 8;

    const onPointerDown = (event: PointerEvent) => {
      // Only hijack mouse dragging. Touch / pen keep native momentum scrolling
      // and native tap behavior, so touch scrolling and taps work untouched.
      if (event.pointerType !== 'mouse') return;
      if (event.button !== 0) return;
      isPointerDown = true;
      isDragging = false;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = track.scrollLeft;
      // NOTE: do NOT setPointerCapture here. Capturing on a plain click makes
      // the browser dispatch the click to the track instead of the product
      // link, which breaks navigation. We only capture once a drag begins.
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isPointerDown) return;
      const walk = event.clientX - startX;
      if (!isDragging) {
        if (Math.abs(walk) < dragThreshold) return;
        // A real drag has started: now take over the pointer.
        isDragging = true;
        track.classList.add('is-dragging');
        try {
          track.setPointerCapture(activePointerId);
        } catch {
          // ignore — capture is best-effort
        }
      }
      track.scrollLeft = startScrollLeft - walk;
      event.preventDefault();
    };

    const stopDrag = (event?: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      if (event && track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
      track.classList.remove('is-dragging');
      // Keep `isDragging` true so the click fired right after a drag is
      // suppressed by onClick below; it is reset there or on next pointerdown.
    };

    const onClick = (event: MouseEvent) => {
      // Swallow the click that trails a drag so dragging never navigates.
      // A plain click (no drag) leaves isDragging false and passes through.
      if (isDragging) {
        event.preventDefault();
        event.stopPropagation();
        isDragging = false;
      }
    };

    track.addEventListener('pointerdown', onPointerDown, {passive: false});
    track.addEventListener('pointermove', onPointerMove, {passive: false});
    track.addEventListener('pointerup', stopDrag);
    track.addEventListener('pointerleave', stopDrag);
    track.addEventListener('pointercancel', stopDrag);
    track.addEventListener('click', onClick, true);

    return () => {
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', stopDrag);
      track.removeEventListener('pointerleave', stopDrag);
      track.removeEventListener('pointercancel', stopDrag);
      track.removeEventListener('click', onClick, true);
    };
  }, [trackRef]);
}
