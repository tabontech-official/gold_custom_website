export type DescriptionSection = {heading: string; body: string};

export type DescriptionFaq = {
  question: string;
  /** Plain text, for JSON-LD and any text-only consumer. */
  answer: string;
  /** Source markup — 4 answers link out and 6 run to several paragraphs. */
  answerHtml: string;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

/** Markup to readable text. Entities must be decoded here: the result is
 *  rendered as a React text child, which would escape a raw `&amp;` again.
 *
 *  Strip order is load-bearing — tags first, THEN entities. Decoding first
 *  would turn an encoded `&lt;b&gt;` into a real-looking tag that the strip
 *  then eats, silently deleting text the author wrote.
 *
 *  Exported because `metaDescription` needs the same treatment: it used to
 *  only collapse whitespace, so policy pages shipped meta descriptions
 *  starting with a literal "&nbsp;". */
export function toText(html: string): string {
  return html
    // A space, not an empty string: block tags butt words together
    // ("...gold.</p><p>Free shipping..." became "gold.Free shipping").
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (match, entity) => ENTITIES[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull the FAQ block out of a collection description.
 *
 * The copy is authored as one rich-text field, with the FAQs written inline:
 * an `<h2>` reading "FAQs" (or "Frequently Asked Questions"), then one `<h3>`
 * per question and the answer markup up to the next `<h3>`. Those become the
 * collapsable accordion; `rest` is everything else, rendered as ordinary prose.
 *
 * The block ends at the next `<h2>`, not at the end of the field — 4 of the 11
 * collections with FAQs carry on with more sections afterwards, and that copy
 * has to stay in `rest`.
 */
export function extractFaqsFromDescription(html?: string | null): {
  faqs: DescriptionFaq[];
  rest: string;
} {
  if (!html?.trim()) return {faqs: [], rest: ''};

  let headingStart = -1;
  let headingEnd = -1;
  for (const match of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
    // Test the heading's text, not its markup: `dir="ltr"` and nested spans
    // would otherwise decide what counts as an FAQ.
    if (/\b(faqs?|frequently asked)\b/i.test(toText(match[1]))) {
      headingStart = match.index;
      headingEnd = match.index + match[0].length;
      break;
    }
  }
  if (headingStart === -1) return {faqs: [], rest: html};

  const after = html.slice(headingEnd);
  const nextHeading = after.search(/<h2[^>]*>/i);
  const block = nextHeading === -1 ? after : after.slice(0, nextHeading);
  const rest =
    html.slice(0, headingStart) +
    (nextHeading === -1 ? '' : after.slice(nextHeading));

  const faqs = block
    .split(/<h3[^>]*>/i)
    .slice(1)
    .map((part) => {
      const [question, ...answer] = part.split(/<\/h3>/i);
      const answerHtml = answer.join('').trim();
      return {
        question: toText(question),
        answer: toText(answerHtml),
        answerHtml,
      };
    })
    .filter((faq) => faq.question && faq.answerHtml);

  return {faqs, rest: rest.trim()};
}

/**
 * Split Shopify description HTML into a visible intro and collapsable sections.
 *
 * The copy is written in the admin's rich-text editor, so the heading level is
 * the only structure that reliably survives: product descriptions lead each
 * block with `<h5>`, collection descriptions with `<h2>`. Everything before the
 * first heading is the intro and stays visible; each heading, plus the markup
 * up to the next one, becomes a panel.
 *
 * Headings keep their source entities (`Design &amp; Features`) on purpose —
 * render them as HTML, never as a React text child, or the `&` is escaped a
 * second time and the page shows a literal `&amp;`.
 */
export function splitDescriptionByHeading(
  html: string,
  tag: 'h2' | 'h5',
): {intro: string; sections: DescriptionSection[]} {
  const parts = html.split(new RegExp(`<${tag}[^>]*>`, 'i'));
  const closing = new RegExp(`</${tag}>`, 'i');

  const sections = parts.slice(1).map((part) => {
    const [heading, ...rest] = part.split(closing);
    return {
      heading: heading.replace(/<[^>]+>/g, '').trim(),
      body: rest.join(''),
    };
  });

  return {
    intro: parts[0]?.trim() || '',
    // The editor leaves stray `<h2><b><br></b></h2>` stubs behind (2 of the 429
    // collection sections today). They strip to an empty heading over an empty
    // body, and would otherwise render an unclickable blank panel.
    sections: sections.filter((section) => section.heading),
  };
}
