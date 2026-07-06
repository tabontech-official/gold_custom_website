import type {ReactNode} from 'react';

const FEATURES: {icon: ReactNode; title: string; sub: string}[] = [
  {
    icon: <ShippingIcon />,
    title: 'Free U.S. Shipping',
    sub: 'On orders over $99',
  },
  {
    icon: <ReturnsIcon />,
    title: '14 Day Returns',
    sub: 'Terms & conditions apply',
  },
  {
    icon: <MadeInUsaIcon />,
    title: 'Made in U.S.A',
    sub: 'From our factory to you',
  },
  {
    icon: <WarrantyIcon />,
    title: '1 Year Free Warranty',
    sub: 'On all production defects',
  },
];

export function FeatureStrip() {
  return (
    <div className="feature-strip">
      {FEATURES.map((feature) => (
        <div className="feature-strip-item" key={feature.title}>
          <span className="feature-strip-icon" aria-hidden="true">
            {feature.icon}
          </span>
          <span className="feature-strip-text">
            <span className="feature-strip-title">{feature.title}</span>
            <span className="feature-strip-sub">{feature.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function ShippingIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 9.5h4l3.5 3.5v2.5h-7.5z" />
      <circle cx="7" cy="18" r="1.7" />
      <circle cx="17.5" cy="18" r="1.7" />
    </svg>
  );
}

function ReturnsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3.5V8h-4.5" />
    </svg>
  );
}

function MadeInUsaIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="9" r="5.2" />
      <path d="M8.6 13.2 7.5 21l4.5-2.3L16.5 21l-1.1-7.8" />
      <path d="m12 6 .95 1.95 2.15.3-1.55 1.5.37 2.14L12 10.9l-1.92 1 .37-2.14L8.9 8.25l2.15-.3z" />
    </svg>
  );
}

function WarrantyIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 2.5 19 5.5v5.4c0 4.6-3 7.9-7 9.6-4-1.7-7-5-7-9.6V5.5z" />
      <path d="m8.8 11.8 2.2 2.2 4.2-4.4" />
    </svg>
  );
}
