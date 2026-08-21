import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeQuote } from "@/lib/pricing";
import { getRateConfig, getLoyaltyConfig } from "@/lib/settings";
import { isRangeAvailable } from "@/lib/availability";
import { resolvePromotion } from "@/lib/promotions";
import { nightsBetween, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const Body = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bedrooms: z.number().int().min(2).max(4),
  promoCode: z.string().max(50).optional().nullable(),
});

/** Public quote: seasonal price + tax + deposit + promo + loyalty preview. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const { startDate, endDate, bedrooms, promoCode } = parsed.data;

  if (endDate <= startDate || startDate < todayISO()) {
    return NextResponse.json({ success: false, error: "invalid_dates" }, { status: 400 });
  }
  if (nightsBetween(startDate, endDate) > 90) {
    return NextResponse.json({ success: false, error: "too_long" }, { status: 400 });
  }

  const rates = await getRateConfig();

  // base walk without promo to size the promotion
  const preliminary = computeQuote({ startDate, endDate, bedrooms }, rates);
  const promo = await resolvePromotion({
    startDate,
    endDate,
    basePrice: preliminary.baseBeforeOffers,
    promoCode,
  });

  const quote = computeQuote(
    {
      startDate,
      endDate,
      bedrooms,
      promo: promo
        ? { name: promo.name, discountType: promo.discountType, discountValue: promo.discountValue }
        : null,
    },
    rates
  );

  const [available, loyalty] = await Promise.all([
    isRangeAvailable(startDate, endDate),
    getLoyaltyConfig(),
  ]);

  return NextResponse.json({
    success: true,
    available,
    quote: {
      nights: quote.nights,
      minStayOk: quote.minStayOk,
      minStayRequired: quote.minStayRequired,
      seasonSummary: quote.seasonSummary,
      lines: quote.lines,
      baseBeforeOffers: quote.baseBeforeOffers,
      promoName: quote.promoName,
      promoDiscount: quote.promoDiscount,
      subtotalHT: quote.subtotalHT,
      taxAmount: quote.taxAmount,
      totalTTC: quote.totalTTC,
      depositAmount: quote.depositAmount,
      balanceAmount: quote.balanceAmount,
    },
    loyaltyPoints: Math.max(0, Math.floor(quote.subtotalHT * loyalty.earnPerDollar)),
  });
}
