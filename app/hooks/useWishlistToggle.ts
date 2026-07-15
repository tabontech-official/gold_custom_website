import {useEffect, useMemo, useRef} from 'react';
import {useFetcher, useRevalidator, useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import {showWishlistToast} from '~/components/WishlistToast';

type WishlistActionData = {
  wishlist?: string[];
  added?: boolean;
};

export function useWishlistToggle(handle: string) {
  const root = useRouteLoaderData<RootLoader>('root');
  const fetcher = useFetcher<WishlistActionData>();
  const revalidator = useRevalidator();
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
    revalidator.revalidate();
  }, [fetcher.data, handle, revalidator]);

  return useMemo(
    () => ({
      fetcher,
      active,
    }),
    [active, fetcher],
  );
}
