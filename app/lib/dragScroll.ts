import {useEffect, type RefObject} from 'react';

/**
 * Click-and-drag horizontal scrolling for the mouse. Touch, trackpad and wheel
 * are intentionally left to the browser's native momentum scrolling (already
 * buttery), so we only add the one gesture the platform lacks: mouse drag.
 *
 * Adds `is-dragging` to the element while a drag is active and swallows the
 * click that would otherwise fire on a child link once the pointer has moved.
 */
export function enableDragScroll(el: HTMLElement): () => void {
  let down = false;
  let moved = false;
  let startX = 0;
  let startScroll = 0;

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    down = true;
    moved = false;
    startX = event.clientX;
    startScroll = el.scrollLeft;
  }

  function onPointerMove(event: PointerEvent) {
    if (!down) return;
    const dx = event.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      el.classList.add('is-dragging');
    }
    if (moved) el.scrollLeft = startScroll - dx;
  }

  function onPointerUp() {
    if (!down) return;
    down = false;
    el.classList.remove('is-dragging');
  }

  function onClickCapture(event: MouseEvent) {
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    }
  }

  el.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  el.addEventListener('click', onClickCapture, true);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('click', onClickCapture, true);
  };
}

export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!ref.current) return;
    return enableDragScroll(ref.current);
  }, [ref]);
}
