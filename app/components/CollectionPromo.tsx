import {Link} from 'react-router';

export function CollectionPromo({
  eyebrow,
  heading,
  copy,
  ctaLabel,
  ctaTo,
}: {
  eyebrow: string;
  heading: string;
  copy: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <section className="collection-promo">
      <div className="section-inner collection-promo-inner">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{heading}</h2>
        <p>{copy}</p>
        <Link className="btn btn-outline" to={ctaTo}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
