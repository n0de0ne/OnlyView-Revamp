export function usd(amount: number | null | undefined, opts?: { cents?: boolean }): string {
  const v = amount ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.cents ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(v);
}

export function eur(amount: number | null | undefined): string {
  const v = amount ?? 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

export function round0(n: number): number {
  return Math.round(n);
}
