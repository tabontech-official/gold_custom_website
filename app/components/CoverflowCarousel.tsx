import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {Link} from 'react-router';

export type CoverflowItem = {
  id: string;
  title: string;
  handle: string;
  image?: string;
};

// Continuous eased scroll, ported from React Bits' CircularGallery: a target
// position is nudged by drag/wheel/keys, and current eases toward it every
// frame (lerp). Card transforms are derived from the *float* offset, so motion
// flows instead of snapping card-to-card. Snaps to the nearest card on release.
const EASE = 0.08; // lerp factor per frame (higher = snappier)
const WHEEL_SPEED = 0.0016; // scroll units per wheel delta
const DRAG_SPEED = 0.006; // scroll units per px dragged
const SETTLE_EPS = 0.0005; // stop the rAF loop when current ~= target
const VISIBLE_SLOTS = 2; // cards each side kept fully opaque
const CARD_SPACING = 98; // % of card width; leaves room for neighbouring shadows

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Match the first client-side paint during SSR. Without these values every
// card starts stacked at the centre until useEffect runs after hydration,
// causing a visible broken-frame flash on hard refresh.
function getInitialCardStyle(index: number, total: number): CSSProperties {
  let offset = index % total;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;

  const distance = Math.abs(offset);
  const fadeEdge = Math.min(VISIBLE_SLOTS + 1.5, total / 2 - 0.01);
  const solid = Math.min(VISIBLE_SLOTS, fadeEdge - 0.5);
  const opacity =
    distance <= solid
      ? 1
      : Math.max(0, 1 - (distance - solid) / (fadeEdge - solid));

  return {
    filter: `brightness(${1 - Math.min(distance, 2) * 0.05})`,
    opacity,
    pointerEvents: distance <= 1.5 ? 'auto' : 'none',
    transform: `translate(-50%, -50%) translateX(${offset * CARD_SPACING}%) rotateY(${offset * -12}deg) scale(${Math.max(0.4, 1 - distance * 0.12)})`,
    visibility: opacity > 0 ? 'visible' : 'hidden',
    zIndex: 1000 - Math.round(distance * 100),
  };
}

/**
 * Infinite 3D coverflow. The centered card is upright and in focus while
 * neighbours scale down and tilt back. Drag, wheel, arrow-keys, dots and
 * clicking a side card all scroll smoothly (continuous, eased — no snapping
 * mid-motion). Same look as before; only the scroll feel changed.
 */
