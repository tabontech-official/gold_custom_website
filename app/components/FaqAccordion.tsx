import type {Faq} from '~/lib/faqs';

export function FaqAccordion({
  faqs,
  showHeading = true,
}: {
  faqs: Faq[];
  /**
   * The FAQ page prints its own H1, so a second "FAQs" heading directly under
   * it read as a duplicate — and its own block plus the section's top padding
   * left a band of empty space above the first question. Off there, on
   * everywhere else, where the accordion is one section among many and needs
   * naming.
   */
  showHeading?: boolean;
}) {
  if (!faqs.length) return null;

  return (
    <section
      className={`home-section homepage-faq-section${showHeading ? '' : ' is-headless'}`}
      // With no visible heading there is no element to point at, so the region
      // carries its own name rather than an aria-labelledby pointing at nothing.
      {...(showHeading
        ? {'aria-labelledby': 'homepage-faq-title'}
        : {'aria-label': 'Frequently asked questions'})}
    >
      <div className="section-inner">
        {showHeading && (
          <div className="editorial-heading">
            <h2 id="homepage-faq-title" className="editorial-title">
              FAQs
            </h2>
          </div>
        )}
        <div className="homepage-faq-panel">
          <div className="homepage-faq-list">
            {faqs.map((faq) => (
              <details className="homepage-faq-item" key={faq.question}>
                <summary>{faq.question}</summary>
                {faq.answerHtml ? (
                  <div
                    className="homepage-faq-answer"
                    dangerouslySetInnerHTML={{__html: faq.answerHtml}}
                  />
                ) : (
                  <p>{faq.answer}</p>
                )}
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
