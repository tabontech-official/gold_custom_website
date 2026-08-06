import {Suspense} from 'react';
import {Await, Link, NavLink, useFetcher} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({
  footer: footerPromise,
  header,
  publicStoreDomain,
}: FooterProps) {
  const newsletter = useFetcher<{success?: boolean; error?: string}>();
  const newsletterBusy = newsletter.state !== 'idle';

  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {(footer) => (
          <footer className="footer">
            <div className="footer-main">
              <div className="footer-left">
                <div className="footer-brand">Join the Gold Custom Club</div>
                <p>
                  Subscribe for new drops, private offers, and jewelry care
                  notes.
                </p>
                {/* Named, unlike the wishlist toggles, because this one IS a
                    landmark worth reaching: it is a real form with an input a
                    shopper (or an agent) may want to find. An unnamed <form>
                    lands in the tree as an anonymous "form" region. */}
                <newsletter.Form
                  action="/api/subscribe"
                  className="footer-newsletter"
                  method="post"
                  aria-label="Sign up for the newsletter"
                >
                  <label className="visually-hidden" htmlFor="footer-email">
                    Email address
                  </label>
                  <input
                    id="footer-email"
                    name="email"
                    placeholder="Email"
                    required
                    type="email"
                  />
                  <button disabled={newsletterBusy} type="submit">
                    {newsletterBusy ? 'Joining' : 'Subscribe'}
                    <ArrowRightIcon />
                  </button>
                </newsletter.Form>
                {newsletter.data?.success ? (
                  <p className="footer-newsletter-note">
                    You are in. Welcome to the club.
                  </p>
                ) : (
                  <p className="footer-newsletter-note">
                    By joining, you agree to receive occasional Gold Custom
                    emails.
                  </p>
                )}
                {newsletter.data?.error ? (
                  <p className="footer-newsletter-error">
                    {newsletter.data.error}
                  </p>
                ) : null}
                <div className="footer-social">
                  <a
                    href="https://www.instagram.com/goldcustom_la"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                  >
                    <InstagramIcon />
                  </a>
                  <a
                    href="https://www.facebook.com/people/Gold-Custom-Los-Angeles/100090201579473/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                  >
                    <FacebookIcon />
                  </a>
                  <a
                    href="https://www.youtube.com/@goldcustomla"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="YouTube"
                  >
                    <YoutubeIcon />
                  </a>
                  <a
                    href="https://www.tiktok.com/@goldcustomla"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="TikTok"
                  >
                    <TikTokIcon />
                  </a>
                </div>
                {/* quick-shop links removed from here to avoid duplication; kept in Shop column */}
              </div>

              <div className="footer-mid">
                <div className="footer-col">
                  <h4>Shop</h4>
                  <ul>
                    <li>
                      <Link to="/collections/diamond">
                        Diamond & Engagement
                      </Link>
                    </li>
                    <li>
                      <Link to="/collections/chains">Chains</Link>
                    </li>
                    <li>
                      <Link to="/collections/rings">Rings</Link>
                    </li>
                    <li>
                      <Link to="/collections/bracelets">Bracelets</Link>
                    </li>
                    <li>
                      <Link to="/collections/earrings">Earrings</Link>
                    </li>
                    <li>
                      <Link to="/collections/shop-all">Shop All</Link>
                    </li>
                  </ul>
                </div>

                <div className="footer-col">
                  <h4>Customers</h4>
                  <ul>
                    <li>
                      <Link to="/search">Search</Link>
                    </li>
                    <li>
                      <Link to="/policies">Policies</Link>
                    </li>
                    <li>
                      <Link to="/contact">Contact Us</Link>
                    </li>
                    <li>
                      <Link to="/blogs">Blog</Link>
                    </li>
                  </ul>
                </div>

                <div className="footer-col footer-contact-col">
                  <h4>Stay Connected</h4>
                  <div className="footer-contact-grid">
                    <div>
                      <ul>
                        <li>
                          <a
                            className="footer-contact-link"
                            href="tel:+13236888837"
                          >
                            <PhoneIcon />
                            <span>+1 (323) 688-8837</span>
                          </a>
                        </li>
                        <li>
                          <a
                            className="footer-contact-link"
                            href="mailto:mr10k@goldcustom.com"
                          >
                            <MailIcon />
                            <span>mr10k@goldcustom.com</span>
                          </a>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <ul>
                        <li>
                          <a
                            className="footer-contact-link"
                            href="https://maps.app.goo.gl/252CwsjSZfhSae4B6"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MapPinIcon />
                            <span>
                              550 S Hill St #660, Los Angeles, CA 90013, United
                              States
                            </span>
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Giant wordmark, Cadence-style */}
            <div className="footer-wordmark" aria-hidden="true">
              {header.shop.name}
            </div>
          </footer>
        )}
      </Await>
    </Suspense>
  );
}

