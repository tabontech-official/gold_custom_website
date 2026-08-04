import type {Faq} from '~/lib/faqs';

export function FaqAccordion({faqs}: {faqs: Faq[]}) {
  if (!faqs.length) return null;

  return (
    <section className="home-section homepage-faq-section" aria-labelledby="homepage-faq-title">
      <div className="section-inner">
        <div className="editorial-heading">
          <h2 id="homepage-faq-title" className="editorial-title">FAQs</h2>
        </div>
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
