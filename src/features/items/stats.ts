/**
 * Per-item numbers shown on detail and in sorts. Pure — safe to import from tests.
 */

/** Price ÷ times worn. Unworn pieces count as one wear so the number stays finite. */
export function costPerWear(price: number | null | undefined, wearCount: number): number | null {
  if (price === null || price === undefined || !Number.isFinite(price)) return null;
  return price / Math.max(1, wearCount);
}

/** Currency amount, whole units unless `cents` (or the amount is small). */
export function formatMoney(
  amount: number,
  currency: string | null | undefined = 'USD',
  options: { cents?: boolean; locale?: string } = {},
): string {
  const cents = options.cents ?? Math.abs(amount) < 10;
  const digits = cents ? 2 : 0;
  try {
    return new Intl.NumberFormat(options.locale, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${currency ?? ''} ${amount.toFixed(digits)}`.trim();
  }
}

/** "$17", "$4.20" or "—" when the price is unknown. */
export function formatCostPerWear(
  price: number | null | undefined,
  wearCount: number,
  currency?: string | null,
  locale?: string,
): string {
  const cpw = costPerWear(price, wearCount);
  return cpw === null ? '—' : formatMoney(cpw, currency, { locale });
}
