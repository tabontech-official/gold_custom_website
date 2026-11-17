/**
 * PDP spec helpers: the structured Weight row and the merchant's own
 * "Size & Weight" copy have to agree without either swallowing the other.
 *
 * The structured row (ProductSpecsLine in products.$handle.tsx) shows ONE fact:
 * the selected variant's gold weight, and only when it is a real number above
 * zero. The merchant section, checked against the live Storefront API
 * (987 of 4,816 products), carries Length/Width and — on 87 diamond pieces —
 * center/side stone carats, total diamond weight and stone counts. None of
 * that is printed anywhere else, so none of it may be removed. The only line
 * that would repeat the structured row is a plain gold/metal weight line, and
 * only while that row is actually rendering.
 */

export const WEIGHT_UNIT_ABBR: Record<string, string> = {
  GRAMS: 'g',
  KILOGRAMS: 'kg',
  OUNCES: 'oz',
  POUNDS: 'lb',
};

/**
 * Shopify stores "no weight entered" as 0 (often in POUNDS), so 0 is never a
 * real gold weight. Returns the display label, or null when there is nothing
 * true to show.
 */
export function variantWeightLabel(
  weight?: number | null,
  weightUnit?: string | null,
): string | null {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return null;
  }
  const unit = WEIGHT_UNIT_ABBR[weightUnit ?? ''] ?? weightUnit ?? '';
  return `Approx. ${weight}${unit}`;
}

const SIZE_WEIGHT_SECTION =
  /(<h[1-6][^>]*>\s*size\s*(?:&amp;|&|and)\s*weight\s*<\/h[1-6]>)([\s\S]*?)(?=<h[1-6]|$)/i;

/**
 * A line whose label is the piece's gold weight and nothing more specific:
 * "Weight:", "Approx Weight:", "Gold Weight:", "Metal Weight:". Deliberately
 * NOT "Total Diamond Weight", "Center Stone Weight", "Weight of Side Stones" —
 * those are stone facts the structured row never shows.
 */
const GOLD_WEIGHT_LABEL =
  /^(?:approx(?:imate|\.)?\s+)?(?:(?:gold|metal|item|net)\s+)?weight\s*:/i;

function lineText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes, from the merchant's "Size & Weight" section only, the gold-weight
 * line(s) the structured Weight row already shows. Everything else in the
 * section — dimensions, stone carats, stone counts — is kept untouched. When
 * the structured row is not rendering (no weight, or zero), nothing is removed,
 * so the copy is the only place the buyer can read it.
 *
 * If removing the line leaves the heading with no content under it, the
 * heading goes too rather than rendering an empty "Size & Weight" title.
 */
export function stripDuplicatedSpecLines(
  html: string | null | undefined,
  {weightShown}: {weightShown: boolean},
): string {
  if (!html) return '';

  return html.replace(SIZE_WEIGHT_SECTION, (whole, heading: string, body: string) => {
    // 434 products carry the heading over an empty body; never render a
    // bare "Size & Weight" title.
    if (!lineText(body)) return '';
    if (!weightShown) return whole;
    // One chunk per visual line: each ends at </p>, </li> or <br>.
    const chunks = body.split(/(?<=<\/p>|<\/li>|<br\s*\/?>)/i);
    let removed = false;
    const kept = chunks.map((chunk) => {
      if (!GOLD_WEIGHT_LABEL.test(lineText(chunk))) return chunk;
      removed = true;
      // Keep any list/container opener that happens to lead the chunk.
      const opener = chunk.match(/^\s*(?:<(?:ul|ol|div)[^>]*>\s*)*/i)?.[0] ?? '';
      return opener;
    });
    if (!removed) return whole;
    const newBody = kept.join('');
    return lineText(newBody) ? heading + newBody : '';
  });
}
