import {useLocation} from 'react-router';
import type {SelectedOption} from '@shopify/hydrogen/storefront-api-types';
import {useMemo} from 'react';

/**
 * Drops Shopify's synthetic `Title: Default Title`, the single option it gives
 * a product that has no real ones.
 *
 * Written into a URL that option becomes `?Title=Default+Title` — noise that
 * means nothing to a shopper or a crawler, that changes the address bar under
 * the buyer after the page has already loaded, and that then gets shared and
 * indexed. Products with genuine options are untouched.
 */
export function meaningfulSelectedOptions(
  selectedOptions?: SelectedOption[] | null,
) {
  return (selectedOptions ?? []).filter(
    (option) => !(option.name === 'Title' && option.value === 'Default Title'),
  );
}

export function useVariantUrl(
  handle: string,
  selectedOptions?: SelectedOption[],
) {
  const {pathname} = useLocation();

  return useMemo(() => {
    return getVariantUrl({
      handle,
      pathname,
      searchParams: new URLSearchParams(),
      selectedOptions,
    });
  }, [handle, selectedOptions, pathname]);
}

export function getVariantUrl({
  handle,
  pathname,
  searchParams,
  selectedOptions,
}: {
  handle: string;
  pathname: string;
  searchParams: URLSearchParams;
  selectedOptions?: SelectedOption[];
}) {
  const match = /(\/[a-zA-Z]{2}-[a-zA-Z]{2}\/)/g.exec(pathname);
  const isLocalePathname = match && match.length > 0;

  const path = isLocalePathname
    ? `${match![0]}products/${handle}`
    : `/products/${handle}`;

  meaningfulSelectedOptions(selectedOptions).forEach((option) => {
    searchParams.set(option.name, option.value);
  });

  const searchString = searchParams.toString();

  return path + (searchString ? '?' + searchParams.toString() : '');
}
