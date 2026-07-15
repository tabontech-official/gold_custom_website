import {useEffect, useState} from 'react';

const EVENT_NAME = 'wishlist:toast';

type WishlistToastDetail = {
  message: string;
  severity?: 'success' | 'info';
};

export function showWishlistToast(detail: WishlistToastDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WishlistToastDetail>(EVENT_NAME, {detail}));
}

export function WishlistToast() {
  const [toast, setToast] = useState<WishlistToastDetail | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function onToast(event: Event) {
      const detail = (event as CustomEvent<WishlistToastDetail>).detail;
      setToast(detail);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setToast(null), 3200);
    }

    window.addEventListener(EVENT_NAME, onToast);
    return () => {
      window.removeEventListener(EVENT_NAME, onToast);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className={`wishlist-toast wishlist-toast-${toast.severity ?? 'success'}`}
      role="status"
      aria-live="polite"
    >
      <span>{toast.message}</span>
      <button type="button" aria-label="Close message" onClick={() => setToast(null)}>
        x
      </button>
    </div>
  );
}
