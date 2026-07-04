const FEATURES = [
  {icon: '✦', label: 'Lifetime Warranty'},
  {icon: '⤴', label: 'Lifetime Upgrade'},
  {icon: '🚚', label: 'Free Shipping & Returns'},
  {icon: '%', label: '0% APR Financing'},
];

export function FeatureStrip() {
  return (
    <div className="feature-strip">
      {FEATURES.map((feature) => (
        <div className="feature-strip-item" key={feature.label}>
          <span className="feature-strip-icon" aria-hidden="true">
            {feature.icon}
          </span>
          <span>{feature.label}</span>
        </div>
      ))}
    </div>
  );
}
