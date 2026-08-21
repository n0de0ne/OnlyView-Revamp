/**
 * Pricing engine — TypeScript port of the PHP PricingService + admin logic.
 *
 * Business rules (unchanged from the legacy system):
 *  - Weekly rates per bedroom count (2/3/4), by season:
 *      · Winter        Dec 15 → Apr 14
 *      · Low season    Jun 1  → Aug 31
 *      · Mid-season    the rest (Apr 15–May 31, Sep 1–Dec 14)
 *      · Christmas     Dec 20 → 26  — flat weekly package, 7-night minimum
 *      · New Year      Dec 27 → Jan 2 — flat weekly package, 7-night minimum
 *  - 5% tourist tax on the rental (can be offered)
 *  - Deposit 30% of the total TTC
 *  - Variable periods: a stay can mix bedroom counts and per-period custom
 *    weekly rates; holiday packages are billed once to the period holding
 *    their first night, remaining nights priced per period.
 *  - Offers: "1 bedroom offered" (bill n−1 bedrooms), free nights, % discount,
 *    custom weekly rate, manual final price, tax offered, agency commission.
 */
import { eachNight, monthDay, nightsBetween } from "./dates";

export type Bedrooms = 2 | 3 | 4;

export interface RateConfig {
  summer: Record<Bedrooms, number>; // mid-season weekly USD
  lowSeason: Record<Bedrooms, number>;
  winter: Record<Bedrooms, number>;
  christmasWeekly: number;
  newYearWeekly: number;
  taxRate: number; // 0.05
  minStay: number;
  minStayPeak: number;
  depositPercent: number; // 0.30
}

export const DEFAULT_RATES: RateConfig = {
  summer: { 2: 12500, 3: 13500, 4: 15500 },
  lowSeason: { 2: 10000, 3: 12000, 4: 14000 },
  winter: { 2: 18500, 3: 20000, 4: 21500 },
  christmasWeekly: 40000,
  newYearWeekly: 50000,
  taxRate: 0.05,
  minStay: 4,
  minStayPeak: 7,
  depositPercent: 0.3,
};

export type SeasonKey = "christmas" | "newyear" | "winter" | "lowSeason" | "summer";

export function clampBedrooms(n: number): Bedrooms {
  return Math.max(2, Math.min(4, Math.round(n))) as Bedrooms;
}

export function seasonForDate(iso: string): SeasonKey {
  const { month, day } = monthDay(iso);
  if (month === 12 && day >= 20 && day <= 26) return "christmas";
  if ((month === 12 && day >= 27) || (month === 1 && day <= 2)) return "newyear";
  if ((month === 12 && day >= 15) || month <= 3 || (month === 4 && day <= 14)) return "winter";
  if (month >= 6 && month <= 8) return "lowSeason";
  return "summer";
}

export function seasonLabel(key: SeasonKey, locale: "en" | "fr" = "en"): string {
  const labels: Record<SeasonKey, [string, string]> = {
    christmas: ["Christmas", "Noël"],
    newyear: ["New Year", "Nouvel An"],
    winter: ["Winter", "Hiver"],
    lowSeason: ["Summer", "Été"],
    summer: ["Mid-season", "Mi-saison"],
  };
  return labels[key][locale === "fr" ? 1 : 0];
}

/** Weekly rate for a non-holiday season at a bedroom count. */
export function weeklyRateFor(rates: RateConfig, season: SeasonKey, bedrooms: number): number {
  const b = clampBedrooms(bedrooms);
  if (season === "winter") return rates.winter[b];
  if (season === "lowSeason") return rates.lowSeason[b];
  if (season === "christmas") return rates.christmasWeekly;
  if (season === "newyear") return rates.newYearWeekly;
  return rates.summer[b];
}

export interface PeriodInput {
  startDate: string; // ISO, first night
  endDate: string; // ISO, exclusive (checkout of that period)
  bedrooms: number;
  weeklyRate?: number | null; // custom weekly override for the period
}

export interface QuoteOptions {
  startDate: string;
  endDate: string;
  bedrooms: number;
  periods?: PeriodInput[];
  customWeeklyRate?: number | null;
  offerOneRoom?: boolean;
  freeNights?: number;
  discountPercent?: number;
  finalPriceOverride?: number | null;
  noTax?: boolean;
  agencyFeePercent?: number;
  /** applicable promotion resolved by the caller (website flow) */
  promo?: {
    name: string;
    discountType: string;
    discountValue: number;
  } | null;
}

export interface QuoteLine {
  label: string;
  labelFr: string;
  nights: number;
  amount: number;
}

