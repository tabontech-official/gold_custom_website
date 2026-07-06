import {Suspense} from 'react';
import {Await, Link, NavLink} from 'react-router';
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
  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {(footer) => (
          <footer className="footer">
            <div className="footer-main">
              <div className="footer-left">
                <div className="footer-brand">{header.shop.name}</div>
                <p>
                  Fine jewelry and watches, crafted for every moment that
                  matters.
                </p>
                <div className="footer-social">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                  >
                    <InstagramIcon />
                  </a>
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                  >
                    <FacebookIcon />
                  </a>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="YouTube"
                  >
                    <YoutubeIcon />
                  </a>
                  <a
                    href="https://tiktok.com"
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
                      <Link to="/collections/diamond">Diamond & Engagement</Link>
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
                      <Link to="/policies/privacy-policy">Your Privacy Choices</Link>
                    </li>
                    <li>
                      <Link to="/faq">FAQ</Link>
                    </li>
                    <li>
                      <Link to="/contact">Contact Us</Link>
                    </li>
                    <li>
                      <Link to="/blogs">Blog</Link>
                    </li>
                  </ul>
                </div>

                <div className="footer-col">
                  <h4>Find Us</h4>
                  <ul>
                    <li>10 W 46th St, Floor 17, New York, NY 10036</li>
                    <li>Mon &ndash; Fri 10am &ndash; 6pm EST</li>
                    <li>Sat &ndash; Sun Closed</li>
                    <li>
                      <a href="tel:9299305655">929-930-5655</a>
                    </li>
                    <li>
                      <a href="mailto:info@bayamjewelry.com">info@bayamjewelry.com</a>
                    </li>
                    <li>
                      <a href="/contact">Book an Appointment</a>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="footer-newsletter aside">
                <div className="footer-newsletter-copy">
                  <h3>GET AN EXTRA 10% OFF</h3>
                  <p>when you sign up to receive SMS Updates</p>
                </div>
                <form className="footer-newsletter-form" onSubmit={(e) => e.preventDefault()}>
                  <input
                    type="text"
                    name="phone"
                    placeholder="Enter Mobile Number"
                    aria-label="Mobile number"
                    required
                  />
                  <button type="submit" className="btn btn-primary">SUBSCRIBE</button>
                </form>
                <p style={{fontSize: '0.75rem', color: 'var(--color-ink-soft)'}}>
                  By submitting this form, you agree to receive recurring automated promotional and personalized marketing text messages.
                </p>
              </div>
            </div>

            <div className="footer-bottom">
              <div className="footer-bottom-left">
                <span>&copy; {new Date().getFullYear()} {header.shop.name}. All rights reserved.</span>
                <nav className="footer-bottom-links">
                  <Link to="/policies/privacy-policy">Privacy</Link>
                  <Link to="/policies/terms-of-service">Terms</Link>
                  <Link to="/accessibility">Accessibility</Link>
                </nav>
              </div>
              <div className="footer-payments">
                Visa &middot; Mastercard &middot; Amex &middot; PayPal &middot; Apple Pay
              </div>
            </div>
          </footer>
        )}
      </Await>
    </Suspense>
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
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 9h2.5V6H14c-2 0-3.5 1.6-3.5 3.6V12H8v3h2.5v6h3v-6h2.4l.4-3h-2.8v-2.1c0-.6.4-.9 1-.9Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
      />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect
        x="2.5"
        y="5.5"
        width="19"
        height="13"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 3v10.8a2.7 2.7 0 1 1-2.2-2.66"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 3c.3 2 1.8 3.5 3.8 3.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
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
    color: isPending ? 'grey' : 'white',
  };
}
