import {TRUST_CLAIMS} from './trustClaims.ts';

export type SitePolicies = {
  shipping: string;
  returns: string;
  warranty: string;
  madeInUSA: string;
};

export const SITE_POLICIES_QUERY = `#graphql
  query SitePolicies {
    metaobject(handle: {handle: "storewide-policies", type: "site_policies"}) {
      fields { key value }
    }
  }
` as const;

const fallbackPolicies: SitePolicies = {
  shipping: `${TRUST_CLAIMS[0].title} — ${TRUST_CLAIMS[0].sub}`,
  returns: `${TRUST_CLAIMS[1].title} — ${TRUST_CLAIMS[1].sub}`,
  warranty: 'Contact us for warranty information.',
  madeInUSA: `${TRUST_CLAIMS[2].title} — ${TRUST_CLAIMS[2].sub}`,
};

function text(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const collect = (node: any): string => {
        if (!node || typeof node !== 'object') return '';
        if (typeof node.value === 'string') return node.value;
        if (typeof node.text === 'string') return node.text;
        return Array.isArray(node.children)
          ? node.children.map(collect).filter(Boolean).join(' ')
          : '';
      };
      const richText = collect(parsed).trim();
      if (richText) return richText.replace(/\s+/g, ' ');
    } catch {
      // Keep the original value if it is not valid rich-text JSON.
    }
  }
  return trimmed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

export function parseSitePolicies(response: any): SitePolicies {
  const fields = response?.metaobject?.fields;
  if (!Array.isArray(fields)) return fallbackPolicies;

  const values: Record<string, string> = {};
  for (const field of fields as any[]) {
    if (typeof field?.key !== 'string') continue;
    const key = field.key.toLowerCase().replace(/[^a-z]/g, '');
    const value = text(field.value);
    if (value) values[key] = value;
  }

  return {
    shipping:
      values.shippingsentence ??
      values.shipping ??
      values.shippingpolicy ??
      fallbackPolicies.shipping,
    returns:
      values.returnssentence ??
      values.returns ??
      values.returnspolicy ??
      values.returnpolicy ??
      fallbackPolicies.returns,
    warranty:
      values.warrantysentence ??
      values.warranty ??
      values.warrantypolicy ??
      fallbackPolicies.warranty,
    madeInUSA:
      values.madeinusasentence ??
      values.madeinusa ??
      values.madeinusapolicy ??
      fallbackPolicies.madeInUSA,
  };
}

export function policyClaims(policies: SitePolicies) {
  return [
    {title: policies.shipping, sub: '', icon: 'shipping' as const},
    {title: policies.returns, sub: '', icon: 'returns' as const},
    {title: policies.madeInUSA, sub: '', icon: 'usa' as const},
    {title: policies.warranty, sub: '', icon: 'warranty' as const},
    TRUST_CLAIMS[3],
  ];
}

export function policySeoDescription(policies: SitePolicies) {
  const shippingThreshold = policies.shipping.match(
    /\$\s*([\d,]+(?:\.\d{1,2})?)\s*\+/,
  )?.[1];
  const shipping = shippingThreshold
    ? `Free U.S. shipping $${shippingThreshold}+.`
    : policies.shipping.split(/[.!?](?:\s|$)/, 1)[0].trim() + '.';
  const returns = policies.returns.split(/[.!?](?:\s|$)/, 1)[0].trim();
  const description = `${shipping} ${policies.madeInUSA} ${returns} ${policies.warranty}`;
  if (description.length <= 155) return description;
  return `${description.slice(0, 152).replace(/\s+\S*$/, '')}…`;
}

