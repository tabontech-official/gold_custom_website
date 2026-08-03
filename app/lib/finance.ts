/**
 * Gold Custom's merchant application links for the four financing partners.
 *
 * These are NOT the lenders' marketing homepages. Each one carries a code that
 * attributes the application to this store — Acima's `location_guid`,
 * Progressive Leasing's `GoldCustomLA` portal slug, Synchrony's `mmc` merchant
 * code. Replacing any of them with a bare homepage silently drops that
 * attribution, so keep the paths and query strings exactly as issued.
 *
 * Used by the product page's partner logo strip and the /policies/finance
 * page; they live here so the two can't drift apart.
 */
export const FINANCE_LINKS = {
  acima:
    'https://apply.acima.com/auth/v2/otp-start?app_id=lo&utm_source=web&utm_medium=merchant&location_guid=loca-283d91d4-a6da-41cd-9e00-e21576cf6571&lang=en',
  // approve.me is Progressive Leasing's application portal.
  progressive: 'https://approve.me/s/GoldCustomLA/131297',
  synchrony: 'https://www.synchrony.com/mmc/LX237089751',
  americanFirst: 'https://americanfirstfinance.com/',
} as const;
