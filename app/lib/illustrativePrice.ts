/** Display-only comparison; never use for checkout or structured price data. */
export function illustrativePrice(amount: string, handle: string) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  const percent =
    15 +
    (Array.from(handle).reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
      0,
    ) %
      25);
  const comparison = (
    Math.round((value / (1 - percent / 100)) * 100) / 100
  ).toFixed(2);
  return {percent, amount: Number(comparison) - value, comparison};
}
