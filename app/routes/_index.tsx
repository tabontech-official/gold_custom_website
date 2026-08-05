import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useRef, useState} from 'react';
import type {
  RecommendedProductsQuery,
  NewArrivalsByGenderQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {MarketBar} from '~/components/MarketBar';
import {CoverflowCarousel} from '~/components/CoverflowCarousel';
import {DragScroller} from '~/components/DragScroller';
import {CATEGORIES as CATEGORY_CONFIG} from '~/lib/categories';
import {cdnWidth} from '~/lib/cdnImage';
import {SITE, pageSeo, rootDataFrom, siteOrigin} from '~/lib/seo';
import {FaqAccordion} from '~/components/FaqAccordion';
import {FAQS_QUERY, parseFaqs} from '~/lib/faqs';
import {getGoldRates} from '~/lib/goldRates';
import {
  VideoCarousel,
  type VideoCarouselItem,
} from '~/components/VideoCarousel';

export const meta: Route.MetaFunction = ({matches}) => {
  const origin = siteOrigin(rootDataFrom(matches));

  return pageSeo({
    // The store's own homepage title, as authored in Shopify's Online Store
    // preferences. It already carries the brand, so no template is applied.
    title: 'Real 10K & 14K Solid Gold Jewelry | Gold Custom LA',
    titleTemplate: '%s',
    description: SITE.description,
    url: origin,
  });
};

/** The `text_position` dropdown in Shopify: left | right | up. */
type HeroPosition = 'left' | 'right' | 'up';

type HeroSlide = {
  image: string;
  /** Words that sit on this banner. Authored per slide in Shopify. */
  text: string | null;
  /** Where on the banner the words sit — authored per slide. */
  position: HeroPosition;
};

type HeroContent = {
  slides: HeroSlide[];
  coverImage: string | null;
  /** Portrait slides for phones; empty falls back to the desktop `slides`. */
  mobileSlides: HeroSlide[];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  // Banners, category tiles, badges and FAQs are authored content that changes
  // a few times a year, but on the storefront default (CacheShort: 1s) every
  // single homepage hit paid four live Storefront round-trips before a byte
  // went out — which is most of what made this page slow to start.
  // The featured-collection query stays on the default: it carries prices.
  const cache = context.storefront.CacheLong();
  const [
    {collections},
    categoryResponse,
    trustBadgesResponse,
    heroResponse,
    faqsResponse,
    goldRates,
  ] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    context.storefront.query(SHOP_BY_CATEGORIES_QUERY, {cache}),
    context.storefront
      .query(TRUST_BADGES_QUERY, {cache})
      .catch((error: Error) => {
        console.error(error);
        return null;
      }),
    context.storefront.query(HERO_CONTENT_QUERY, {cache}).catch((error: Error) => {
      console.error(error);
      return null;
    }),
    context.storefront.query(FAQS_QUERY, {cache}).catch((error: Error) => {
      console.error(error);
      return null;
    }),
    getGoldRates(context.withCache, context.env),
  ]);

  return {
    // "Featured" is the most recently updated collection, so editing ANY
    // collection in the admin re-points this rail. Empty collections exist
    // (Baby Earrings, Chino Links…), and landing on one blanked the homepage
    // showcase — hence scanning for the first one that actually has products
    // instead of blindly taking nodes[0].
    featuredCollection:
      collections.nodes.find((node) => node.products?.nodes?.length) ??
      collections.nodes[0],
    categories: [
      categoryResponse.rings,
      categoryResponse.chains,
      categoryResponse.bracelets,
      categoryResponse.earrings,
      categoryResponse.pendants,
      categoryResponse.necklaces,
      categoryResponse.charms,
      categoryResponse.diamond,
      categoryResponse.engagementRings,
    ].filter(Boolean),
    trustBadges: parseTrustBadges(trustBadgesResponse),
    hero: parseHeroContent(heroResponse),
    // pages_faqs is the dedicated homepage FAQ source. Collection pages read
    // their own linked metafields instead, so no collection FAQ can leak here.
    faqs: parseFaqs(faqsResponse),
    goldRates,
  };
}

// Pull ordered image URLs + heading out of one hero_content entry's fields.
// Images sort by the numeric suffix in their key (image1, image2, …) so they
// stay in author-defined order regardless of API field order.
function extractHeroFields(fields: any): {
  images: string[];
  heading: string | null;
} {
  if (!Array.isArray(fields)) return {images: [], heading: null};

  const imageFields: {order: number; url: string}[] = [];
  let heading: string | null = null;
  for (const field of fields as any[]) {
    const url = field?.reference?.image?.url;
    const rawKey = String(field?.key ?? '');
    const key = rawKey.replace(/[-_\s]+/g, '').toLowerCase();
    if (url) {
      const order = Number(rawKey.match(/(\d+)/)?.[1] ?? imageFields.length + 1);
      imageFields.push({order, url});
    }
    if (
      !heading &&
      field?.value &&
      /^(headline|heading|imageheading|herotext)$/.test(key)
    ) {
      heading = field.value;
    }
  }

  return {
    images: imageFields.sort((a, b) => a.order - b.order).map((f) => f.url),
    heading,
  };
}

