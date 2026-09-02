import "server-only";
import { prisma } from "./db";
import { getRateConfig, getSettings } from "./settings";
import { isLoyaltyEnabled } from "./features";

/**
 * Everything the reservation editor needs, shared by the standalone page and
 * the intercepted modal route so both stay in sync.
 */
export async function getReservationEditorData() {
  const [rates, settings, agencies, loyaltyEnabled] = await Promise.all([
    getRateConfig(),
    getSettings(),
    prisma.agency.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, commissionPercent: true },
    }),
    isLoyaltyEnabled(),
  ]);

  return {
    rates,
    agencies,
    loyaltyEnabled,
    costs: {
      cleaningPerDayEUR: parseFloat(settings.cost_cleaning_per_day_eur ?? "66"),
      fixedMonthlyEUR: parseFloat(settings.cost_fixed_monthly_eur ?? "1501.90"),
      eurUsdRate: parseFloat(settings.eur_usd_rate ?? "1.08"),
    },
  };
}

/** Parses the [id] segment: "new" → null, a number → that id, anything else → false. */
export function parseReservationParam(id: string): number | null | false {
  if (id === "new") return null;
  const numId = parseInt(id, 10);
  return Number.isNaN(numId) ? false : numId;
}
