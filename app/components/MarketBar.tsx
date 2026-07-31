import {useEffect, useState} from 'react';
import {timeAgo, type GoldRates} from '~/lib/goldRates';

/** Copies of the rate list in the marquee — see the note in MarketBar. */
const COPIES = 6;

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount >= 10000 ? 0 : 2,
  }).format(amount);
}

const direction = (rates: GoldRates) =>
  rates.changePct === null ? '' : rates.changePct < 0 ? 'is-down' : 'is-up';

// Unit sits right on the number: per-kilo is per-gram x 1000, so "$131.04" and
// "$131,043" read as the same figure unless the label is impossible to miss.
function unitsOf(rates: GoldRates) {
  return [
    {unit: '/ gram', price: money(rates.gram, rates.currency)},
    {unit: '/ troy oz', price: money(rates.troyOunce, rates.currency)},
    {unit: '/ kilo', price: money(rates.kilogram, rates.currency)},
  ];
}

function MarketGroup({
  rates,
  updated,
  hidden,
}: {
  rates: GoldRates;
  updated: string;
  hidden?: boolean;
}) {
  return (
    <div
      className={`market-group ${direction(rates)}`}
      aria-hidden={hidden || undefined}
    >
      <span className="market-rate-name">
        Gold <small>24K</small>
      </span>
      {rates.changePct !== null && (
        <span
          className={`market-rate-change ${direction(rates)}`}
          title="Spot versus the last published close"
        >
          <span aria-hidden="true">{rates.changePct < 0 ? '▼' : '▲'}</span>
          {Math.abs(rates.changePct).toFixed(2)}%
        </span>
      )}
      {unitsOf(rates).map((row) => (
        <span className="market-rate" key={row.unit}>
          <span className="market-rate-price">{row.price}</span>
          <span className="market-rate-unit">{row.unit}</span>
        </span>
      ))}
      {updated && <span className="market-feed-note">Updated {updated}</span>}
    </div>
  );
}

export function MarketBar({rates}: {rates: GoldRates | null}) {
  // Rendered client-side only: the age changes between SSR and hydration.
  const [updated, setUpdated] = useState('');

  useEffect(() => {
    if (!rates) return;
    const tick = () => setUpdated(timeAgo(rates.updatedAt));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [rates]);

  if (!rates) return null;

  return (
    <section className="market-bar" aria-label="Live gold rates">
      <div className="market-track">
        {/* The loop shifts by exactly one group, so the other COPIES - 1 have to
            span the widest viewport or the tail of the scroll runs out of
            content. Keep in sync with marketScroll's translateX in app.css. */}
        {Array.from({length: COPIES}, (_, i) => (
          <MarketGroup key={i} rates={rates} updated={updated} hidden={i > 0} />
        ))}
      </div>
    </section>
  );
}
