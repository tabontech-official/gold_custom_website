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
  const department =
    getMegaMenuDepartmentForHandle(handle) ??
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
  // The Shopify menu is the ONLY source. A second hardcoded list used to graft
  // extra circles on (Religious Pendants under Pendants), and it keyed off the
  // page you were standing on — so the same department showed a different set
  // of circles depending on which sub-page you opened it from. Add a category
  // to the Shopify navigation menu instead and it appears here everywhere.
  //
  // No leading "All <Department>" circle either: it linked to the page you are
  // already on.
  const items: IconItem[] = menuItems;

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
