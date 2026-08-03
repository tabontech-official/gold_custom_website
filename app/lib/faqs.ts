export type Faq = {question: string; answer: string};

function normalizeHandle(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function matchesSection(node: any, sectionHandle: string): boolean {
  const target = normalizeHandle(sectionHandle);
  const nodeHandle = normalizeHandle(node?.handle);
  if (nodeHandle === target || nodeHandle.startsWith(`${target}-`) || nodeHandle.endsWith(`-${target}`)) {
    return true;
  }

  return (node?.fields ?? []).some((field: any) => {
    const key = normalizeHandle(field?.key);
    return (
      ['section', 'section-handle', 'collection', 'collection-handle', 'category', 'category-handle', 'handle'].includes(key) &&
      normalizeHandle(field?.value) === target
    );
  });
}

/** Converts the JSON stored in the pages_faqs metaobject into FAQ entries.
 * When a collection handle is given, only that collection's metaobject is used;
 * a generic FAQ object is intentionally never used as a category fallback.
 */
export function parseFaqs(response: any, sectionHandle?: string): Faq[] {
  const nodes = response?.metaobjects?.nodes as any[] | undefined;
  if (!Array.isArray(nodes)) return [];
  const selectedNodes = sectionHandle
    ? nodes.filter((node) => matchesSection(node, sectionHandle))
    : nodes;

  for (const rawNode of selectedNodes) {
    const node = rawNode as any;
    const fields = node?.fields as any[] | undefined;
    if (!Array.isArray(fields)) continue;
    for (const rawField of fields) {
      const field = rawField as any;
      if (typeof field?.value !== 'string') continue;
      try {
        const parsed: any = JSON.parse(field.value);
        const entries = Array.isArray(parsed)
          ? parsed
          : parsed?.faqs ?? parsed?.items ?? parsed?.questions;
        if (!Array.isArray(entries)) continue;

        const faqs = entries
          .map((faq: any) => ({
            question: String(faq?.question ?? faq?.q ?? faq?.title ?? '').trim(),
            answer: String(faq?.answer ?? faq?.a ?? faq?.content ?? '').trim(),
          }))
          .filter((faq: Faq) => faq.question && faq.answer);
        if (faqs.length) return faqs;
      } catch {
        // This field is not the JSON FAQ field; keep checking the others.
      }
    }
  }
  return [];
}

/** Parses the metaobject linked directly from a collection FAQ metafield. */
export function parseFaqMetaobject(metaobject: any): Faq[] {
  return parseFaqs({metaobjects: {nodes: metaobject ? [metaobject] : []}});
}

/**
 * Parses a product's `custom.ai_faq` metafield. It is authored as schema.org
 * FAQPage JSON-LD, but tolerate the looser shapes too — the metafield is
 * populated by tooling, not a validated form.
 */
export function parseFaqMetafield(value?: string | null): Faq[] | null {
  if (!value) return null;
  try {
    const parsed: any = JSON.parse(value);
    const list =
      parsed?.mainEntity ?? (Array.isArray(parsed) ? parsed : parsed?.faqs);
    if (!Array.isArray(list)) return null;
    const faqs = list
      .map((faq: any) => ({
        question: String(faq?.name ?? faq?.question ?? faq?.q ?? '').trim(),
        answer: String(
          faq?.acceptedAnswer?.text ?? faq?.answer ?? faq?.a ?? '',
        ).trim(),
      }))
      .filter((faq: Faq) => faq.question && faq.answer);
    return faqs.length ? faqs : null;
  } catch {
    return null;
  }
}

/**
 * FAQPage JSON-LD. Only ever call this with authored FAQs — marking up
 * generated filler as Q&A is what earns a manual action.
 */
export function buildFaqJsonLd(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {'@type': 'Answer', text: faq.answer},
    })),
  };
}

export const FAQS_QUERY = `#graphql
  query Faqs($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    metaobjects(type: "pages_faqs", first: 100) {
      nodes {
        handle
        fields {
          key
          value
        }
      }
    }
  }
` as const;
