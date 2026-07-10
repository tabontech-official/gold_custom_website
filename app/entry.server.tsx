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
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
      'https://static.elfsight.com',
      'https://*.elfsight.com',
    ],
    // Allow embedded product videos (YouTube / Vimeo) and hosted Shopify video.
    frameSrc: [
      "'self'",
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://player.vimeo.com',
      'https://elfsight.com',
      'https://*.elfsight.com',
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
    ],
    // Hosted product videos are served from the store's own domain
    // (e.g. goldcustom.com/cdn/shop/videos/...), not cdn.shopify.com.
    mediaSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://*.shopifycdn.com',
      `https://${context.env.PUBLIC_STORE_DOMAIN}`,
      'https://goldcustom.com',
      'blob:',
      'data:',
    ],
    imgSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://i.ytimg.com',
      'https://i.vimeocdn.com',
      'https://elfsight.com',
      'https://*.elfsight.com',
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
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
      'data:',
    ],
    connectSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://elfsight.com',
      'https://*.elfsight.com',
      'https://elfsightcdn.com',
      'https://*.elfsightcdn.com',
      'https://core.service.elfsight.com',
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