// Flatten one `hero_section` entry into a slide. Field keys come straight from
// the metaobject definition: image / image_text / text_position.
function toHeroSlide(entry: any): HeroSlide | null {
  if (!Array.isArray(entry?.fields)) return null;

  let image: string | null = null;
  let text: string | null = null;
  let position: HeroPosition = 'left';

  for (const field of entry.fields as any[]) {
    const key = String(field?.key ?? '')
      .replace(/[-_\s]+/g, '')
      .toLowerCase();
    const url = field?.reference?.image?.url;
    if (url && !image) image = url;
    if (key === 'imagetext' && field?.value) text = String(field.value).trim();
    // The authored dropdown. An unrecognised value falls back to `left` rather
    // than leaking the raw string into a data attribute.
    if (key === 'textposition') {
      const value = String(field?.value ?? '').trim().toLowerCase();
      if (value === 'right' || value === 'up' || value === 'left') {
        position = value;
      }
    }
  }

  return image ? {image, text, position} : null;
}

// `web_hero_section` holds image1..imageN pointing at hero_section entries.
// Slides sort by the numeric suffix in the key so they keep the author's order
// regardless of the order the API returns fields in.
function parseHeroSlides(container: any): HeroSlide[] {
  if (!Array.isArray(container?.fields)) return [];

  const ordered: {order: number; slide: HeroSlide}[] = [];
  for (const field of container.fields as any[]) {
    const order = Number(String(field?.key ?? '').match(/(\d+)/)?.[1] ?? 999);
    // image1 is a list reference, image2+ are single references.
    const entries = [
      ...(field?.references?.nodes ?? []),
      ...(field?.reference ? [field.reference] : []),
    ];
    for (const entry of entries) {
      const slide = toHeroSlide(entry);
      if (slide) ordered.push({order, slide});
    }
  }

  return ordered.sort((a, b) => a.order - b.order).map((o) => o.slide);
}

