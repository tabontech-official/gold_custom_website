import {SOCIAL_LINKS, SocialIcon} from '~/components/Footer';

/**
 * Sticky social rail pinned to the left edge, vertically centred.
 *
 * Each pill is icon-only at rest and widens on hover to reveal the handle —
 * so the rail costs one icon's worth of gutter until you reach for it.
 *
 * The links, brand marks and handles all come from the footer's SOCIAL_LINKS:
 * adding a network stays one entry in one file, and the rail can never drift
 * out of sync with the footer row or with SocialFollow below.
 *
 * Hidden below 64em: at tablet width and under, a fixed rail sits on top of the
 * content it's supposed to sit beside. SocialFollow covers those screens.
 */
export function SocialRail() {
  return (
    <ul className="social-rail" aria-label="Gold Custom on social media">
      {SOCIAL_LINKS.map(({brand, label, handle, href}) => (
        <li className="social-rail-item" key={brand}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            /* Includes the handle because the handle is the visible text: an
               accessible name that omits it fails "label in name" (WCAG 2.5.3)
               and leaves voice-control users naming a string that isn't there. */
            aria-label={`${label} — ${handle}`}
            /* Both the icon key and the per-brand colour hook in app.css. */
            data-social={brand}
          >
            <SocialIcon brand={brand} />
            <span className="social-rail-handle">{handle}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The rail's counterpart for phones and tablets, shown below the TikTok feed.
 *
 * Exactly the complement of SocialRail's breakpoint — one of the two is on at
 * any width, never both, never neither.
 *
 * One rounded bar of circular icon links. Style after Uiverse.io by
 * firemonste_8052, inverted to the site's palette: the reference is white
 * marks on black, which would drop a hard black slab into a page that is gold
 * on white.
 *
 * The tooltip only ever appears on a pointer device (see `@media (hover: hover)`
 * in app.css). On a phone there is no hover to trigger it, so the brand marks
 * carry the meaning visually and `aria-label` carries it to assistive tech.
 */
export function SocialFollow() {
  return (
    /* No visible heading — the bar sits directly under the TikTok feed and
       reads as part of it. `aria-label` names the region so it is still a
       landmark rather than an unlabelled list of four links. */
    <section className="home-section social-follow" aria-label="Follow Gold Custom">
      <div className="section-inner">
        <ul className="social-follow-bar">
          {SOCIAL_LINKS.map(({brand, label, handle, href}) => (
            <li className="social-follow-item" key={brand}>
              <a
                className="social-follow-link"
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${label} — ${handle}`}
                data-social={brand}
              >
                <SocialIcon brand={brand} />
              </a>
              {/* aria-hidden: the link's own aria-label already names it, so an
                  exposed tooltip would announce every brand twice. */}
              <span className="social-follow-tip" aria-hidden="true">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
