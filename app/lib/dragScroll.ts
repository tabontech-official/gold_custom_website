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
  let activePointerId: number | null = null;

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    down = true;
    // Cleared here, not only in the click handler: a drag that ends off the
    // rail fires no click, so a stale `moved` would swallow the next real
    // click on a product card.
    moved = false;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startScroll = el.scrollLeft;
  }

  function onPointerMove(event: PointerEvent) {
    if (!down) return;
    // A mouse that reports no buttons held is a pointer we never saw released
    // — the capture below can swallow `pointerup` if it lands outside, and a
    // drag stuck "on" makes the rail follow the bare cursor. Treat it as the
    // release we missed.
    if (event.buttons === 0) {
      endDrag(event.pointerId);
      return;
    }
    const dx = event.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      el.classList.add('is-dragging');
      try {
        if (activePointerId !== null) el.setPointerCapture(activePointerId);
      } catch {
        /* pointer capture can fail if the pointer already ended */
      }
    }
    if (moved) {
      event.preventDefault();
      el.scrollLeft = startScroll - dx;
    }
  }

  /** Single exit path — capture retargets events, so several can fire it. */
  function endDrag(pointerId: number) {
    if (!down) return;
    down = false;
    activePointerId = null;
    el.classList.remove('is-dragging');
    try {
      if (el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture(pointerId);
      }
    } catch {
      /* pointer was already released */
    }
  }

  function onPointerUp(event: PointerEvent) {
    endDrag(event.pointerId);
  }

  /** The window losing focus mid-drag never delivers a `pointerup` at all. */
  function onWindowBlur() {
    if (activePointerId !== null) endDrag(activePointerId);
    else down = false;
  }

  function onClickCapture(event: MouseEvent) {
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    }
  }

  // Release is bound to BOTH `el` and `window`. Once `el` captures the pointer
  // every later event retargets to it and stops reaching `window`, so a
  // window-only `pointerup` never fired and the drag stayed live after the
  // button came up — the rail then tracked the naked cursor. Listening on `el`
  // catches the captured case; `window` still catches a release that happens
  // before the 4px threshold ever set capture. `endDrag` is idempotent, so
  // whichever lands first wins and the second is a no-op.
  el.addEventListener('pointerdown', onPointerDown, {passive: false});
  window.addEventListener('pointermove', onPointerMove, {passive: false});
  el.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointerup', onPointerUp);
  // Alt-tab, a context menu, or the browser stealing the gesture ends the
  // pointer without a `pointerup`.
  el.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('blur', onWindowBlur);
  el.addEventListener('click', onClickCapture, true);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('blur', onWindowBlur);
    el.removeEventListener('click', onClickCapture, true);
  };
}

export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!ref.current) return;
    return enableDragScroll(ref.current);
  }, [ref]);
}
