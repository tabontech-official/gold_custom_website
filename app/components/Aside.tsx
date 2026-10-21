import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  /**
   * Open `mode`, or close it if it is already the open one — for a control
   * that IS the thing it opens, like the mobile menu button. `open` alone left
   * that button one-way: pressing it a second time re-set the state it was
   * already in, so the menu never closed from the control that opened it.
   */
  toggle: (mode: AsideType) => void;
  close: () => void;
};

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 */
export function Aside({
  children,
  heading,
  type,
}: {
  children?: React.ReactNode;
  type: AsideType;
  heading: React.ReactNode;
}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const headingId = useId();

  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      document.addEventListener(
        'keydown',
        function handler(event: KeyboardEvent) {
          if (event.key === 'Escape') {
            close();
          }
        },
        {signal: abortController.signal},
      );
    }
    return () => abortController.abort();
  }, [close, expanded]);

  /**
   * A closed panel needs nothing extra to stay out of the tab order and the
   * accessibility tree: `.overlay` is `visibility: hidden` until `.expanded`.
   *
   * - The dialog is named by its heading (axe aria-dialog-name).
   * - The full-screen backdrop button is a pointer affordance only. It had no
   *   name — an unlabeled button and an invisible second tab stop beside the
   *   real × — so it is now hidden from assistive tech and the tab order.
   *   Clicking it still closes, as do × and Escape.
   * - The body is a `div`: a `<main>` here gave every page three extra main
   *   landmarks, nested inside a complementary one.
   */
  return (
    <div
      aria-modal
      aria-labelledby={headingId}
      className={`overlay overlay--${type} ${expanded ? 'expanded' : ''}`}
      role="dialog"
    >
      <button
        className="close-outside"
        onClick={close}
        aria-hidden="true"
        tabIndex={-1}
      />
      <aside>
        <header>
          <h3 id={headingId}>{heading}</h3>
          <button className="close reset" onClick={close} aria-label="Close">
            &times;
          </button>
        </header>
        <div className="aside-body">{children}</div>
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        // Functional update: reads the type at click time rather than the one
        // captured when this value was built.
        toggle: (mode) =>
          setType((current) => (current === mode ? 'closed' : mode)),
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}
