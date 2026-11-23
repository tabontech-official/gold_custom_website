/**
 * Shopify's own collection facets (Metal and any other variant option),
 * counted as grid CARDS instead of products.
 *
 * Shopify counts products. The grid shows one card per `custom.group_name`
 * (groupProducts), so "10K Yellow Gold (19)" on Nugget Earrings opened a grid
 * of 12. These counts come from the collection's facet index (lib/facets)
 * instead, put through the grid's own grouping.
 *
 * Shopify counts a facet value against every OTHER active filter, not its own
 * group: with 10K Yellow Gold ticked, 10K White Gold still reads as if Metal
 * were unfiltered. So each group is counted from an index loaded under the
 * active filters minus that group's own (`indexFor`). The route loads that
 * extra index only for a group that has something ticked.
 *
 * Only what the index can answer exactly is counted: variant options. Any
 * other value (tag, type, vendor, metafield, availability) gets no count, and
 * the sidebar shows no badge for it rather than a product count.
 *
 * Plain TS, type-only imports, so `node app/lib/groupedFacetCounts.test.ts`
 * runs it.
 */
import type {IndexedProduct} from './facets';

/** A Shopify facet as the collection query returns it. */
export type ShopifyFacet = {
  id: string;
  label: string;
  type: string;
  values: {label: string; input: unknown}[];
};

function parse(input: unknown): Record<string, any> | null {
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }
  return input && typeof input === 'object'
    ? (input as Record<string, any>)
    : null;
}

const norm = (text: unknown) =>
  String(text ?? '')
    .trim()
    .toLowerCase();

/**
 * Option names and values compare the way Shopify's option filter does:
 * ignoring case but NOT surrounding spaces. Two engagement rings carry a
 * " Metal" option; Shopify's Metal facet leaves them out, so a trimmed match
 * counted 192 cards for a box that opens 190.
 */
const optionText = (text: unknown) => String(text ?? '').toLowerCase();

/**
 * The facet group a filter input belongs to. Every Metal value shares
 * `option:metal`; metafields are told apart by namespace and key.
 */
export function filterGroupKey(input: unknown): string | null {
  const filter = parse(input);
  if (!filter) return null;
  if (filter.variantOption) {
    return `option:${optionText(filter.variantOption.name)}`;
  }
  for (const kind of ['productMetafield', 'variantMetafield']) {
    if (filter[kind]) {
      return `${kind}:${filter[kind].namespace}.${filter[kind].key}`;
    }
  }
  return Object.keys(filter)[0] ?? null;
}

/** Whether the product has this value; null when the index can't tell. */
export function matchesInput(
  product: Pick<IndexedProduct, 'options'>,
  input: unknown,
): boolean | null {
  const filter = parse(input);
  if (!filter?.variantOption) return null;
  const wanted = optionText(filter.variantOption.value);
  const values = product.options[optionText(filter.variantOption.name)] ?? [];
  return values.some((value) => optionText(value) === wanted);
}

/** Key the sidebar looks a count up by: facet id plus its de-duplicated label. */
export function countKey(facetId: string, label: string) {
  return `${facetId}|${norm(label)}`;
}

/** Whether the sidebar renders this facet as a list of counted boxes. */
export function isCountedFacet(facet: Pick<ShopifyFacet, 'label' | 'type'>) {
  return facet.type !== 'PRICE_RANGE' && !/availability/i.test(facet.label);
}

/**
 * Card counts for every countable value, keyed by countKey. Values sharing a
 * label (the sidebar merges them into one row) are counted as one: a card is
 * counted once even when it matches several of them.
 */
export function cardCounts<T extends IndexedProduct>({
  facets,
  indexFor,
  also = () => true,
  group,
}: {
  facets: ShopifyFacet[];
  /** The index to count a group against; null leaves that group uncounted. */
  indexFor: (groupKey: string) => T[] | null;
  /** Filters Shopify does not know about (Karat/Carat/Style). */
  also?: (product: T) => boolean;
  /** The grid's grouping — groupForGrid. */
  group: (products: T[]) => unknown[];
}): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const facet of facets) {
    if (!isCountedFacet(facet) || !facet.values.length) continue;
    const groupKey = filterGroupKey(facet.values[0].input);
    const index = groupKey ? indexFor(groupKey) : null;
    if (!index) continue;
    const pool = index.filter(also);

    const inputsByLabel = new Map<string, unknown[]>();
    for (const value of facet.values) {
      const key = countKey(facet.id, value.label);
      inputsByLabel.set(key, [...(inputsByLabel.get(key) ?? []), value.input]);
    }

    for (const [key, inputs] of inputsByLabel) {
      if (inputs.some((input) => matchesInput({options: {}}, input) === null)) {
        continue;
      }
      const matched = pool.filter((product) =>
        inputs.some((input) => matchesInput(product, input)),
      );
      counts[key] = group(matched).length;
    }
  }
  return counts;
}
