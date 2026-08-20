import {useEffect, useState} from 'react';
import {NavLink} from 'react-router';
import type {HeaderQuery} from 'storefrontapi.generated';
import {DragScroller} from '~/components/DragScroller';
import {
  getColumnItems,
  getDepartmentItems,
  getMegaMenuDepartmentForHandle,
  MEGA_MENU,
  toRelativeUrl,
} from '~/lib/megaMenu';

type IconItem = {key: string; title: string; to: string; handle: string};

// Add a collection here only when it belongs to a parent department but is
// absent from that department's Shopify navigation menu. This keeps one
// controlled extension point for future product groups and avoids duplicates.
const SUPPLEMENTAL_SUBCATEGORIES: Record<
  string,
  Array<{title: string; handle: string}>
> = {
  pendants: [{title: 'Religious Pendants', handle: 'religious-pendants'}],
};

function collectionHandleFromPath(path: string): string | null {
  const match = path.match(/\/collections\/([^/?#]+)/);
  return match ? match[1] : null;
}

/**
 * Circular image strip of the current department's sub-categories, one photo
 * per sub-category (the collection's first product image). Same links as
 * CollectionSubNav, just shown as icons like the reference sale page.
 */
export function CollectionSubNavIcons({
  handle,
  header,
  publicStoreDomain,
}: {
  handle: string;
  header: HeaderQuery;
  publicStoreDomain: string;
}) {
  const primaryDomainUrl = header.shop.primaryDomain.url;
  const currentPath = `/collections/${handle}`;
  const supplementalParentHandle = Object.entries(
    SUPPLEMENTAL_SUBCATEGORIES,
  ).find(
    ([parentHandle, subcategories]) =>
      parentHandle === handle ||
      subcategories.some((subcategory) => subcategory.handle === handle),
  )?.[0];
  const department =
    getMegaMenuDepartmentForHandle(supplementalParentHandle ?? handle) ??
    MEGA_MENU.find((menuDepartment) =>
      menuDepartment.columns.some((column) =>
        getColumnItems(header, column).some((item) => {
          if (!item.url) return false;
          return (
            toRelativeUrl(item.url, primaryDomainUrl, publicStoreDomain) ===
            currentPath
          );
        }),
      ),
    );

  // getDepartmentItems, the same source the header dropdown renders from, so
  // the circles carry identical labels. Building the list here from raw
  // getColumnItems meant the strip missed the dropdown's dedupe and per-menu
  // hides, and could show a category the dropdown had already dropped.
  const menuItems: IconItem[] = department
    ? getDepartmentItems(header, department)
        .flatMap((item) => {
          if (!item.url) return [];
          const to = toRelativeUrl(
            item.url,
            primaryDomainUrl,
            publicStoreDomain,
          );
          const itemHandle = collectionHandleFromPath(to);
          return itemHandle
            ? [{key: item.id, title: item.title, to, handle: itemHandle}]
            : [];
        })
    : [];
  const supplementalItems =
    SUPPLEMENTAL_SUBCATEGORIES[supplementalParentHandle ?? ''] ?? [];
  const seenHandles = new Set(menuItems.map((item) => item.handle));
  // No leading "All <Department>" circle: the department landing page is
  // already where the strip is shown from, so it was a circle linking to the
  // page you are standing on.
  const items: IconItem[] = department
    ? [
        ...menuItems,
        ...supplementalItems
          .filter((item) => !seenHandles.has(item.handle))
          .map((item) => ({
            key: item.handle,
            title: item.title,
            to: `/collections/${item.handle}`,
            handle: item.handle,
          })),
      ]
    : [];

  const images = useSubCategoryImages(items.map((item) => item.handle));
  if (!items.length) return null;

  return (
    <DragScroller
      className="subnav-icons"
      trackClassName="subnav-icons-track"
      aria-label={`${department?.label} subcategories`}
      showScrollbar
    >
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end
          className={({isActive}) =>
            isActive ? 'subnav-icon is-active' : 'subnav-icon'
          }
        >
          <span className="subnav-icon-circle">
            {images[item.handle] ? (
              <img src={images[item.handle]} alt={item.title} loading="lazy" />
            ) : (
              <span aria-hidden="true">{item.title.charAt(0)}</span>
            )}
          </span>
          <span className="subnav-icon-label">{item.title}</span>
        </NavLink>
      ))}
    </DragScroller>
  );
}

// ponytail: one /api fetch per sub-category (handful of them), responses are
// cached by the API route. Batch into a single query if the strip grows large.
function useSubCategoryImages(handles: string[]) {
  const [images, setImages] = useState<Record<string, string>>({});
  const key = handles.join(',');

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      handles.map(async (handle) => {
        if (!handle) return [handle, ''] as const;
        try {
          const res = await fetch(
            `/api/collection-products?handle=${encodeURIComponent(handle)}`,
          );
          const data = (await res.json()) as {products?: any[]; image?: any};
          // Collection's own featured image first; first product image only as
          // a fallback for collections that have no image set in Shopify.
          const url =
            data?.image?.url ??
            data?.products?.find((product: any) => product?.featuredImage?.url)
              ?.featuredImage?.url;
          return [handle, url ?? ''] as const;
        } catch {
          return [handle, ''] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setImages(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return images;
}
