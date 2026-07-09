import {useRef, useState, type CSSProperties} from 'react';
import {Link} from 'react-router';

export type CoverflowItem = {
  id: string;
  title: string;
  handle: string;
  image?: string;
};

/**
 * Infinite 3D coverflow. The centered card comes into sharp, scaled-up focus
 * while neighbours scale down, tilt, blur and fade (depth-of-field). Wheel,
 * swipe, arrows, dots and clicking a side card all re-center.
 */
export function CoverflowCarousel({items}: {items: CoverflowItem[]}) {
  const [active, setActive] = useState(0);
  const wheelLock = useRef(false);
  const dragStart = useRef<number | null>(null);
  const n = items.length;

  if (!n) return null;

  function go(dir: number) {
    setActive((a) => (a + dir + n) % n);
  }

  function onWheel(event: React.WheelEvent) {
    // Only react to horizontal-intent scrolling so vertical page scroll is
    // never hijacked; mouse users navigate via arrows, dots or drag.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    if (Math.abs(event.deltaX) < 8 || wheelLock.current) return;
    wheelLock.current = true;
    go(event.deltaX > 0 ? 1 : -1);
    window.setTimeout(() => (wheelLock.current = false), 450);
  }

  function onPointerDown(event: React.PointerEvent) {
    dragStart.current = event.clientX;
  }

  function onPointerUp(event: React.PointerEvent) {
    if (dragStart.current === null) return;
    const dx = event.clientX - dragStart.current;
    dragStart.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  }

  return (
    <div className="coverflow">
      <button
        type="button"
        className="coverflow-arrow is-prev"
        aria-label="Previous collection"
        onClick={() => go(-1)}
      >
        <span aria-hidden="true">&#8249;</span>
      </button>

      <div
        className="coverflow-stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {items.map((item, index) => {
          let offset = index - active;
          if (offset > n / 2) offset -= n;
          if (offset < -n / 2) offset += n;
          const abs = Math.abs(offset);
          const visible = abs <= 2;
          const isActive = offset === 0;
          const style = {
            '--offset': offset,
            '--abs': abs,
            zIndex: 100 - abs,
            opacity: visible ? undefined : 0,
            pointerEvents: visible ? undefined : 'none',
          } as CSSProperties;

          return (
            <article
              key={item.id}
              className={`coverflow-card${isActive ? ' is-active' : ''}`}
              style={style}
              aria-hidden={!isActive}
              onClick={() => !isActive && setActive(index)}
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
                    to={`/collections/${item.handle}?gender=men`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Men
                  </Link>
                  <Link
                    to={`/collections/${item.handle}?gender=women`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Women
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="coverflow-arrow is-next"
        aria-label="Next collection"
        onClick={() => go(1)}
      >
        <span aria-hidden="true">&#8250;</span>
      </button>

      <div className="coverflow-dots">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={`coverflow-dot${index === active ? ' is-active' : ''}`}
            aria-label={`Go to ${item.title}`}
            aria-current={index === active}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
    </div>
  );
}
