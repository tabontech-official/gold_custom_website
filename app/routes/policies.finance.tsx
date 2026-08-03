import {Link} from 'react-router';

export default function Finance() {
  return (
    <div className="section-inner home-section">
      <div className="page">
        <h1>Shop Now, Pay Later</h1>

        <p>
          Split your payment into easy monthly installments. We partner with a
          selection of financing providers; you will complete the application on
          the provider’s secure website.
        </p>

        <h2>We Partner With</h2>
        <ul>
          <li>
            American First Finance — apply on their secure site.
          </li>
          <li>
            Progressive Leasing — lease-to-own financing. Not available in all
            states.
          </li>
          <li>
            Synchrony — flexible retail financing programs.
          </li>
          <li>
            Acima — affordable payments and lease options.
          </li>
        </ul>

        <h2>How it Works</h2>
        <ol>
          <li>Select the option that fits you best at checkout.</li>
          <li>Complete the application on the provider’s secure website.</li>
          <li>Once approved, text us and we’ll help finalize your purchase.</li>
        </ol>

        <p>
          <Link to="/">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
