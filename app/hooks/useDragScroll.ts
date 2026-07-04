import {useEffect, type RefObject} from 'react';

export function useDragScroll(trackRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      isDragging = true;
      track.setPointerCapture(event.pointerId);
      const rect = track.getBoundingClientRect();
      startX = event.clientX - rect.left;
      startScrollLeft = track.scrollLeft;
      track.classList.add('is-dragging');
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) return;
      const rect = track.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const walk = x - startX;
      track.scrollLeft = startScrollLeft - walk;
      event.preventDefault();
    };

    const stopDrag = (event?: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (event && track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
      track.classList.remove('is-dragging');
    };

    track.addEventListener('pointerdown', onPointerDown, {passive: false});
    track.addEventListener('pointermove', onPointerMove, {passive: false});
    track.addEventListener('pointerup', stopDrag);
    track.addEventListener('pointerleave', stopDrag);
    track.addEventListener('pointercancel', stopDrag);

    return () => {
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', stopDrag);
      track.removeEventListener('pointerleave', stopDrag);
      track.removeEventListener('pointercancel', stopDrag);
    };
  }, [trackRef]);
}