// Desktop slides drive the rotating banner and its per-slide words; the mobile
// entry's populated images become the mobile slider (empty → falls back to the
// desktop banners). Duplicate URLs are collapsed so the same file isn't slid
// twice. See HERO_CONTENT_QUERY.
function parseHeroContent(response: any): HeroContent | null {
  const slides = parseHeroSlides(response?.desktop);
  const mobileSlides = parseHeroSlides(response?.mobile);
  const cover = extractHeroFields(response?.cover?.fields);
  if (!slides.length && !mobileSlides.length) return null;

  return {
    slides,
    coverImage: cover.images[4] ?? null,
    mobileSlides,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  const bestSellingProducts = context.storefront
    .query(BEST_SELLING_PRODUCTS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });


  const genderNewArrivals = context.storefront
    .query(NEW_ARRIVALS_BY_GENDER_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  const journalArticles = context.storefront
    .query(HOME_ARTICLES_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  // Paired with the commented-out <TikTokVideosSection /> in Homepage — the
  // section is off, so don't spend a subrequest fetching for it.
  // const tiktokVideos = context.storefront
  //   .query(TIKTOK_VIDEOS_QUERY)
  //   .catch((error: Error) => {
  //     console.error(error);
  //     return null;
  //   });

  return {
    recommendedProducts,
    bestSellingProducts,
    genderNewArrivals,
    journalArticles,
    // tiktokVideos,
  };
}
// The "Tiktok videos" metaobject holds three reference fields pointing at
// individual "tiktok video detail" metaobjects: video_1 is a list (for
// historical reasons), video_2/video_3 are single references. Collect
// whichever of the three are populated into one flat list.
function parseTikTokVideos(response: any): VideoCarouselItem[] {
  const fields = response?.metaobjects?.nodes?.[0]?.fields;
  if (!Array.isArray(fields)) return [];

  const detailRefs: any[] = [];
  for (const field of fields as any[]) {
    if (field?.key === 'video_1' && Array.isArray(field.references?.nodes)) {
      detailRefs.push(...field.references.nodes);
    } else if (field?.reference) {
      detailRefs.push(field.reference);
    }
  }

  return detailRefs
    .map((detail, index): VideoCarouselItem | null => {
      if (!Array.isArray(detail?.fields)) return null;
      const detailFields = detail.fields as any[];
      const videoField: any = detailFields.find((f) => f.key === 'video');
      const descriptionField: any = detailFields.find(
        (f) => f.key === 'description',
      );
      const source = videoField?.reference?.sources?.find(
        (s: any) => s.mimeType === 'video/mp4',
      );
      if (!source?.url) return null;
      return {
        id: detail.id ?? String(index),
        video: source.url,
        poster: videoField.reference?.previewImage?.url ?? null,
        description: descriptionField?.value ?? null,
      };
    })
    .filter((item): item is VideoCarouselItem => item !== null);
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <Hero content={data.hero} />
      <MarketBar rates={data.goldRates} />
      <ShopByCategory categories={data.categories} />
      <TrustPromise badges={data.trustBadges} />
      <RecommendedProducts
        products={data.recommendedProducts}
        genderNewArrivals={data.genderNewArrivals}
      />
      <DiamondValueSection image={data.hero?.coverImage ?? null} />
      <FeaturedProducts
        collection={data.featuredCollection}
        bestSelling={data.bestSellingProducts}
      />
      <FaqAccordion faqs={data.faqs} />
      {/* TikTok rail off for now — uncomment this and the `tiktokVideos`
          query in loadDeferredData below to bring it back. */}
      {/* <TikTokVideosSection videos={data.tiktokVideos} /> */}
      <HomeJournal articles={data.journalArticles} />
      <PromiseTicker />
    </div>
  );
}

// Shared touch-slider behavior for both hero variants: axis-locked horizontal
// swipe on a NON-passive listener so preventDefault stops vertical page scroll
// only once the gesture reads as horizontal, plus 5s auto-advance that pauses
// while dragging. Handlers are bound once per count and read live state via
// refs, so the gesture never tears from a mid-swipe rebind.
function useSwipeSlider<T extends HTMLElement>(
  count: number,
  ref: React.RefObject<T | null>,
) {
  // Seamless infinite loop via a clone at each end. Slides render as
  // [cloneOfLast, ...real, cloneOfFirst]; `pos` is the index into THAT array,
  // so real slide 0 sits at pos 1. Stepping off either edge (pos 0 or
  // count+1) animates into the clone, then — on transitionend — snaps
  // (transition off) to the matching real slide so the motion never reverses.
  const [pos, setPos] = useState(1);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false); // transition off during snap
  const start = useRef<{x: number; y: number} | null>(null);
  const axis = useRef<'h' | 'v' | null>(null);
  const dragRef = useRef(0);

  // Real slide index for the dots (pos 1..count → 0..count-1; clones map back).
  const active = ((pos - 1) % count + count) % count;
  // Never let pos escape [0, count+1] — stepping past an edge lands on the
  // clone there; the effect below then snaps back to the matching real slide.
  const step = (dir: number) =>
    setPos((p) => Math.max(0, Math.min(count + 1, p + dir)));
  const goReal = (realIndex: number) => setPos(realIndex + 1);

  useEffect(() => {
    if (count <= 1 || dragging || snapping) return;
    const id = setInterval(() => step(1), 5000);
    return () => clearInterval(id);
  }, [count, pos, dragging, snapping]);

  // Whenever pos lands on a clone (0 or count+1), let the 750ms slide finish,
  // then jump (transition off) to the matching real slide. Timer-driven — NOT
  // transitionend, which fires unreliably when the auto-advance interrupts the
  // animation and was leaving the track parked blank on a clone.
  const SLIDE_MS = 750;
  useEffect(() => {
    if (count <= 1) return;
    if (pos !== 0 && pos !== count + 1) return;
    const real = pos === 0 ? count : 1;
    const id = setTimeout(() => {
      setSnapping(true); // transition off for the instant jump
      setPos(real);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [pos, count]);

  // After a snap has painted, re-enable the transition (double rAF so the
  // browser commits the jumped position with transition:none first, and never
  // animates the snap itself).
  useEffect(() => {
    if (!snapping) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setSnapping(false));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [snapping]);

  useEffect(() => {
    const el = ref.current;
    if (!el || count <= 1) return;

    const setD = (v: number) => {
      dragRef.current = v;
      setDrag(v);
    };
    // A press that begins on a control (the dots) is a click, not a swipe.
    // Critically, `setPointerCapture` below would otherwise retarget pointerup
    // to the slider, so the browser fires `click` there instead of on the dot
    // and the dot's onClick never runs.
    const isControl = (target: EventTarget | null) =>
      target instanceof Element && target.closest('button') !== null;

    const onStart = (e: TouchEvent) => {
      if (isControl(e.target)) return;
      start.current = {x: e.touches[0].clientX, y: e.touches[0].clientY};
      axis.current = null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dx = e.touches[0].clientX - start.current.x;
      const dy = e.touches[0].clientY - start.current.y;
      if (!axis.current && Math.abs(dx) + Math.abs(dy) > 8) {
        axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (axis.current === 'h') setDragging(true);
      }
      if (axis.current === 'h') {
        e.preventDefault();
        setD(dx);
      }
    };
    const onEnd = () => {
      if (axis.current === 'h') {
        const width = window.innerWidth || 1;
        if (Math.abs(dragRef.current) > width * 0.12) {
          step(dragRef.current < 0 ? 1 : -1);
        }
      }
      start.current = null;
      axis.current = null;
      setDragging(false);
      setD(0);
    };

    // Mouse/pen drag for desktop (touch keeps its own handlers below so the
    // axis-lock + preventDefault logic stays intact). Pointer events fire for
    // touch too, so ignore pointerType 'touch' here to avoid double-driving.
    const onPtrDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || isControl(e.target)) return;
      start.current = {x: e.clientX, y: e.clientY};
      axis.current = 'h'; // mouse has no scroll conflict — treat as horizontal
      setDragging(true);
      el.setPointerCapture?.(e.pointerId);
    };
    const onPtrMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !start.current) return;
      setD(e.clientX - start.current.x);
    };
    const onPtrUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !start.current) return;
      onEnd();
    };

    el.addEventListener('touchstart', onStart, {passive: true});
    el.addEventListener('touchmove', onMove, {passive: false});
    el.addEventListener('touchend', onEnd, {passive: true});
    el.addEventListener('touchcancel', onEnd, {passive: true});
    el.addEventListener('pointerdown', onPtrDown);
    el.addEventListener('pointermove', onPtrMove);
    el.addEventListener('pointerup', onPtrUp);
    el.addEventListener('pointercancel', onPtrUp);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('pointerdown', onPtrDown);
      el.removeEventListener('pointermove', onPtrMove);
      el.removeEventListener('pointerup', onPtrUp);
      el.removeEventListener('pointercancel', onPtrUp);
    };
  }, [count, ref]);

  // Track transform: base position (incl. the leading clone via `pos`) plus the
  // live finger/mouse drag as a % of viewport width.
  const dragPct = dragging ? (drag / (window.innerWidth || 1)) * 100 : 0;
  const offset = -pos * 100 + dragPct;
  // Never animate while dragging or during an edge snap.
  const animate = !dragging && !snapping;

  return {active, goReal, offset, animate};
}

