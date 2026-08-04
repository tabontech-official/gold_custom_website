import {splitDescriptionByHeading} from '~/lib/description';

/**
 * Shopify description HTML as a visible intro plus one collapsable panel per
 * heading. Shared by product copy (`h5`) and collection copy (`h2`); the
 * `product-*` class names are what the description styles have always hung
 * off, so both get the same type scale, bullets and chevron for free.
 */
export function DescriptionAccordions({
  html,
  headingTag,
}: {
  html?: string | null;
  headingTag: 'h2' | 'h5';
}) {
  const {intro, sections} = splitDescriptionByHeading(html || '', headingTag);
  if (!intro && !sections.length) return null;

  return (
    <div className="product-accordions">
      {intro && (
        <div
          className="product-description-intro"
          dangerouslySetInnerHTML={{__html: intro}}
        />
      )}

      {/* Heading as key: it is unique within a description across the whole
          catalogue today (429 collection sections, 0 collisions). A future
          duplicate surfaces as React's own dev warning rather than silently
          mis-reconciling, which an index key would hide. */}
      {sections.map((section) => (
        <details className="product-details" key={section.heading}>
          {/* innerHTML, not a text child: the heading still carries its source
              entities and React would escape the `&` in `Design &amp; Features`
              a second time. Tags are stripped in the splitter, and the body
              below trusts the same merchant HTML, so this widens nothing. */}
          <summary dangerouslySetInnerHTML={{__html: section.heading}} />
          <div
            className="product-details-body"
            dangerouslySetInnerHTML={{__html: section.body}}
          />
        </details>
      ))}
    </div>
  );
}
