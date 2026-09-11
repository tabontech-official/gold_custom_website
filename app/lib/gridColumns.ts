import {useEffect, useState} from 'react';

/**
 * How the collection grid's "Load More" stays in step with the layout.
 *
 * The grid's column count is decided by CSS (`auto-fill` + media queries), so
 * it changes with the viewport, the device and even the sidebar being open.
 * A fixed batch size therefore cannot help but be wrong: 24 products is four
 * clean rows of six, and a ragged 4.8 rows of five. Everything here exists so
 * the batch is COUNTED from the layout that actually rendered rather than
 * assumed — read back off the grid element, never re-derived from a second
 * copy of the breakpoints that would drift from the stylesheet.
 */

/** Rows added per "Load More" click on a wide grid: 4 columns = 20, 3 = 15. */
export const ROWS_PER_LOAD = 5;

/**
 * Rows added per click on a narrow grid — two columns or one, i.e. every
 * phone.
 *
 * Five rows is a batch on a desktop and a rounding error on a phone: ten
 * products, which a thumb clears in about a second of scrolling, so the
 * shopper spends the whole visit tapping Load More. Ten rows there is the
 * same amount of SCROLLING as five rows of four, which is what a batch is
 * actually measured in.
 */
export const MOBILE_ROWS_PER_LOAD = 10;

/** Below this many columns, a batch is counted in MOBILE_ROWS_PER_LOAD. */
const NARROW_COLUMNS = 2;

/**
 * Columns assumed before the grid has been measured — i.e. for the
 * server-rendered first batch, where there is no viewport to measure. Desktop
 * is the busiest case, so the first paint carries enough to fill it, and a
 * phone simply gets more rows of two.
 */
export const DEFAULT_COLUMNS = 4;

/** Nothing sane renders more; a guard against a garbage computed value. */
const MAX_COLUMNS = 8;

export function clampColumns(value: unknown): number {
  const columns = Math.floor(Number(value));
  if (!Number.isFinite(columns) || columns < 1) return DEFAULT_COLUMNS;
  return Math.min(columns, MAX_COLUMNS);
}

/** Products one "Load More" click adds, for a grid this many columns wide. */
export function batchSize(columns: number): number {
  const count = clampColumns(columns);
  const rows = count <= NARROW_COLUMNS ? MOBILE_ROWS_PER_LOAD : ROWS_PER_LOAD;
  return count * rows;
}

/**
 * Column count from a computed `grid-template-columns`.
 *
 * getComputedStyle resolves the property to its USED value — the real track
 * list, "259.5px 259.5px 259.5px 259.5px", whatever `auto-fill` and the
 * breakpoints worked out to. Counting those tracks is the only reading of the
 * column count that cannot disagree with what the shopper is looking at.
 *
 * `none` comes back for a hidden grid or one that is not `display: grid` yet
 * (and Firefox can return `repeat(...)` verbatim for an unrendered element) —
 * both fall back rather than reporting a wrong number.
 */
export function columnsFromTemplate(template?: string | null): number {
  const value = template?.trim();
  if (!value || value === 'none' || value.includes('repeat(')) {
    return DEFAULT_COLUMNS;
  }
  return clampColumns(value.split(/\s+/).length);
}

/**
 * The number of columns the grid is currently rendering, remeasured whenever
 * it changes size — a rotation, a resize, the filter drawer opening.
 *
 * Starts at DEFAULT_COLUMNS so server and first client render agree (a
 * measured value here would be a hydration mismatch); the effect corrects it
 * before the shopper can click anything.
 */
export function useGridColumns(ref: {current: HTMLElement | null}): number {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () =>
      setColumns(
        columnsFromTemplate(getComputedStyle(element).gridTemplateColumns),
      );

    measure();
    // The grid is fluid, so every viewport change resizes it — one observer on
    // the element covers resize, rotation and the sidebar opening alike.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
