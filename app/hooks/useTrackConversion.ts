import {useEffect, useRef} from 'react';
import {useAnalytics} from '@shopify/hydrogen';

/**
 * Reports a form conversion to GA4 (and optionally Meta) once, when the form
 * actually succeeds.
 *
 * Tracking the submit instead would be wrong: /api/subscribe and
 * /api/appointment both reject invalid and duplicate submissions, so a shopper
 * who mistypes their email twice before getting it right would arrive in GA4
 * as three sign-ups. Success is the only signal that means what the event name
 * claims.
 *
 * The ref, not the effect's dependency list, is what makes it fire once: the
 * fetcher's data survives across re-renders, so `succeeded` stays true for the
 * rest of the component's life.
 *
 * Delivery is still gated by consent — this publishes through
 * `Analytics.Provider`, whose `publish` is a no-op until the visitor allows
 * tracking. See app/components/AnalyticsBridge.tsx.
 */
export function useTrackConversion(
  succeeded: boolean,
  event: string,
  /** GA4's `method` param — which surface the shopper converted on. */
  method: string,
  /** Meta standard event name, when this conversion is one Meta models too. */
  metaEvent?: string,
) {
  const {publish} = useAnalytics();
  const sent = useRef(false);

  useEffect(() => {
    if (!succeeded || sent.current) return;
    sent.current = true;
    publish('custom_ga4', {event, params: {method}, metaEvent});
  }, [succeeded, event, method, metaEvent, publish]);
}
