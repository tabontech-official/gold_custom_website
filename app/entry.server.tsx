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
