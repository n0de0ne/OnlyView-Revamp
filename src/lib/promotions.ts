import { prisma } from "./db";
import { nightsBetween, toISODate, todayISO } from "./dates";

export interface ResolvedPromo {
  id: number;
  name: string;
  discountType: string;
  discountValue: number;
  promoCode: string | null;
}

/**
 * Best applicable promotion for a stay (website flow).
 * Port of PricingService::findApplicablePromotion + promo-code matching.
 */
export async function resolvePromotion(opts: {
  startDate: string;
  endDate: string;
  basePrice: number;
  promoCode?: string | null;
}): Promise<ResolvedPromo | null> {
  const today = todayISO();
  const promos = await prisma.promotion.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { discountValue: "desc" }],
  });

  const nights = nightsBetween(opts.startDate, opts.endDate);
  let best: ResolvedPromo | null = null;
  let bestAmount = 0;

  for (const p of promos) {
    // validity window (booking date)
    if (p.validFrom && toISODate(p.validFrom) > today) continue;
    if (p.validUntil && toISODate(p.validUntil) < today) continue;
    // code-gated promotions only apply when the code matches
    if (p.promoCode) {
      if (!opts.promoCode || p.promoCode.toLowerCase() !== opts.promoCode.toLowerCase())
        continue;
    }
    if (p.minNights && nights < p.minNights) continue;
    if (p.maxNights && nights > p.maxNights) continue;
    if (p.stayStartFrom && opts.startDate < toISODate(p.stayStartFrom)) continue;
    if (p.stayStartUntil && opts.startDate > toISODate(p.stayStartUntil)) continue;
    if (p.mustIncludeDate) {
      const d = toISODate(p.mustIncludeDate);
      if (d < opts.startDate || d >= opts.endDate) continue;
    }
    if (p.maxUses != null && p.usedCount >= p.maxUses) continue;

    let amount = 0;
    switch (p.discountType) {
      case "percent":
        amount = opts.basePrice * (p.discountValue / 100);
        break;
      case "fixed":
        amount = p.discountValue;
        break;
      case "free_nights":
        amount = nights > 0 ? (opts.basePrice / nights) * p.discountValue : 0;
        break;
    }
    if (amount > bestAmount) {
      bestAmount = amount;
      best = {
        id: p.id,
        name: p.name,
        discountType: p.discountType,
        discountValue: p.discountValue,
        promoCode: p.promoCode,
      };
    }
  }
  return best;
}
