import {useEffect, useRef, useState} from 'react';

/**
 * Social share control for product and collection pages — one trigger icon
 * that opens a compact iOS-style sheet: a horizontally-scrollable row of
 * app icons (like the native share sheet's app row) plus a short action
 * list below (Copy Link, and "More" for the system share sheet on phones).
 *
 * Replaces an earlier version that laid out one button PER platform in a
 * row — eight-plus circles across a narrow mobile viewport is what was
 * overlapping neighboring page chrome. One trigger + one positioned panel
 * can't collide with anything else on the page.
 *
 * Every target reads the CURRENT address at click time (so a chosen
 * variant's URL is what gets shared), and platforms build their preview
 * from the page's existing OG/Twitter tags — nothing here duplicates that.
 *
 * Platform reality, encoded rather than papered over: Instagram and TikTok
 * have no web share endpoint at all — sharing there is app-only. Their rows
 * copy the link and open the platform's DM inbox to paste into; on phones
 * the "More" row (native share sheet) is the first-class route into both.
 */
export function ShareButtons({
  title,
  image,
  align = 'start',
  inline = false,
}: {
  title: string;
  /** Kept for the platforms' own link preview, which they build from the
   *  page's OG tags — no share target passes it explicitly any more. */
  image?: string;
  /** Which edge of the trigger the panel hangs from — 'end' for a trigger
   *  sitting flush against the right edge of its row, so the panel opens
   *  leftward instead of running off the viewport. */
  align?: 'start' | 'end';
  /**
   * Skip the trigger and lay the icons out in one row.
   *
   * For the product details card, which has a full column of its own to spend
   * — a click to reveal a share sheet is a step for nothing there. The
   * collection toolbar keeps the panel: that row is already crowded on a phone,
   * and a row of loose icons in it is exactly what used to overlap the page
   * chrome beside it.
   */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // navigator.share only exists client-side; render after mount so server
  // and first client render agree.
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
        return;
      }
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const pageUrl = () => window.location.href;

  const openPopup = (url: string) => {
    setOpen(false);
    window.open(
      url,
      '_blank',
      'noopener,noreferrer,width=640,height=560,left=200,top=120',
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — nothing to fall back to here.
    }
  };

  /**
   * Share into a private chat on a platform with no web share endpoint: put the
   * link on the clipboard and open that platform's message inbox to paste into.
   *
   * The window opens FIRST, synchronously. `navigator.clipboard.writeText` is a
   * promise, and a `window.open` that runs after awaiting it has lost the
   * user-gesture token — Safari blocks it outright, so the shopper got a copied
   * link and no inbox.
   */
  const shareViaInbox = (destination: string) => {
    window.open(destination, '_blank', 'noopener,noreferrer');
    copyLink();
  };

  type App = {
    name: string;
    icon: React.ReactNode;
    onClick: () => void;
  };

  const apps: App[] = [
    {
      name: 'WhatsApp',
      icon: (
        <path d="M12.04 3a8.9 8.9 0 0 0-7.7 13.36L3 21l4.77-1.25A8.9 8.9 0 1 0 12.04 3zm0 16.28c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-2.83.74.76-2.76-.2-.28a7.4 7.4 0 1 1 6.77 3.63zm4.07-5.55c-.22-.11-1.32-.65-1.52-.72-.2-.08-.35-.11-.5.1-.15.23-.58.73-.71.88-.13.15-.26.17-.48.06a6 6 0 0 1-1.78-1.1 6.7 6.7 0 0 1-1.23-1.53c-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.08-.15.04-.28-.02-.39-.05-.11-.5-1.2-.68-1.65-.18-.43-.36-.37-.5-.38h-.42c-.15 0-.39.06-.6.28-.2.22-.77.76-.77 1.85s.79 2.14.9 2.29c.11.15 1.56 2.38 3.78 3.34.53.23.94.36 1.26.47.53.17 1.01.14 1.4.09.42-.06 1.31-.54 1.5-1.06.18-.52.18-.96.13-1.06-.06-.09-.2-.15-.42-.26z" />
      ),
      onClick: () =>
        openPopup(
          `https://wa.me/?text=${encodeURIComponent(`${title} ${pageUrl()}`)}`,
        ),
    },
    {
      name: 'Messenger',
      icon: (
        <path d="M12 2C6.5 2 2 6.14 2 11.5c0 2.9 1.34 5.47 3.5 7.2V22l3.2-1.76c.9.25 1.86.38 2.83.38C17.5 20.62 22 16.48 22 11.5S17.5 2 12 2zm1.03 12.1-2.7-2.88-5.27 2.88 5.8-6.16 2.77 2.88 5.2-2.88z" />
      ),
      // A prefilled Messenger send needs a Facebook App ID (the Send Dialog),
      // which this store does not have — so phones get the app's own share
      // sheet and everything else gets the inbox with the link copied. The
      // previous deep-link-only version did nothing at all on desktop.
      onClick: () =>
        isTouchDevice()
          ? shareViaInbox(
              `fb-messenger://share?link=${encodeURIComponent(pageUrl())}`,
            )
          : shareViaInbox('https://www.messenger.com/'),
    },
    {
      name: 'Facebook',
      icon: (
        <path d="M13.4 21v-8.2h2.76l.41-3.2H13.4V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14A22.8 22.8 0 0 0 14.21 3c-2.45 0-4.13 1.5-4.13 4.24v2.36H7.32v3.2h2.76V21z" />
      ),
      onClick: () => shareViaInbox('https://www.facebook.com/messages/t/'),
    },
    {
      name: 'X',
      icon: (
        <path d="M17.75 4h2.87l-6.27 7.17L21.7 20h-5.77l-4.52-5.91L6.24 20H3.36l6.7-7.66L3 4h5.92l4.09 5.4zm-1 14.28h1.59L8.03 5.63H6.32z" />
      ),
      onClick: () => shareViaInbox('https://x.com/messages'),
    },
    {
      name: 'Pinterest',
      icon: (
        <path d="M12 3a9 9 0 0 0-3.28 17.38c-.08-.72-.15-1.83.03-2.62l1.06-4.48s-.27-.54-.27-1.33c0-1.25.72-2.18 1.62-2.18.77 0 1.14.58 1.14 1.27 0 .77-.49 1.92-.74 2.99-.21.9.44 1.62 1.32 1.62 1.59 0 2.81-1.67 2.81-4.09 0-2.14-1.54-3.63-3.73-3.63a3.87 3.87 0 0 0-4.03 3.88c0 .77.3 1.59.67 2.04a.27.27 0 0 1 .06.26l-.25 1.02c-.04.16-.13.2-.3.12-1.12-.52-1.83-2.16-1.83-3.48 0-2.84 2.06-5.44 5.94-5.44 3.12 0 5.55 2.22 5.55 5.2 0 3.1-1.96 5.6-4.67 5.6-.91 0-1.77-.48-2.07-1.04l-.56 2.14c-.2.78-.75 1.76-1.12 2.36A9 9 0 1 0 12 3z" />
      ),
      onClick: () => shareViaInbox('https://www.pinterest.com/conversations/'),
    },
    {
      name: 'Telegram',
      icon: (
        <path d="M20.5 4.2 3.9 10.63c-.9.35-.87 1.62.05 1.92l4.1 1.35 1.58 4.83c.27.83 1.33 1.03 1.9.36l2.02-2.4 4.16 3.05c.7.51 1.69.13 1.86-.72l2.32-13.4c.18-1-.8-1.8-1.39-1.42zm-9.3 9.7-.63 3.02-1.2-3.9 8.9-5.75-7.07 6.63z" />
      ),
      onClick: () =>
        openPopup(
          `https://t.me/share/url?url=${encodeURIComponent(pageUrl())}&text=${encodeURIComponent(title)}`,
        ),
    },
    {
      name: 'Instagram',
      icon: (
        <path d="M12 4.6c2.41 0 2.7.01 3.65.05.88.04 1.36.19 1.68.31.42.17.72.36 1.04.68.32.32.51.62.68 1.04.12.32.27.8.31 1.68.04.95.05 1.24.05 3.64s-.01 2.7-.05 3.65c-.04.88-.19 1.36-.31 1.68-.17.42-.36.72-.68 1.04a2.8 2.8 0 0 1-1.04.68c-.32.12-.8.27-1.68.31-.95.04-1.24.05-3.65.05s-2.7-.01-3.65-.05c-.88-.04-1.36-.19-1.68-.31a2.8 2.8 0 0 1-1.04-.68 2.8 2.8 0 0 1-.68-1.04c-.12-.32-.27-.8-.31-1.68C4.61 14.7 4.6 14.4 4.6 12s.01-2.7.05-3.64c.04-.88.19-1.36.31-1.68.17-.42.36-.72.68-1.04.32-.32.62-.51 1.04-.68.32-.12.8-.27 1.68-.31.95-.04 1.24-.05 3.65-.05M12 3c-2.44 0-2.75.01-3.71.05-.96.05-1.61.2-2.19.42-.59.23-1.09.54-1.59 1.04S3.7 5.51 3.47 6.1c-.22.58-.37 1.23-.42 2.19C3.01 9.25 3 9.56 3 12s.01 2.75.05 3.71c.05.96.2 1.61.42 2.19.23.59.54 1.09 1.04 1.59s1 .81 1.59 1.04c.58.22 1.23.37 2.19.42.96.04 1.27.05 3.71.05s2.75-.01 3.71-.05c.96-.05 1.61-.2 2.19-.42a4.4 4.4 0 0 0 1.59-1.04c.5-.5.81-1 1.04-1.59.22-.58.37-1.23.42-2.19.04-.96.05-1.27.05-3.71s-.01-2.75-.05-3.71c-.05-.96-.2-1.61-.42-2.19a4.4 4.4 0 0 0-1.04-1.59c-.5-.5-1-.81-1.59-1.04-.58-.22-1.23-.37-2.19-.42C14.75 3.01 14.44 3 12 3zm0 4.38a4.62 4.62 0 1 0 0 9.24 4.62 4.62 0 0 0 0-9.24zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5.9-7.8a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0z" />
      ),
      onClick: () => shareViaInbox('https://www.instagram.com/direct/inbox/'),
    },
    {
      name: 'TikTok',
      icon: (
        <path d="M16.8 5.82a4.8 4.8 0 0 1-1.12-2.02c-.08-.32-.13-.65-.14-.98h-3.06l-.01 12.26a2.57 2.57 0 0 1-2.57 2.48 2.58 2.58 0 0 1-2.57-2.57 2.58 2.58 0 0 1 3.36-2.45V9.4a5.7 5.7 0 0 0-.79-.06 5.63 5.63 0 1 0 5.63 5.63V9.5a7.8 7.8 0 0 0 4.55 1.46V7.9a4.75 4.75 0 0 1-3.28-2.08z" />
      ),
      onClick: () => shareViaInbox('https://www.tiktok.com/messages'),
    },
  ];

  const copyIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8.5" y="8.5" width="10" height="10" rx="2" />
      <path d="M15 8.5V6.4a1.9 1.9 0 0 0-1.9-1.9H6.4A1.9 1.9 0 0 0 4.5 6.4v6.7a1.9 1.9 0 0 0 1.9 1.9H8.5" />
    </svg>
  );

  if (inline) {
    return (
      <div className="share-inline">
        <span className="share-inline-label">
          {copied ? 'Link copied' : 'Share'}
        </span>
        <div className="share-inline-row">
          {apps.map((app) => (
            <button
              key={app.name}
              type="button"
              className="share-inline-btn"
              onClick={app.onClick}
              title={`Share on ${app.name}`}
              aria-label={`Share on ${app.name}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {app.icon}
              </svg>
            </button>
          ))}
          <button
            type="button"
            className="share-inline-btn is-stroke"
            onClick={copyLink}
            title={copied ? 'Link copied' : 'Copy link'}
            aria-label={copied ? 'Link copied' : 'Copy link'}
          >
            {copied ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5.5 12.5 4 4 9-9" />
              </svg>
            ) : (
              copyIcon
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`share-wrap share-align-${align}`} ref={wrapRef}>
      <button
        type="button"
        className="share-text-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Share</span>
        {/* Same chevron glyph as the collection toolbar's Sort control. */}
        <svg className="share-text-caret" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m6 9 6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open && (
        <div className="share-panel" role="menu">
          <div className="share-apps">
            {apps.map((app) => (
              <button
                key={app.name}
                type="button"
                role="menuitem"
                className="share-app"
                onClick={app.onClick}
              >
                <span className="share-app-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {app.icon}
                  </svg>
                </span>
                <span className="share-app-label">{app.name}</span>
              </button>
            ))}
          </div>

          <div className="share-actions">
            <button type="button" role="menuitem" onClick={copyLink}>
              {copyIcon}
              {copied ? 'Link copied' : 'Copy Link'}
            </button>
            {canNativeShare && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigator.share({title, url: pageUrl()}).catch(() => {});
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="6" cy="12" r="1.9" />
                  <circle cx="17" cy="6" r="1.9" />
                  <circle cx="17" cy="18" r="1.9" />
                  <path d="M7.7 10.8 15.3 7M7.7 13.2l7.6 3.8" />
                </svg>
                More Options
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Touch device. Messenger's `fb-messenger://` deep link only resolves where the
 * app is installed; on a desktop browser it is a dead click, which is what it
 * used to be here for every desktop shopper.
 */
function isTouchDevice() {
  return (
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  );
}