/**
 * Replaces the ASCII "->" the button used to render. That was two glyphs from
 * the body face, so it inherited the font's own weight and baseline and sat
 * slightly low next to the label; this is a real arrow that scales with the
 * text and inherits its colour.
 *
 * 1.3rem, not em: rem is measured against the root, so the arrow keeps the
 * same size regardless of the button's own 0.68rem label. That is the point
 * here — the arrow is deliberately larger than the caps beside it, so it
 * should not shrink along with them.
 */
function ArrowRightIcon() {
  return (
    <svg
      width="1.3rem"
      height="1.3rem"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 12h15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m13 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.87.24-1.46 1.49-1.46h1.61V4.95c-.28-.04-1.23-.12-2.33-.12-2.3 0-3.87 1.4-3.87 3.98V11H8v3h2.4v7h3.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8L15.6 12 10 15.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.78.12v-3.16a5.76 5.76 0 1 0 4.9 5.63V9.66a7.35 7.35 0 0 0 4.3 1.38V7.95a4.3 4.3 0 0 1-3.24-2.13Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.6 4.5 9 4l1.15 4.75-1.42.8a12.9 12.9 0 0 0 5.72 5.72l.8-1.42L20 15l-.5 2.4c-.22 1.06-1.15 1.8-2.23 1.8A12.47 12.47 0 0 1 4.8 6.73c0-1.08.74-2.01 1.8-2.23Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 6.5h15v11h-15v-11Zm.6.6 6.9 5.3 6.9-5.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10.2A6 6 0 0 0 6 10.8C6 15.8 12 21 12 21Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="10.8"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function FooterMenu({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: FooterQuery['menu'];
  primaryDomainUrl: FooterProps['header']['shop']['primaryDomain']['url'];
  publicStoreDomain: string;
}) {
  return (
    <nav className="footer-menu" role="navigation">
      {(menu || FALLBACK_FOOTER_MENU).items.map((item) => {
        if (!item.url) return null;
        // if the url is internal, we strip the domain
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        const isExternal = !url.startsWith('/');
        return isExternal ? (
          <a href={url} key={item.id} rel="noopener noreferrer" target="_blank">
            {item.title}
          </a>
        ) : (
          <NavLink
            end
            key={item.id}
            prefetch="intent"
            style={activeLinkStyle}
            to={url}
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

const FALLBACK_FOOTER_MENU = {
  id: 'gid://shopify/Menu/199655620664',
  items: [
    {
      id: 'gid://shopify/MenuItem/461633060920',
      resourceId: 'gid://shopify/ShopPolicy/23358046264',
      tags: [],
      title: 'Privacy Policy',
      type: 'SHOP_POLICY',
      url: '/policies/privacy-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633093688',
      resourceId: 'gid://shopify/ShopPolicy/23358013496',
      tags: [],
      title: 'Refund Policy',
      type: 'SHOP_POLICY',
      url: '/policies/refund-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633126456',
      resourceId: 'gid://shopify/ShopPolicy/23358111800',
      tags: [],
      title: 'Shipping Policy',
      type: 'SHOP_POLICY',
      url: '/policies/shipping-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633159224',
      resourceId: 'gid://shopify/ShopPolicy/23358079032',
      tags: [],
      title: 'Terms of Service',
      type: 'SHOP_POLICY',
      url: '/policies/terms-of-service',
      items: [],
    },
  ],
};

function activeLinkStyle({
  isActive,
  isPending,
}: {
  isActive: boolean;
  isPending: boolean;
}) {
  return {
    fontWeight: isActive ? 'bold' : undefined,
    color: isPending ? 'grey' : undefined,
  };
}
