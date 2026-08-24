import type {ReactNode} from 'react';
import {Link} from 'react-router';
import {Breadcrumb} from '~/components/Breadcrumb';

export function PolicyDocument({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="policy-page policy-document">
      <div className="section-inner policy-breadcrumb">
        <Breadcrumb
          items={[{label: 'Home', to: '/'}, {label: title}]}
        />
      </div>
      <section className="policy-hero">
        <div className="section-inner">
          <p className="policy-kicker">Gold Custom · Legal</p>
          <h1>{title}</h1>
        </div>
      </section>
      <article className="section-inner policy-rich-content">
        {children}
        <Link className="policy-home-link" to="/">
          Back to home
        </Link>
      </article>
    </main>
  );
}
