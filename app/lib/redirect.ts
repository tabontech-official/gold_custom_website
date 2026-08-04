import {redirect} from 'react-router';

export function redirectIfHandleIsLocalized(
  request: Request,
  ...localizedResources: Array<{
    handle: string;
    data: {handle: string} & unknown;
  }>
) {
  const url = new URL(request.url);
  let shouldRedirect = false;

  localizedResources.forEach(({handle, data}) => {
    if (handle !== data.handle) {
      url.pathname = url.pathname.replace(handle, data.handle);
      shouldRedirect = true;
    }
  });

  if (shouldRedirect) {
    // 301: a localized handle is a permanent canonicalization, not a temporary
    // detour. Callers are products/collections/pages — all the same case.
    throw redirect(url.toString(), 301);
  }
}