export interface Quote {
  nights: number;
  minStayRequired: number;
  minStayOk: boolean;
  seasonSummary: string; // e.g. "5n Winter + 3n Christmas"
  lines: QuoteLine[];
  baseBeforeOffers: number;
  offerOneRoomDiscount: number;
  freeNightsDiscount: number;
  promoName: string | null;
  promoDiscount: number;
  discountPercent: number;
  discountAmount: number;
  subtotalHT: number;
  finalHT: number; // after manual override
  overridden: boolean;
  taxRate: number;
  taxAmount: number;
  totalTTC: number;
  agencyFeePercent: number;
  agencyFeeAmount: number;
  netRevenue: number;
  depositPercent: number;
  depositAmount: number;
  balanceAmount: number;
  usedVariablePeriods: boolean;
  usedCustomWeeklyRate: boolean;
}

interface SeasonWalk {
  total: number;
  perSeasonNights: Record<SeasonKey, number>;
  perSeasonAmount: Record<SeasonKey, number>;
  billedNights: Record<SeasonKey, number>; // holiday minimum applied
}

const zeroSeasons = (): Record<SeasonKey, number> => ({
  christmas: 0,
  newyear: 0,
  winter: 0,
  lowSeason: 0,
  summer: 0,
});

/**
 * Standard season walk with holiday 7-night minimum top-up
 * (a stay touching Christmas/New Year is billed the full weekly package
 * pro-rated to at least `minStayPeak` nights — exactly like the PHP service).
 */
function walkSeasons(
  startDate: string,
  endDate: string,
  bedrooms: number,
  rates: RateConfig
): SeasonWalk {
  const perSeasonNights = zeroSeasons();
  const perSeasonAmount = zeroSeasons();

  for (const night of eachNight(startDate, endDate)) {
    const season = seasonForDate(night);
    const nightly = weeklyRateFor(rates, season, bedrooms) / 7;
    perSeasonNights[season] += 1;
    perSeasonAmount[season] += nightly;
  }

  const billedNights = { ...perSeasonNights };
  const minPeak = rates.minStayPeak;
  for (const holiday of ["christmas", "newyear"] as const) {
    const n = perSeasonNights[holiday];
    if (n > 0 && n < minPeak) {
      const nightly =
        (holiday === "christmas" ? rates.christmasWeekly : rates.newYearWeekly) / 7;
      perSeasonAmount[holiday] += (minPeak - n) * nightly;
      billedNights[holiday] = minPeak;
    }
  }

  const total = Object.values(perSeasonAmount).reduce((a, b) => a + b, 0);
  return { total, perSeasonNights, perSeasonAmount, billedNights };
}

/**
 * Variable-periods walk (port of calculateVariablePeriodsBreakdown):
 * per-night rate = period custom weekly/7, else seasonal rate at the
 * period's bedrooms; nights not covered by any period use the default
 * bedrooms. Christmas / New Year nights are excluded from nightly pricing
 * and their flat weekly package is charged once.
 */
function walkVariablePeriods(
  startDate: string,
  endDate: string,
  defaultBedrooms: number,
  periods: PeriodInput[],
  rates: RateConfig
): { total: number; lines: QuoteLine[] } {
  let total = 0;
  const periodTotals = periods.map(() => ({ nights: 0, amount: 0, packages: [] as string[] }));
  const uncovered = { nights: 0, amount: 0, packages: [] as string[] };

  let hasChristmas = false;
  let hasNewYear = false;
  for (const night of eachNight(startDate, endDate)) {
    const s = seasonForDate(night);
    if (s === "christmas") hasChristmas = true;
    if (s === "newyear") hasNewYear = true;
  }

  let christmasBucket: { amount: number; packages: string[] } | null = null;
  let newYearBucket: { amount: number; packages: string[] } | null = null;

  for (const night of eachNight(startDate, endDate)) {
    const idx = periods.findIndex((p) => night >= p.startDate && night < p.endDate);
    const bucket = idx >= 0 ? periodTotals[idx] : uncovered;
    bucket.nights += 1;

    const season = seasonForDate(night);
    if (hasChristmas && season === "christmas") {
      christmasBucket ??= bucket;
      continue;
    }
    if (hasNewYear && season === "newyear") {
      newYearBucket ??= bucket;
      continue;
    }

    const custom = idx >= 0 ? periods[idx].weeklyRate : null;
    const bedrooms = idx >= 0 ? periods[idx].bedrooms : defaultBedrooms;
    const nightly =
      custom != null && custom > 0
        ? custom / 7
        : weeklyRateFor(rates, season, bedrooms) / 7;
    bucket.amount += nightly;
  }

  if (christmasBucket) {
    christmasBucket.amount += rates.christmasWeekly;
    christmasBucket.packages.push("Christmas");
  }
  if (newYearBucket) {
    newYearBucket.amount += rates.newYearWeekly;
    newYearBucket.packages.push("New Year");
  }

  const lines: QuoteLine[] = periods.map((p, i) => {
    const t = periodTotals[i];
    const pkg = t.packages.length ? ` + ${t.packages.join(" + ")}` : "";
    return {
      label: `${p.startDate} → ${p.endDate} · ${p.bedrooms} bd${
        p.weeklyRate ? ` · $${p.weeklyRate.toLocaleString()}/wk` : ""
      }${pkg}`,
      labelFr: `${p.startDate} → ${p.endDate} · ${p.bedrooms} ch${
        p.weeklyRate ? ` · $${p.weeklyRate.toLocaleString()}/sem` : ""
      }${pkg}`,
      nights: t.nights,
      amount: Math.round(t.amount),
    };
  });
  if (uncovered.nights > 0) {
    const pkg = uncovered.packages.length ? ` + ${uncovered.packages.join(" + ")}` : "";
    lines.push({
      label: `Remaining nights · ${defaultBedrooms} bd${pkg}`,
      labelFr: `Nuits restantes · ${defaultBedrooms} ch${pkg}`,
      nights: uncovered.nights,
      amount: Math.round(uncovered.amount),
    });
  }

  total =
    periodTotals.reduce((s, t) => s + t.amount, 0) + uncovered.amount;
  return { total, lines };
}