export function CoverflowCarousel({items}: {items: CoverflowItem[]}) {
  const n = items.length;
  const [active, setActive] = useState(0); // nearest card, drives dots + a11y

  // Continuous scroll state lives in a ref (mutated every frame, never a
  // re-render trigger). `current` is what we render from.
  const scroll = useRef({current: 0, target: 0});
  const rafRef = useRef<number | null>(null);
  const drag = useRef<{startX: number; startTarget: number} | null>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  // Wrap a float offset into [-n/2, n/2] so cards flow around infinitely.
  const wrap = useCallback(
    (off: number) => {
      if (n === 0) return 0;
      let r = off % n;
      if (r > n / 2) r -= n;
      if (r < -n / 2) r += n;
      return r;
    },
    [n],
  );

  // Paint every card from the current scroll position. Runs each rAF frame.
  const paint = useCallback(() => {
    const cur = scroll.current.current;
    // The fade must finish BEFORE the wrap seam (±n/2), so a card is already at
    // opacity 0 when it jumps ±n — the jump then happens off-screen and is
    // never seen. Clamp so this holds even with few cards.
    const fadeEdge = Math.min(VISIBLE_SLOTS + 1.5, n / 2 - 0.01);
    // With very few cards the fully-opaque band can't reach VISIBLE_SLOTS
    // without crossing the seam; shrink it so the ramp denominator stays > 0.
    const solid = Math.min(VISIBLE_SLOTS, fadeEdge - 0.5);
    for (let i = 0; i < n; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const off = wrap(i - cur);
      const abs = Math.abs(off);
      // Fade smoothly across a band instead of snapping on/off, so a card
      // entering never pops. Fully opaque out to VISIBLE_SLOTS, then ramps to 0
      // by FADE_EDGE. The wrap seam sits past FADE_EDGE, where cards are already
      // invisible — so the ±n jump happens off-screen and is never seen.
      const opacity =
        abs <= solid
          ? 1
          : Math.max(0, 1 - (abs - solid) / (fadeEdge - solid));
      el.style.opacity = opacity.toFixed(3);
      el.style.pointerEvents = abs <= 1.5 ? 'auto' : 'none';
      el.style.zIndex = String(1000 - Math.round(abs * 100));
      el.style.visibility = opacity > 0 ? 'visible' : 'hidden';
      // Same transform shape as the old CSS, now fed a continuous float.
      const tx = off * CARD_SPACING; // % of card width
      const sc = Math.max(0.4, 1 - abs * 0.12);
      const ry = off * -12;
      el.style.transform = `translate(-50%, -50%) translateX(${tx}%) rotateY(${ry}deg) scale(${sc})`;
      el.style.filter = `brightness(${1 - Math.min(abs, 2) * 0.05})`;
      el.classList.toggle('is-active', abs < 0.5);
    }
  }, [n, wrap]);

  // The animation loop: ease current → target, repaint, update `active`, and
  // stop once settled (no idle rAF burning battery).
  const tick = useCallback(() => {
    const s = scroll.current;
    s.current = lerp(s.current, s.target, EASE);
    if (Math.abs(s.target - s.current) < SETTLE_EPS) s.current = s.target;
    paint();

    const nearest = ((Math.round(s.current) % n) + n) % n;
    setActive((prev) => (prev === nearest ? prev : nearest));

    if (s.current !== s.target) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }, [n, paint]);

  const kick = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // Move the target by whole cards (arrows / dots / clicking a side card).
  const scrollTo = useCallback(
    (targetIndex: number) => {
      // Choose the shortest wrapped path so it never scrolls the long way.
      const s = scroll.current;
      const delta = wrap(targetIndex - s.current);
      s.target = s.current + delta;
      kick();
    },
    [wrap, kick],
  );

  const step = useCallback(
    (dir: number) => {
      scroll.current.target += dir;
      kick();
    },
    [kick],
  );

  // Snap the target to the nearest whole card (called after a drag/wheel).
  const snap = useCallback(() => {
    scroll.current.target = Math.round(scroll.current.target);
    kick();
  }, [kick]);

  // Initial paint.
  useEffect(() => {
    paint();
  }, [paint]);

  // Keep active valid if the list shrinks.
  useEffect(() => {
    setActive((a) => (n ? Math.min(a, n - 1) : 0));
  }, [n]);

  // Cleanup the rAF on unmount.
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function onWheel(event: React.WheelEvent) {
    // Horizontal-intent only, so vertical page scroll is never hijacked.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    scroll.current.target += event.deltaX * WHEEL_SPEED;
    kick();
  }

  function onPointerDown(event: React.PointerEvent) {
    drag.current = {
      startX: event.clientX,
      startTarget: scroll.current.target,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.startX;
    scroll.current.target = drag.current.startTarget - dx * DRAG_SPEED;
    kick();
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    snap();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  }

  if (!n) return null;

  return (
    <div
      className="coverflow"
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      onKeyDown={onKeyDown}
    >
      <div
        className="coverflow-stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {items.map((item, index) => (
          <article
            key={item.id}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            className="coverflow-card"
            style={getInitialCardStyle(index, n)}
            onClick={() => index !== active && scrollTo(index)}
          >
            <div className="coverflow-card-media">
              {item.image ? (
                <img src={item.image} alt={item.title} draggable={false} />
              ) : (
                <span className="coverflow-card-fallback" aria-hidden="true">
                  {item.title.charAt(0)}
                </span>
              )}
            </div>
            <div className="coverflow-card-body">
              <h3 className="coverflow-card-title">
                {item.title}
                <span>Collection</span>
              </h3>
              <div className="coverflow-card-links">
                <Link
                  to={`/collections/${item.handle}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Shop Now
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="coverflow-dots">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={`coverflow-dot${index === active ? ' is-active' : ''}`}
            aria-label={`Go to ${item.title}`}
            aria-current={index === active}
            onClick={() => scrollTo(index)}
          />
        ))}
      </div>
    </div>
  );
}
