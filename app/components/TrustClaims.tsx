import type {TrustClaimIcon} from '~/lib/trustClaims';

/**
 * The line-art icon for each claim. Kept beside the claims rather than inside
 * one consumer so the product page and the collection strip cannot end up
 * drawing different pictures for the same promise.
 */
export function TrustClaimIconArt({name}: {name: TrustClaimIcon}) {
  switch (name) {
    case 'shipping':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M8 20h28v25H8" />
          <path d="M36 28h10l8 9v8H36" />
          <path d="M14 48a5 5 0 1 0 10 0 5 5 0 0 0-10 0ZM43 48a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z" />
          <path d="M3 28h16M6 36h13" />
        </svg>
      );
    case 'returns':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M18 45h28l-5-16H23l-5 16Z" />
          <path d="M27 45h28l-6-16h-8" />
          <path d="M32 8v9M15 14l6 7M49 14l-6 7" />
        </svg>
      );
    case 'usa':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 58s18-17 18-33a18 18 0 0 0-36 0c0 16 18 33 18 33Z" />
          <circle cx="32" cy="25" r="7" />
        </svg>
      );
    case 'warranty':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 6 50 13v14c0 15-8 25-18 31-10-6-18-16-18-31V13l18-7Z" />
          <path d="m23 32 6 6 13-15" />
        </svg>
      );
  }
}
