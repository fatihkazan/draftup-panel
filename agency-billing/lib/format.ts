/** Format amount with currency. Use agency_settings.currency when available. */
export function formatMoney(amount: number, currency?: string | null): string {
  const code = currency && currency.length === 3 ? currency : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
