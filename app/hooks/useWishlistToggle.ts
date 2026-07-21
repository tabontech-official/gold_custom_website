import {useEffect, useMemo, useRef} from 'react';
import {useFetcher, useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import {showWishlistToast} from '~/components/WishlistToast';

type WishlistActionData = {
  wishlist?: string[];
  added?: boolean;
};

// ponytail: no manual revalidator.revalidate() here — the fetcher's own POST
// already triggers root revalidation (root.tsx shouldRevalidate: formMethod
// !== 'GET'), so calling it again just doubles the root-loader roundtrip.
export function useWishlistToggle(handle: string) {
  const root = useRouteLoaderData<RootLoader>('root');
  const fetcher = useFetcher<WishlistActionData>();
  const lastDataRef = useRef<WishlistActionData | null>(null);

  const serverWished = (root?.wishlist ?? []).includes(handle);
  const actionWished = fetcher.data?.wishlist?.includes(handle);
  const wished = actionWished ?? serverWished;
  const active = fetcher.state === 'idle' ? wished : !wished;

  useEffect(() => {
    if (!fetcher.data || fetcher.data === lastDataRef.current) return;
    lastDataRef.current = fetcher.data;

    const added = fetcher.data.added ?? fetcher.data.wishlist?.includes(handle);
    showWishlistToast({
      message: added ? 'Added to wishlist' : 'Removed from wishlist',
      severity: added ? 'success' : 'info',
    });
  }, [fetcher.data, handle]);

  return useMemo(
    () => ({
      fetcher,
      active,
    }),
    [active, fetcher],
  );
}