const SEASON_EMOJI: Record<SeasonKey, string> = {
  christmas: "🎄",
  newyear: "🎆",
  winter: "❄️",
  lowSeason: "🌴",
  summer: "☀️",
};

/** Full quote computation. Every derived amount is rounded at the edges only. */
export function computeQuote(opts: QuoteOptions, rates: RateConfig = DEFAULT_RATES): Quote {
  const nights = Math.max(0, nightsBetween(opts.startDate, opts.endDate));
  const bedrooms = clampBedrooms(opts.bedrooms);
  const periods = (opts.periods ?? []).filter(
    (p) => p.startDate && p.endDate && p.endDate > p.startDate
  );
  const useVariable = periods.length > 0;
  const customWeekly =
    !useVariable && opts.customWeeklyRate && opts.customWeeklyRate > 0
      ? opts.customWeeklyRate
      : null;

  // ── base price + display lines ──
  let base = 0;
  let lines: QuoteLine[] = [];
  let seasonSummary = "";
  let offerOneRoomDiscount = 0;

  const walk = walkSeasons(opts.startDate, opts.endDate, bedrooms, rates);
  const summaryParts: string[] = [];
  (Object.keys(walk.perSeasonNights) as SeasonKey[]).forEach((s) => {
    if (walk.perSeasonNights[s] > 0) {
      summaryParts.push(`${walk.billedNights[s]}n ${seasonLabel(s)}`);
    }
  });
  seasonSummary = summaryParts.join(" + ");

  if (useVariable) {
    const vp = walkVariablePeriods(opts.startDate, opts.endDate, bedrooms, periods, rates);
    base = vp.total;
    lines = vp.lines;
  } else if (customWeekly) {
    base = (customWeekly / 7) * nights;
    lines = [
      {
        label: `${nights}n × $${Math.round(customWeekly / 7).toLocaleString()} (special weekly rate)`,
        labelFr: `${nights}n × $${Math.round(customWeekly / 7).toLocaleString()} (tarif spécial)`,
        nights,
        amount: Math.round(base),
      },
    ];
  } else {
    base = walk.total;
    (Object.keys(walk.perSeasonAmount) as SeasonKey[]).forEach((s) => {
      if (walk.perSeasonNights[s] === 0) return;
      const billed = walk.billedNights[s];
      const nightly = weeklyRateFor(rates, s, bedrooms) / 7;
      const minNote =
        billed > walk.perSeasonNights[s] ? ` (min ${rates.minStayPeak}n)` : "";
      lines.push({
        label: `${SEASON_EMOJI[s]} ${billed}n × $${Math.round(nightly).toLocaleString()}${minNote} — ${seasonLabel(s, "en")}`,
        labelFr: `${SEASON_EMOJI[s]} ${billed}n × $${Math.round(nightly).toLocaleString()}${minNote} — ${seasonLabel(s, "fr")}`,
        nights: walk.perSeasonNights[s],
        amount: Math.round(walk.perSeasonAmount[s]),
      });
    });

    // "1 bedroom offered": bill the walk at n−1 bedrooms
    if (opts.offerOneRoom && bedrooms >= 3) {
      const reduced = walkSeasons(opts.startDate, opts.endDate, bedrooms - 1, rates);
      offerOneRoomDiscount = Math.max(0, base - reduced.total);
      base = reduced.total;
    }
  }

  // ── offers ──
  const freeNights = Math.max(0, Math.min(opts.freeNights ?? 0, nights));
  const avgNightly = nights > 0 ? base / nights : 0;
  const freeNightsDiscount = freeNights > 0 ? avgNightly * freeNights : 0;

  const afterOffers = Math.max(0, base - freeNightsDiscount);

  // promotion (resolved upstream — only for website quotes)
  let promoDiscount = 0;
  let promoName: string | null = null;
  if (opts.promo) {
    promoName = opts.promo.name;
    const v = opts.promo.discountValue;
    switch (opts.promo.discountType) {
      case "percent":
        promoDiscount = afterOffers * (v / 100);
        break;
      case "fixed":
        promoDiscount = v;
        break;
      case "free_nights":
        promoDiscount = avgNightly * v;
        break;
    }
    promoDiscount = Math.min(promoDiscount, afterOffers);
  }

  const discountPercent = Math.max(0, Math.min(100, opts.discountPercent ?? 0));
  const discountAmount = (afterOffers - promoDiscount) * (discountPercent / 100);

  const subtotalHT = Math.round(afterOffers - promoDiscount - discountAmount);
  const overridden =
    opts.finalPriceOverride != null && opts.finalPriceOverride >= 0;
  const finalHT = overridden ? Math.round(opts.finalPriceOverride!) : subtotalHT;

  const taxRate = opts.noTax ? 0 : rates.taxRate;
  const taxAmount = Math.round(finalHT * taxRate);
  const totalTTC = finalHT + taxAmount;

  const agencyFeePercent = Math.max(0, opts.agencyFeePercent ?? 0);
  const agencyFeeAmount = Math.round(totalTTC * (agencyFeePercent / 100));
  const netRevenue = finalHT - agencyFeeAmount;

  const depositAmount = Math.round(totalTTC * rates.depositPercent);

  const touchesHoliday =
    walk.perSeasonNights.christmas > 0 || walk.perSeasonNights.newyear > 0;
  const minStayRequired = touchesHoliday ? rates.minStayPeak : rates.minStay;

  return {
    nights,
    minStayRequired,
    minStayOk: nights >= minStayRequired,
    seasonSummary,
    lines,
    baseBeforeOffers: Math.round(base + offerOneRoomDiscount),
    offerOneRoomDiscount: Math.round(offerOneRoomDiscount),
    freeNightsDiscount: Math.round(freeNightsDiscount),
    promoName,
    promoDiscount: Math.round(promoDiscount),
    discountPercent,
    discountAmount: Math.round(discountAmount),
    subtotalHT,
    finalHT,
    overridden,
    taxRate,
    taxAmount,
    totalTTC,
    agencyFeePercent,
    agencyFeeAmount,
    netRevenue,
    depositPercent: rates.depositPercent,
    depositAmount,
    balanceAmount: totalTTC - depositAmount,
    usedVariablePeriods: useVariable,
    usedCustomWeeklyRate: customWeekly != null,
  };
}

/** Rate table for the public rates page. */
export function publicRateTable(rates: RateConfig) {
  return {
    seasons: [
      {
        key: "lowSeason" as const,
        datesEn: "Jun 1 – Aug 31",
        datesFr: "1 juin – 31 août",
        weekly: rates.lowSeason,
      },
      {
        key: "summer" as const,
        datesEn: "Apr 15 – May 31 · Sep 1 – Dec 14",
        datesFr: "15 avr – 31 mai · 1 sep – 14 déc",
        weekly: rates.summer,
      },
      {
        key: "winter" as const,
        datesEn: "Dec 15 – Apr 14",
        datesFr: "15 déc – 14 avril",
        weekly: rates.winter,
      },
    ],
    holidays: [
      {
        key: "christmas" as const,
        datesEn: "Dec 20 – 26",
        datesFr: "20 – 26 déc",
        weekly: rates.christmasWeekly,
      },
      {
        key: "newyear" as const,
        datesEn: "Dec 27 – Jan 2",
        datesFr: "27 déc – 2 janv",
        weekly: rates.newYearWeekly,
      },
    ],
    taxRate: rates.taxRate,
    minStay: rates.minStay,
    minStayPeak: rates.minStayPeak,
  };
}
