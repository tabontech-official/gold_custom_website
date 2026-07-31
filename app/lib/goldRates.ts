import {CacheCustom, type WithCache} from '@shopify/hydrogen';

/**
 * metals.dev spot gold for the homepage market bar.
 *
 * The free plan allows 100 requests/month, so one refresh per REFRESH_HOURS —
 * two calls, spot + timeseries — keeps us around 62. Errors are cached too,
 * otherwise a bad key or a blown quota turns into a request per page view and
 * burns the month in an afternoon. Between refreshes Oxygen serves the cached
 * quote (stale-while-revalidate keeps it serving even while the next fetch is
 * in flight).
 *
 * ponytail: budget is per Oxygen cache region, not global. One storefront
 * serving a couple of regions stays well under 100; if traffic ever spreads
 * worldwide, move the fetch to a scheduled job writing a metafield.
 */
const REFRESH_HOURS = 24;

const TROY_OUNCE_IN_GRAMS = 31.1034768;

export type GoldRates = {
  /** Spot price of fine (24K) gold, in `currency`. */
  gram: number;
  troyOunce: number;
  kilogram: number;
  currency: string;
  /** ISO timestamp of the quote itself — not of our fetch. */
  updatedAt: string;
  /** Percent move of spot against the last published close; null if unknown. */
  changePct: number | null;
};

type LatestResponse = {
  status?: string;
  currency?: string;
  metals?: {gold?: number};
  timestamps?: {metal?: string};
};

type TimeseriesResponse = {
  status?: string;
  /** metals.dev answers timeseries in troy ounces whatever `unit` we ask for. */
  unit?: string;
  rates?: Record<string, {metals?: {gold?: number}}>;
};

/**
 * Last daily close in the series, per gram. The feed publishes closes a day or
 * two behind, and skips weekends, so we ask for a week and take the newest day
 * rather than assuming yesterday exists.
 */
export function lastCloseGram(body: TimeseriesResponse): number | null {
  const days = Object.keys(body?.rates ?? {}).sort();
  const gold = body.rates?.[days.at(-1) ?? '']?.metals?.gold;
  if (typeof gold !== 'number' || gold <= 0) return null;
  return body.unit === 'toz' ? gold / TROY_OUNCE_IN_GRAMS : gold;
}

const isoDay = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

const RELATIVE = new Intl.RelativeTimeFormat('en', {numeric: 'auto'});

/** "10 hours ago" — clamped to the past, since a quote is never in the future. */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.min(0, Math.round((Date.parse(iso) - now) / 60000));
  if (minutes === 0) return 'just now'; // Intl says "this minute", which reads odd
  if (minutes > -60) return RELATIVE.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return RELATIVE.format(hours, 'hour');
  return RELATIVE.format(Math.round(hours / 24), 'day');
}

export async function getGoldRates(
  withCache: WithCache,
  env: Env,
): Promise<GoldRates | null> {
  const apiKey = (env as any).METALS_DEV_API_KEY as string | undefined;
  if (!apiKey) return null;

  return withCache.run(
    {
      cacheKey: ['gold-rates', 'v1'],
      cacheStrategy: CacheCustom({
        mode: 'public',
        maxAge: REFRESH_HOURS * 60 * 60,
        staleWhileRevalidate: 30 * 24 * 60 * 60,
      }),
      shouldCacheResult: () => true,
    },
    async () => {
      const get = (path: string) =>
        fetch(`https://api.metals.dev/v1/${path}&api_key=${apiKey}`, {
          headers: {Accept: 'application/json'},
        }).then((response) => response.json());

      try {
        const [body, series] = await Promise.all([
          get('latest?currency=USD&unit=g') as Promise<LatestResponse>,
          // Only the direction indicator depends on this one, so a failure here
          // must not cost us the price.
          (
            get(
              `timeseries?currency=USD&unit=g&start_date=${isoDay(-7)}&end_date=${isoDay()}`,
            ) as Promise<TimeseriesResponse>
          ).catch(() => ({}) as TimeseriesResponse),
        ]);
        const gram = body?.metals?.gold;

        if (body?.status !== 'success' || typeof gram !== 'number') {
          console.error('[gold-rates] unusable response', body?.status);
          return null;
        }

        const close = lastCloseGram(series);

        return {
          gram,
          troyOunce: gram * TROY_OUNCE_IN_GRAMS,
          kilogram: gram * 1000,
          currency: body.currency ?? 'USD',
          updatedAt: body.timestamps?.metal ?? new Date().toISOString(),
          changePct: close ? ((gram - close) / close) * 100 : null,
        };
      } catch (error) {
        console.error('[gold-rates]', error);
        return null;
      }
    },
  );
}
