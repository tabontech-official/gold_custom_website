const METAL_RATES: {
  name: string;
  karat?: string;
  price: string;
  change: string;
  dir: 'up' | 'down';
}[] = [
  {name: 'Gold', karat: '24K', price: '$2,384.65', change: '0.45%', dir: 'up'},
  {name: 'Gold', karat: '22K', price: '$2,186.10', change: '0.42%', dir: 'up'},
  {name: 'Silver', karat: '925', price: '$28.65', change: '0.12%', dir: 'down'},
  {name: 'Platinum', price: '$1,023.80', change: '0.35%', dir: 'up'},
];

function MarketGroup({hidden}: {hidden?: boolean}) {
  return (
    <div className="market-group" aria-hidden={hidden || undefined}>
      {METAL_RATES.map((rate) => (
        <span className="market-rate" key={`${rate.name}-${rate.karat ?? ''}`}>
          <span className="market-rate-name">
            {rate.name}
            {rate.karat && <small> ({rate.karat})</small>}
          </span>
          <span className="market-rate-price">{rate.price}</span>
          <span className={`market-rate-change is-${rate.dir}`}>
            <span aria-hidden="true">{rate.dir === 'up' ? '▲' : '▼'}</span>
            {rate.change}
          </span>
        </span>
      ))}
    </div>
  );
}

export function MarketBar() {
  return (
    <section className="market-bar" aria-label="Live metal rates">
      <div className="market-track">
        <MarketGroup />
        <MarketGroup hidden />
        <MarketGroup hidden />
      </div>
    </section>
  );
}
