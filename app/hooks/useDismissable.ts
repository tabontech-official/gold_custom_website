import {useEffect, useRef} from 'react';

/**
 * Closes a popover when the pointer goes down outside it or Escape is pressed.
 * Attach the returned ref to the element that wraps both trigger and panel.
 */
export function useDismissable<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
) {
  const ref = useRef<T>(null);
  // Read the latest callback without re-binding listeners on every render.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) dismiss.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss.current();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return ref;
}
