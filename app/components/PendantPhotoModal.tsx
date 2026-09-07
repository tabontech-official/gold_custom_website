import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {PENDANT_PHOTO_ACCEPT, pendantPhotoError} from '~/lib/pendantPhoto';

/**
 * "Add gallery photo" button + modal for Picture Pendant products.
 *
 * Same shape as AppointmentModal — a purchase-column button that opens a
 * portalled dialog — and it borrows that modal's shell classes rather than
 * introducing a second overlay style, so the two dialogs on a product page read
 * as one system.
 *
 * The photo is picked and previewed locally first and only uploaded when the
 * shopper confirms, so cancelling costs nothing and someone flicking through
 * three photos uploads one. The preview sits in a circular gold bezel because
 * that is the pendant — a round gold frame with the picture set inside it.
 *
 * The URL that goes on the cart line is lifted to the product page through
 * `onChange`; this component never touches the cart.
 */
export function PendantPhotoModal({
  productTitle,
  url,
  onChange,
}: {
  productTitle: string;
  /** Uploaded photo URL, or undefined when nothing is saved yet. */
  url?: string;
  onChange: (url?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Portal target only exists client-side; gate on mount so SSR skips it.
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Object URLs are a manual allocation: one per file the shopper picks, freed
  // when it is replaced or the dialog goes away, or someone who tries six
  // photos leaves six images pinned in memory.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Close on Escape and lock body scroll while open — same behaviour as the
  // consultation dialog, so the two feel like one control.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pick(chosen?: File | null) {
    if (!chosen) return;
    const invalid = pendantPhotoError(chosen);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(undefined);
    setFile(chosen);
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(chosen);
    });
  }

  function close() {
    // Cancelling discards the pending pick and leaves whatever was already
    // saved alone — closing the dialog is not a way to lose your photo.
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return undefined;
    });
    setFile(undefined);
    setError(undefined);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
    setOpen(false);
  }

  async function upload() {
    if (!file) return;
    setError(undefined);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('photo', file);
      body.append('product', productTitle);
      const response = await fetch('/api/pendant-photo', {
        method: 'POST',
        body,
      });
      const result = (await response.json()) as {url?: string; error?: string};
      if (!result.url) {
        setError(result.error ?? 'That photo did not save. Try again.');
        return;
      }
      onChange(result.url);
      close();
    } catch {
      setError('That photo did not save. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {url ? (
        // Saved. The thumbnail is the confirmation, and both ways out of this
        // state are on the surface — a shopper should not have to open a dialog
        // to find out how to remove a photo they no longer want.
        <div className="pendant-photo-saved">
          <img className="pendant-photo-saved-thumb" src={url} alt="" />
          <div className="pendant-photo-saved-body">
            <p className="pendant-photo-saved-title">
              <CheckIcon />
              Photo attached
            </p>
            <p className="pendant-photo-saved-note">
              We&apos;ll set this picture into the pendant frame.
            </p>
            <div className="pendant-photo-saved-actions">
              <button
                type="button"
                className="pendant-photo-saved-btn"
                onClick={() => setOpen(true)}
              >
                Change photo
              </button>
              <button
                type="button"
                className="pendant-photo-saved-btn is-remove"
                onClick={() => onChange(undefined)}
              >
                Remove photo
              </button>
            </div>
          </div>
        </div>
      ) : (
        // No photo, so there is no Add to bag on the page — this is the only
        // call to action in the buy row and it is styled as one.
        <button
          type="button"
          className="btn product-atc product-purchase-action pendant-photo-cta"
          onClick={() => setOpen(true)}
        >
          <PortraitIcon />
          Add your photo
        </button>
      )}

      {open &&
        mounted &&
        createPortal(
          <div
            className="appt-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Add gallery photo"
          >
            <button
              className="appt-overlay-scrim"
              aria-label="Close"
              onClick={close}
            />
            <div className="appt-modal pendant-modal">
              <button
                type="button"
                className="appt-close"
                onClick={close}
                aria-label="Close"
              >
                &times;
              </button>

              <header className="pendant-modal-head">
                <h2>Add gallery photo</h2>
                <p>{productTitle}</p>
              </header>

              <div className="pendant-modal-body">
                <div
                  className={
                    dragging
                      ? 'pendant-modal-drop is-dragging'
                      : 'pendant-modal-drop'
                  }
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    pick(event.dataTransfer.files?.[0]);
                  }}
                >
                  {preview ? (
                    <>
                      <span className="pendant-photo-bezel has-image">
                        <img
                          src={preview}
                          alt="Your picture, shown in the pendant frame"
                        />
                        {uploading && (
                          <span
                            className="pendant-photo-progress"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <p className="pendant-modal-filename">{file?.name}</p>
                      <button
                        type="button"
                        className="pendant-modal-link"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                      >
                        Choose a different photo
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="pendant-modal-select"
                        onClick={() => inputRef.current?.click()}
                      >
                        <UploadIcon />
                        Select photo
                      </button>
                      <p className="pendant-modal-hint">
                        or drag and drop it here
                      </p>
                    </>
                  )}
                </div>

                <ul className="pendant-modal-notes">
                  <li>
                    Upload the picture you want set into the pendant. We size
                    and crop it to the frame for you.
                  </li>
                  <li>JPG, PNG or WEBP, up to 10MB.</li>
                  <li>
                    One photo per pendant. Ordering two? Add each pendant to
                    your bag with its own photo.
                  </li>
                  <li>
                    Faces read best centred and close. The frame is round, so
                    the edges of a wide photo are trimmed.
                  </li>
                </ul>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept={PENDANT_PHOTO_ACCEPT}
                className="pendant-photo-input"
                onChange={(event) => pick(event.currentTarget.files?.[0])}
              />

              {error && (
                <p className="pendant-modal-error" role="alert">
                  {error}
                </p>
              )}

              <footer className="pendant-modal-foot">
                <button
                  type="button"
                  className="pendant-modal-btn"
                  onClick={close}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pendant-modal-btn is-primary"
                  onClick={upload}
                  disabled={!file || uploading}
                >
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

/** A shoulders-up portrait — what actually goes in one of these. */
function PortraitIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9.2" r="3.5" />
      <path d="M5.6 19.2a6.6 6.6 0 0 1 12.8 0" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4.8" />
      <path d="M7.6 9.2 12 4.8l4.4 4.4" />
      <path d="M4.5 15.5v2.6a1.4 1.4 0 0 0 1.4 1.4h12.2a1.4 1.4 0 0 0 1.4-1.4v-2.6" />
    </svg>
  );
}
