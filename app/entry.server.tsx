import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {
  createContentSecurityPolicy,
  type HydrogenRouterContextProvider,
} from '@shopify/hydrogen';
import type {EntryContext} from 'react-router';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.shopify.com',
      // Tidio live chat. The widget renders into a JS-created about:blank
      // iframe, which inherits this origin, so frameSrc needs nothing.
      'https://code.tidio.co',
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
      'https://static.elfsight.com',
      'https://*.elfsight.com',
      // Reputon TikTok feed.
      'https://cdn.ttw.reputon.com',
      // GA4 (gtag.js) and the Meta pixel. `'unsafe-inline'` above is inert
      // here — Hydrogen puts a nonce in script-src, and a nonce makes browsers
      // ignore 'unsafe-inline' — so these host entries are what actually admit
      // the two vendor bundles, including fbevents.js, which Meta's bootstrap
      // injects via createElement and which therefore carries no nonce.
      'https://www.googletagmanager.com',
      'https://connect.facebook.net',
    ],
    // Allow embedded product videos (YouTube / Vimeo) and hosted Shopify video.
    frameSrc: [
      "'self'",
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://player.vimeo.com',
      'https://www.google.com',
      'https://maps.google.com',
      'https://elfsight.com',
      'https://*.elfsight.com',
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
      // Reputon renders each clip in TikTok's own player iframe
      // (tiktok.com/player/v1/<id>).
      'https://www.tiktok.com',
    ],
    // Hosted product videos are served from the store's own domain
    // (e.g. goldcustom.com/cdn/shop/videos/...), not cdn.shopify.com.
    mediaSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://*.shopifycdn.com',
      `https://${context.env.PUBLIC_STORE_DOMAIN}`,
      'https://goldcustom.com',
      // Tidio's notification sounds.
      'https://code.tidio.co',
      // TikTok clip mp4s (v15m/v16m/v19/v45/v77 hosts, three regional CDNs).
      'https://*.tiktokcdn.com',
      'https://*.tiktokcdn-us.com',
      'https://*.tiktokcdn-eu.com',
      'blob:',
      'data:',
    ],
    imgSrc: [
      "'self'",
      'https://cdn.shopify.com',
      // Agent avatars and images sent in chat. Tidio renders emoji as twemoji
      // images served from cdnjs, not from its own domain.
      'https://*.tidio.co',
      'https://cdnjs.cloudflare.com',
      'https://i.ytimg.com',
      'https://i.vimeocdn.com',
      'https://elfsight.com',
      'https://*.elfsight.com',
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
      // TikTok clip posters and avatars (p16/p19 hosts).
      'https://*.tiktokcdn.com',
      'https://*.tiktokcdn-us.com',
      'https://*.tiktokcdn-eu.com',
      // Analytics still measure over image beacons, not only fetch: GA4 falls
      // back to one when sendBeacon is unavailable, Meta's /tr endpoint is an
      // image by design, and the doubleclick/google.com hosts are the
      // remarketing pings that fire once a visitor consents to marketing.
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://www.facebook.com',
      'https://stats.g.doubleclick.net',
      'https://www.google.com',
      'data:',
    ],
    // Google Fonts (stylesheet + font files).
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.shopify.com',
      'https://fonts.googleapis.com',
    ],
    fontSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://fonts.gstatic.com',
      // Tidio bundles its own Inter/Mulish webfonts.
      'https://code.tidio.co',
      'data:',
    ],
    connectSrc: [
      "'self'",
      'https://cdn.shopify.com',
      // Chat transport. The message socket only opens once a visitor actually
      // starts a conversation, so it isn't exercised by a plain page load —
      // check DevTools during a real chat before trusting this line.
      'https://*.tidio.co',
      'wss://*.tidio.co',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://elfsight.com',
      'https://*.elfsight.com',
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
      'https://core.service.elfsight.com',
      // Reputon's content API — /app/storefront/content?shop=...
      'https://ttw.reputon.com',
      // GA4 measurement traffic. Every one of these is a host gtag.js was
      // observed hitting in the browser console — the list is not theoretical,
      // and it is longer than Google's own documented CSP because that one is
      // wrong in two places.
      //
      // `analytics.google.com` is listed WITHOUT a wildcard as well as with
      // one: in CSP `*.analytics.google.com` matches subdomains only, never
      // the bare host, and the bare host is exactly where GA4 sends
      // `/g/collect`. Google's published snippet omits it and every page view
      // gets refused.
      //
      // The `*.google-analytics.com` wildcard is the regional collector
      // (region1, region12, …) which varies by visitor, so the bare host alone
      // drops sessions outside the US.
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://analytics.google.com',
      'https://*.analytics.google.com',
      'https://www.googletagmanager.com',
      // Google Signals / Ads remarketing pings, fired only once a visitor
      // consents to marketing. Note the limitation: the audience ping goes to
      // the visitor's own Google ccTLD (www.google.co.uk, www.google.com.pk),
      // and CSP cannot wildcard a TLD — so a non-US visitor's remarketing ping
      // is refused unless that country's domain is added here by hand. Store
      // traffic is US, where this covers it.
      'https://stats.g.doubleclick.net',
      'https://www.google.com',
      // Meta pixel: the bundle, and the /tr endpoint it posts events to.
      'https://connect.facebook.net',
      'https://www.facebook.com',
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