// One slide's words. Rendered inside each slide so the type travels with its
// photo instead of hanging still over a moving background. The tracks are
// aria-hidden, so these are presentational — the sr-only <h1> carries the
// semantics.
function HeroCaption({slide}: {slide: HeroSlide}) {
  if (!slide.text) return null;

  return (
    <div className="hero-inner" data-position={slide.position}>
      <div className="hero-heading">
        <span className="hero-rule" aria-hidden="true" />
        {slide.text}
      </div>
    </div>
  );
}

function Hero({content}: {content: HeroContent | null}) {
  const slides = content?.slides ?? [];
  const mobileSlides = content?.mobileSlides ?? [];
  const count = slides.length;
  const sectionRef = useRef<HTMLElement>(null);
  const {active, goReal, offset, animate} = useSwipeSlider(count, sectionRef);

  // Clone the last slide before + first slide after for a seamless loop.
  const loopSlides =
    count > 1 ? [slides[count - 1], ...slides, slides[0]] : slides;

  // The visible slide's words are the page's h1. It changes as the carousel
  // rotates, so screen readers track what's actually on screen. Falls back to
  // the store's own name when no slide has text — an unauthored banner used to
  // leave the homepage with no h1 at all.
  const activeText =
    slides[active]?.text?.trim() || 'Fine Gold Jewelry, Chains & Rings';

  return (
    <>
      <section
        ref={sectionRef}
        className="hero"
        data-has-mobile={mobileSlides.length ? 'true' : undefined}
      >
        {/* Portrait slider on mobile; CSS hides it (and shows the desktop
            rotating track) on desktop. Only rendered when the mobile
            container has slides — otherwise phones fall back to the landscape
            banners below. Its own swipe state, independent of the desktop
            track above. */}
        {activeText && <h1 className="sr-only">{activeText}</h1>}
        {mobileSlides.length > 0 && <MobileHeroSlider slides={mobileSlides} />}
        {count > 0 && (
          <div
            className="hero-track"
            style={{
              transform: `translate3d(${count > 1 ? offset : 0}%, 0, 0)`,
              transition: animate
                ? 'transform 750ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'none',
            }}
            aria-hidden="true"
          >
            {loopSlides.map((slide, index) => (
              <div
                key={index}
                className="hero-slide"
                data-position={slide.position}
                /* Desktop LCP. A CSS background can't take a srcSet, so cap it
                   at a sane full-bleed width instead of shipping the original. */
                style={{backgroundImage: `url(${cdnWidth(slide.image, 2000)})`}}
              >
                <HeroCaption slide={slide} />
              </div>
            ))}
          </div>
        )}
        {count > 1 && (
          <div className="hero-dots" role="tablist" aria-label="Hero slides">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`hero-dot ${index === active ? 'is-active' : ''}`}
                aria-label={`Go to slide ${index + 1}`}
                aria-selected={index === active}
                role="tab"
                onClick={() => goReal(index)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// Mobile-only hero slider: rotates the portrait images from the
// `mobile_cover_imagess` entry. Shown only ≤48em (CSS); the desktop banner
// track is hidden there. Self-contained swipe/auto-advance so it never
// desyncs from the desktop hero, which can have a different image count.
//
// Touch is wired via a non-passive native listener (React's onTouchMove is
// passive, so preventDefault there is ignored). We only hijack the gesture
// once it reads as horizontal, so vertical page scroll still works, and we
// stopPropagation so the parent .hero swipe handler never double-fires.
function MobileHeroSlider({slides}: {slides: HeroSlide[]}) {
  const count = slides.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const {active, goReal, offset, animate} = useSwipeSlider(count, rootRef);

  // Clone last before + first after for a seamless loop.
  const loopSlides =
    count > 1 ? [slides[count - 1], ...slides, slides[0]] : slides;
  // The clone at index 0 sits off-screen to the left, so the first slide the
  // visitor actually sees is index 1 once the loop exists.
  const firstVisibleIndex = count > 1 ? 1 : 0;

  return (
    <div className="hero-mobile-slider" ref={rootRef}>
      <div
        className="hero-mobile-track"
        style={{
          transform: `translate3d(${count > 1 ? offset : 0}%, 0, 0)`,
          transition: animate
            ? 'transform 750ms cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
        }}
        aria-hidden="true"
      >
        {loopSlides.map((slide, index) => (
          <div key={index} className="hero-mobile-slide">
            <img
              className="hero-mobile-image"
              /**
               * This is the mobile LCP element. It used to render the
               * metaobject's original upload — a multi-thousand-pixel banner
               * decoded down to a ~400px-wide phone viewport. The slider is
               * only shown below 48em, so 1200w covers even a DPR-3 handset.
               */
              src={cdnWidth(slide.image, 800)}
              srcSet={`${cdnWidth(slide.image, 480)} 480w, ${cdnWidth(slide.image, 800)} 800w, ${cdnWidth(slide.image, 1200)} 1200w`}
              sizes="100vw"
              alt=""
              decoding="async"
              draggable={false}
              /**
               * Only the slide on screen at load is the LCP candidate. The
               * loop puts a clone of the LAST slide at index 0, so that is
               * index 1 whenever the carousel loops. Every slide used to load
               * eagerly at equal priority, so the one the visitor could
               * actually see queued behind clones of ones they could not.
               */
              loading={index === firstVisibleIndex ? 'eager' : 'lazy'}
              {...(index === firstVisibleIndex
                ? {fetchpriority: 'high'}
                : null)}
            />
            <HeroCaption slide={slide} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="hero-dots" role="tablist" aria-label="Hero slides">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`hero-dot ${index === active ? 'is-active' : ''}`}
              aria-label={`Go to slide ${index + 1}`}
              aria-selected={index === active}
              role="tab"
              onClick={() => goReal(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TikTokVideosSection({
  videos,
}: {
  videos: Promise<any | null>;

}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={videos}>
        {(response) => {
          const items = parseTikTokVideos(response);
          if (!items.length) return null;
          return <VideoCarousel items={items} />;
        }}
      </Await>
    </Suspense>
  );
}

// Each item must match the policy pages. "Lifetime Warranty" and "Lifetime
// Upgrade" contradicted the product page's "1 Year Free Warranty" and the
// 14-day refund policy; a promise the policy won't honour is a chargeback,
// not a conversion.
const PROMISE_TICKER_ITEMS = [
  'Made in Our Own U.S.A. Factory',
  '1-Year Warranty on Production Defects',
  'Free U.S. Shipping Over $99',
  // Not "0% APR Financing" — rates and approval are set by the lender per
  // applicant, so promising 0% to everyone is a claim we can't honour.
  'Financing Available — Subject to Approval',
];

// Three identical groups so the marquee can loop seamlessly; only the first is
// exposed to screen readers.
function PromiseTicker() {
  return (
    <div className="hero-ticker" aria-hidden="false">
      <div className="ticker-track">
        {[0, 1, 2].map((group) => (
          <div
            className="ticker-group"
            key={group}
            aria-hidden={group > 0 || undefined}
          >
            {PROMISE_TICKER_ITEMS.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
type CategoryTile = any;

// Copy only — this crosses the loader serialization boundary, so it must be
// plain JSON (no JSX). ponytail: don't put React elements in loader data.
// `icon` is a 3D sticker in /public tilted on the right of the card; `signal`
// is the sticker's main hue, mapped to the card's bg tint in app.css. `pill` is
// the status label.
// Every claim here has to be traceable to something the store already states
// elsewhere — the product-page trust badges, the refund policy, or the contact
// page. Generic luxury phrasing ("Master Craft", "Lifetime Care") was replaced
// because it named no fact a competitor couldn't copy verbatim.
export const TRUST_PROMISES = [
  {
    title: 'Our Own Factory',
    pill: 'U.S.A.',
    // Source: product-page trust badge "Made in U.S.A — From our factory to you".
    copy: 'No middleman markup between our bench and your order.',
    icon: '/handmade.png',
    signal: 'gold',
    keys: ['craft', 'mastercraft', 'craftsmanship'],
  },
  {
    title: 'Solid 10K & 14K Gold',
    pill: 'Never plated',
    // Source: the catalogue — every piece is 10K/14K, no plated or filled stock.
    copy: 'Real gold throughout, with the karat stated on every piece.',
    icon: '/purity.png',
    signal: 'amber',
    keys: ['purity', 'certifiedpurity'],
  },
  {
    title: 'Built to Your Spec',
    pill: 'Custom',
    // Source: homepage FAQ — design, gold type, gemstones and engraving.
    copy: 'Choose the design, karat, stones and engraving on a custom order.',
    icon: '/care.png',
    signal: 'brown',
    keys: ['care', 'lifetimecare'],
  },
  {
    title: 'Downtown L.A',
    pill: 'Appointment',
    // Source: contact page — 550 S Hill St #660, the Jewelry District.
    copy: 'See a piece in person at 550 S Hill St, in the Jewelry District.',
    icon: '/secure%20delivery.jpg',
    signal: 'green',
    keys: ['delivery', 'securedelivery'],
  },
];

export function parseTrustBadges(response: any) {
  const fields = response?.metaobject?.fields;
  if (!Array.isArray(fields)) return TRUST_PROMISES;

  const valueByKey = fields.reduce(
    (result: Record<string, string>, field: any) => {
      if (field?.key && typeof field.value === 'string') {
        result[field.key.replace(/[-_]/g, '').toLowerCase()] = field.value;
      }
      return result;
    },
    {},
  );

  // Override keys live on each badge, not in a title-keyed map — retitling a
  // card used to silently detach it from its Shopify override.
  return TRUST_PROMISES.map((badge) => {
    const copy = badge.keys.map((key) => valueByKey[key]).find(Boolean);
    return copy ? {...badge, copy} : badge;
  });
}

export function TrustPromise({badges}: {badges: typeof TRUST_PROMISES}) {
  return (
    <section className="home-section trust-promise-section">
      <div className="section-inner">
        <div className="editorial-heading trust-promise-heading">
          <h2 className="editorial-title">Our Core Values</h2>
        </div>
        <div className="trust-promise-grid">
          {badges.map((item) => {
            const b = item as (typeof TRUST_PROMISES)[number];
            return (
              <article
                className="trust-promise-card"
                key={item.title}
                data-signal={b.signal ?? 'gold'}
              >
                {b.icon && (
                  <img
                    className="trust-sticker"
                    src={b.icon}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    draggable={false}
                  />
                )}
                {b.pill && (
                  <span className="trust-pill">
                    <span className="trust-pill-dot" aria-hidden="true" />
                    {b.pill}
                  </span>
                )}
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ShopByCategory({
  categories,
}: {
  categories: CategoryTile[] | any[];
}) {
  // No /public fallback images: they were multi-megapixel originals rendered
  // into a 495px card and have been removed. A collection with no image in
  // Shopify now falls through to CoverflowCarousel's initial-letter card
  // rather than a 404'd <img>.
  return (
    <section className="home-section">
      <div className="section-inner">
        <div className="editorial-heading">
          <h2 className="editorial-title">Shop by Category</h2>
        </div>
        <CoverflowCarousel
          items={categories.map((category) => ({
            id: category.id,
            title: category.title,
            handle: category.handle,
            image: category.image?.url ?? undefined,
          }))}
        />
      </div>
    </section>
  );
}

const RAIL_BATCH = 8; // products shown initially and revealed per scroll-to-end

// A single-row, swipeable product rail. Renders a batch and appends the next
// batch as the end scrolls into view, so more pieces appear as you scroll.
function ProductRail({
  products,
  ariaLabel,
  emptyMessage = 'No products to show right now.',
  collectionHandle,
}: {
  products: any[];
  ariaLabel: string;
  emptyMessage?: string;
  /** Set when the rail IS a collection's products, so cards link into it. */
  collectionHandle?: string;
}) {
  const [shown, setShown] = useState(RAIL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when the product set changes (e.g. switching tabs).
  useEffect(() => setShown(RAIL_BATCH), [products]);

  const hasMore = shown < products.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown((s) => Math.min(s + RAIL_BATCH, products.length));
        }
      },
      {rootMargin: '0px 400px'}, // reveal a bit before the true end
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  if (!products.length) {
    return <p className="recommended-products-empty">{emptyMessage}</p>;
  }

  return (
    <DragScroller className="split-rail" ariaLabel={ariaLabel} showScrollbar>
      {products.slice(0, shown).map((product: any, index: number) => (
        <ProductItem
          key={product.id}
          product={product}
          className="split-rail-item"
          collectionHandle={collectionHandle}
          loading={index < 4 ? 'eager' : undefined}
        />
      ))}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="split-rail-sentinel"
          aria-hidden="true"
        />
      )}
    </DragScroller>
  );
}

// Split featured section: a small trust-building intro on the left, a
// horizontally scrollable product showcase on the right. Two tabs switch the
// rail between the featured collection and best sellers.
function FeaturedProducts({
  collection,
  bestSelling,
}: {
  collection: any;
  bestSelling: Promise<{products: {nodes: any[]}} | null>;
}) {
  const [tab, setTab] = useState<'featured' | 'best'>('featured');
  if (!collection) return null;
  const featuredNodes = collection.products?.nodes ?? [];

  return (
    <section className="home-section featured-split">
      <div className="section-inner">
        <div className="editorial-heading-row">
          <div className="editorial-heading">
            <h2 className="editorial-title">Loved Pieces</h2>
          </div>
        </div>
        <div className="split-showcase">
          <div
            className="tab-switch"
            role="tablist"
            aria-label="Product filter"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'featured'}
              className={`tab-switch-btn${tab === 'featured' ? ' is-active' : ''}`}
              onClick={() => setTab('featured')}
            >
              Featured
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'best'}
              className={`tab-switch-btn${tab === 'best' ? ' is-active' : ''}`}
              onClick={() => setTab('best')}
            >
              Best Selling
            </button>
          </div>
          <Link
            className="editorial-viewall split-viewall"
            to={`/collections/${collection.handle}`}
          >
            View All &rarr;
          </Link>

          {tab === 'featured' ? (
            <ProductRail
              products={featuredNodes}
              ariaLabel="featured products"
              emptyMessage="Featured products are loading right now."
              collectionHandle={collection.handle}
            />
          ) : (
            <Suspense fallback={<ProductSliderSkeleton />}>
              <Await resolve={bestSelling}>
                {(response) => (
                  <ProductRail
                    products={response?.products.nodes ?? []}
                    ariaLabel="best selling products"
                    emptyMessage="Best sellers are loading right now."
                  />
                )}
              </Await>
            </Suspense>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Cover banner that sits between New Arrivals and Complete the Look.
 *
 * Served from cdn.shopify.com rather than the storefront's own
 * /cdn/shop/files/ path — the CSP `img-src` allowlist covers cdn.shopify.com
 * only, so the storefront path is blocked in local dev.
 */
const HOME_COVER_IMAGE =
  'https://cdn.shopify.com/s/files/1/0806/9568/9464/files/cover1.2.0.png?v=1783666437&width=1600';

function DiamondValueSection({image}: {image: string | null}) {
  // The hero metaobject can override the banner; otherwise the pinned asset
  // above renders. Never falls back to a public/ placeholder.
  const src = image ?? HOME_COVER_IMAGE;
  if (!src) return null;

  return (
    <section className="home-section diamond-value-section">
      <div className="section-inner">
        <div className="diamond-value-visual">
          <img
            src={cdnWidth(src, 1400)}
            alt="Diamond jewelry craftsmanship and value assurance"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

// New Arrivals: editorial title above a single-row scroll rail, with a
// trust-building panel on the right (mirrors FeaturedProducts). Tabs filter
// the rail to All / Women / Men.
function RecommendedProducts({
  products,
  genderNewArrivals,
}: {
  products: Promise<RecommendedProductsQuery | null>;
  genderNewArrivals: Promise<NewArrivalsByGenderQuery | null>;
}) {
  const [tab, setTab] = useState<'all' | 'women' | 'men'>('all');
  const viewAllHref =
    tab === 'women'
      ? '/collections/womens'
      : tab === 'men'
        ? '/collections/mens'
        : '/collections/all';

  return (
    <section className="home-section new-arrivals">
      <div className="section-inner">
        <div className="editorial-heading-row">
          <div className="editorial-heading">
            <h2 className="editorial-title">New Arrivals</h2>
          </div>
        </div>
        <div className="split-showcase">
          <div
            className="tab-switch"
            role="tablist"
            aria-label="New arrivals filter"
          >
            {(['all', 'women', 'men'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={`tab-switch-btn${tab === value ? ' is-active' : ''}`}
                onClick={() => setTab(value)}
              >
                {value === 'all' ? 'All' : value === 'women' ? 'Women' : 'Men'}
              </button>
            ))}
          </div>
          <Link className="editorial-viewall split-viewall" to={viewAllHref}>
            View All &rarr;
          </Link>
          {tab === 'all' ? (
            <Suspense fallback={<ProductSliderSkeleton />}>
              <Await resolve={products}>
                {(response) => (
                  <ProductRail
                    products={response?.products.nodes ?? []}
                    ariaLabel="new arrivals"
                    emptyMessage="New arrivals are loading or unavailable right now."
                  />
                )}
              </Await>
            </Suspense>
          ) : (
            <Suspense fallback={<ProductSliderSkeleton />}>
              <Await resolve={genderNewArrivals}>
                {(response) => (
                  <ProductRail
                    products={
                      (tab === 'women'
                        ? response?.womens?.products?.nodes
                        : response?.mens?.products?.nodes) ?? []
                    }
                    ariaLabel={`${tab} new arrivals`}
                    emptyMessage="New arrivals are loading or unavailable right now."
                  />
                )}
              </Await>
            </Suspense>
          )}
        </div>
      </div>
    </section>
  );
}

function ProductSliderSkeleton() {
  return (
    <div
      className="slider-section product-skeleton-slider"
      aria-label="Loading products"
    >
      <div className="slider-track">
        {Array.from({length: 4}).map((_, index) => (
          <ProductCardSkeleton key={index} className="slider-item" />
        ))}
      </div>
    </div>
  );
}

function ProductCardSkeleton({className}: {className?: string}) {
  return (
    <article
      className={
        className
          ? `product-item product-skeleton ${className}`
          : 'product-item product-skeleton'
      }
    >
      <div className="product-image-skeleton" />
      <div className="product-card-body">
        <div className="product-text-skeleton is-title" />
        <div className="product-text-skeleton is-price" />
      </div>
    </article>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
    products(first: 12) {
      nodes {
        id
        title
        handle
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        featuredImage {
          id
          url
          altText
          width
          height
        }
        selectedOrFirstAvailableVariant {
          id
          availableForSale
        }
      }
    }
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 10, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

export const SHOP_BY_CATEGORIES_QUERY = `#graphql
  fragment CategoryCollection on Collection {
    id
    title
    handle
    image {
      url
      altText
    }
  }
  query ShopByCategories($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    rings: collection(handle: "rings") {
      ...CategoryCollection
    }
    chains: collection(handle: "chains") {
      ...CategoryCollection
    }
    bracelets: collection(handle: "bracelets") {
      ...CategoryCollection
    }
    earrings: collection(handle: "earrings") {
      ...CategoryCollection
    }
    pendants: collection(handle: "pendants") {
      ...CategoryCollection
    }
    necklaces: collection(handle: "necklaces") {
      ...CategoryCollection
    }
    charms: collection(handle: "charms") {
      ...CategoryCollection
    }
    diamond: collection(handle: "diamond") {
      ...CategoryCollection
    }
    engagementRings: collection(handle: "engagement-rings") {
      ...CategoryCollection
    }
  }
` as const;

export const TRUST_BADGES_QUERY = `#graphql
  query TrustBadges($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    metaobject(
      handle: {
        type: "trust_badges_data"
        handle: "trust-badges-data-qgta9zi1"
      }
    ) {
      fields {
        key
        value
      }
    }
  }
` as const;

// Two hero_content entries by handle: `desktop` has the rotating banners +
// heading; `mobile` holds a single portrait image shown on small screens.
// Fetched by handle (not `first: 1`) so the two never get confused.
const HERO_FIELDS_FRAGMENT = `#graphql
  fragment HeroFields on Metaobject {
    fields {
      key
      value
      reference {
        ... on MediaImage {
          image {
            url
            altText
          }
        }
      }
    }
  }
`;

// One `hero_section` entry per slide: the banner image, the words that sit on
// it, and which side they sit on.
const HERO_SLIDE_FRAGMENT = `#graphql
  fragment HeroSlide on Metaobject {
    handle
    fields {
      key
      value
      reference {
        ... on MediaImage {
          image {
            url
            altText
          }
        }
      }
    }
  }
`;

// `web_hero_section` is the ordered container: image1..imageN each point at a
// `hero_section` entry. image1 is authored as a *list* reference and the rest
// as single references, so both `references` and `reference` are selected —
// parseHeroSlides reads whichever is populated.
const HERO_CONTENT_QUERY = `#graphql
  query HeroContent($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    desktop: metaobject(
      handle: {type: "web_hero_section", handle: "web-hero-section-ogaqzqnu"}
    ) {
      fields {
        key
        references(first: 10) {
          nodes {
            ...HeroSlide
          }
        }
        reference {
          ...HeroSlide
        }
      }
    }
    # Same container shape as desktop, pointing at the portrait (1400x2000)
    # variants of the same four slides.
    mobile: metaobject(
      handle: {type: "web_hero_section", handle: "mobile_hero_section"}
    ) {
      fields {
        key
        references(first: 10) {
          nodes {
            ...HeroSlide
          }
        }
        reference {
          ...HeroSlide
        }
      }
    }
    # The banners moved to web_hero_section, but this older entry still supplies
    # the standalone image DiamondValueSection renders further down the page.
    cover: metaobject(
      handle: {type: "hero_content", handle: "hero-content-fbt3hbmk"}
    ) {
      ...HeroFields
    }
  }
  ${HERO_SLIDE_FRAGMENT}
  ${HERO_FIELDS_FRAGMENT}
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    # Resolve each card's canonical /collections/<category>/products/<handle>
    # link. Without them the card falls back to the flat path, which 301s.
    productType
    category {
      name
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 24, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;

// ponytail: 24 fetched up front; the rail reveals them in batches as you
// scroll. Swap to cursor pagination only if a store needs to browse past 24.
const BEST_SELLING_PRODUCTS_QUERY = `#graphql
  fragment BestSellingProduct on Product {
    id
    title
    handle
    # See RecommendedProduct — canonical link resolution.
    productType
    category {
      name
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query BestSellingProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 24, sortKey: BEST_SELLING) {
      nodes {
        ...BestSellingProduct
      }
    }
  }
` as const;

// Newest products in the Women's / Men's collections, for the New Arrivals tabs.
const NEW_ARRIVALS_BY_GENDER_QUERY = `#graphql
  fragment GenderArrivalProduct on Product {
    id
    title
    handle
    # See RecommendedProduct — canonical link resolution.
    productType
    category {
      name
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
  }
  query NewArrivalsByGender($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    womens: collection(handle: "womens") {
      products(first: 24, sortKey: CREATED, reverse: true) {
        nodes {
          ...GenderArrivalProduct
        }
      }
    }
    mens: collection(handle: "mens") {
      products(first: 24, sortKey: CREATED, reverse: true) {
        nodes {
          ...GenderArrivalProduct
        }
      }
    }
  }
` as const;

type JournalArticle = {
  id: string;
  title: string;
  handle: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  blog: {handle: string};
  image?: {
    id?: string | null;
    altText?: string | null;
    url: string;
    width?: number | null;
    height?: number | null;
  } | null;
};

// Homepage "From the Journal" rail: recent blog articles in a touch/drag
// scroller, reusing the same .blog-card look as the blog pages.
function HomeJournal({
  articles,
}: {
  articles: Promise<{articles: {nodes: JournalArticle[]}} | null>;
}) {
  return (
    <section className="home-section home-journal">
      <div className="section-inner">
        <div className="editorial-heading-row">
          <div className="editorial-heading">
            <h2 className="editorial-title">From the Journal</h2>
          </div>
          <Link className="editorial-viewall" to="/blogs">
            View All &rarr;
          </Link>
        </div>
      </div>
      <Suspense fallback={null}>
        <Await resolve={articles}>
          {(data) => {
            const nodes = data?.articles?.nodes ?? [];
            if (!nodes.length) return null;
            return (
              <DragScroller
                className="home-journal-rail"
                ariaLabel="journal articles"
                showScrollbar
              >
                {nodes.map((article, index) => (
                  <JournalCard
                    key={article.id}
                    article={article}
                    eager={index < 3}
                  />
                ))}
              </DragScroller>
            );
          }}
        </Await>
      </Suspense>
    </section>
  );
}

function JournalCard({
  article,
  eager,
}: {
  article: JournalArticle;
  eager?: boolean;
}) {
  const to = `/blogs/${article.handle}`;
  const publishedAt = article.publishedAt
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(article.publishedAt))
    : null;
  const excerpt = article.excerpt?.trim();

  return (
    <article className="blog-card home-journal-card">
      <Link className="blog-card-media" to={to} prefetch="intent" tabIndex={-1}>
        {article.image && (
          <img
            src={cdnWidth(article.image.url, 800)}
            alt={article.image.altText || article.title}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
          />
        )}
      </Link>
      <div className="blog-card-body">
        {publishedAt && <time className="blog-card-date">{publishedAt}</time>}
        <h3 className="blog-card-title">
          <Link to={to} prefetch="intent">
            {article.title}
          </Link>
        </h3>
        {excerpt && <p className="blog-card-excerpt">{excerpt}</p>}
        <Link className="blog-card-more" to={to} prefetch="intent">
          Read More &rarr;
        </Link>
      </div>
    </article>
  );
}

// Latest articles across every blog (the store may have just one blog), for the
// homepage Journal rail.
const HOME_ARTICLES_QUERY = `#graphql
  query HomeArticles($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    articles(first: 8, sortKey: PUBLISHED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        excerpt
        publishedAt
        blog {
          handle
        }
        image {
          id
          altText
          url
          width
          height
        }
      }
    }
  }
` as const;

// First (and only) "Tiktok videos" metaobject: video_1 is a list reference,
// video_2/video_3 are single references, all pointing at "tiktok video
// detail" metaobjects (video file + description). See parseTikTokVideos.
const TIKTOK_VIDEOS_QUERY = `#graphql
  fragment TikTokVideoDetail on Metaobject {
    id
    fields {
      key
      value
      reference {
        ... on Video {
          sources {
            url
            mimeType
          }
          previewImage {
            url
          }
        }
      }
    }
  }
  query TikTokVideos($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    metaobjects(type: "tiktok_videos", first: 1) {
      nodes {
        fields {
          key
          value
          reference {
            ... on Metaobject {
              ...TikTokVideoDetail
            }
          }
          references(first: 10) {
            nodes {
              ... on Metaobject {
                ...TikTokVideoDetail
              }
            }
          }
        }
      }
    }
  }
` as const;
