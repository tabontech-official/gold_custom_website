/**
 * HowTo schema for step-by-step guide content in blog articles.
 *
 * THE AUTHORING CONVENTION, which is the whole point of this file: a post gets
 * HowTo markup when it contains a heading that starts with "How to …" followed
 * by an ORDERED list. Nothing else opts a post in. Write a guide that way and
 * the schema appears on publish; write a comparison or a tips post and it does
 * not. No metafield to fill in, no admin setup, and it applies retroactively to
 * anything already published in that shape.
 *
 * Deriving from the content rather than guessing from the title is deliberate.
 * Half this blog's "How to…" posts are not sequential at all — the ring sizing
 * guide is four ALTERNATIVE methods, "How to Tell if Gold Is Real" is nine
 * independent tests — and calling those steps would describe a procedure the
 * page does not contain. Google's structured data policy treats markup that
 * misrepresents page content as spam, so the rule is narrow on purpose:
 *
 *   - the heading immediately above the list must itself read as the task
 *     ("How to Clean Solid Gold Jewelry Safely"), which is what makes it the
 *     HowTo's `name`;
 *   - an <ol> under "Table of Contents" is a navigation aid, not a procedure,
 *     and is skipped for exactly this reason — that list was the one real
 *     false positive when this was checked across the catalogue;
 *   - two items minimum, because a one-step procedure is not one.
 *
 * ON RICH RESULTS: Google DEPRECATED the HowTo rich result in September 2023 —
 * it no longer renders in Search, the Search Console report was retired, and
 * the Rich Results Test no longer reports HowTo at all. This markup is emitted
 * for the other consumers named in the brief: AI answer engines and any crawler
 * reading schema.org directly. Validate it with validator.schema.org, not the
 * Rich Results Test, which will correctly say "no items detected".
 */

export type HowToStep = {name: string; text: string};
export type HowTo = {name: string; steps: HowToStep[]};

/** Tags out, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The procedures described in an article's HTML, in document order.
 *
 * Returns an empty array for anything that is not shaped like a procedure,
 * which is most posts — that is the intended outcome, not a failure.
 */
export function extractHowTos(contentHtml?: string | null): HowTo[] {
  if (!contentHtml) return [];
  const howTos: HowTo[] = [];

  for (const list of contentHtml.matchAll(/<ol[^>]*>([\s\S]*?)<\/ol>/g)) {
    const headings = [
      ...contentHtml
        .slice(0, list.index)
        .matchAll(/<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/g),
    ];
    const heading = headings.length
      ? textOf(headings[headings.length - 1][2])
      : '';
    if (!/^how to\b/i.test(heading)) continue;

    const steps = [...list[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      .map((item) => textOf(item[1]))
      .filter(Boolean)
      .map((text) => {
        // First sentence is the instruction, the rest is the elaboration —
        // which is exactly HowToStep's `name` vs `text` split.
        const sentence = text.match(/^(.*?[.!?])(?:\s|$)/);
        return {name: sentence ? sentence[1] : text.slice(0, 80), text};
      });

    if (steps.length < 2) continue;
    howTos.push({name: heading, steps});
  }

  return howTos;
}

/**
 * schema.org HowTo nodes for an article, ready to drop into `jsonLd`.
 *
 * `@id` is suffixed per procedure so a guide describing two of them stays two
 * distinct nodes, and each points back at the article it came from.
 */
export function buildHowToJsonLd(
  contentHtml: string | null | undefined,
  articleUrl: string,
  image?: string | null,
) {
  return extractHowTos(contentHtml).map((howTo, index) => ({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${articleUrl}#howto${index > 0 ? `-${index + 1}` : ''}`,
    name: howTo.name,
    mainEntityOfPage: articleUrl,
    image: image ? [image] : undefined,
    step: howTo.steps.map((step, position) => ({
      '@type': 'HowToStep',
      position: position + 1,
      name: step.name,
      text: step.text,
    })),
  }));
}
