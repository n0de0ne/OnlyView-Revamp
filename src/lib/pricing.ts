/**
 * Pricing engine — TypeScript port of the PHP PricingService + admin logic.
 *
 * Business rules (unchanged from the legacy system):
 *  - Weekly rates per bedroom count (2/3/4), by season (default dates, all
 *    editable in Réglages → Dates des saisons):
 *      · Winter        Dec 15 → Apr 14
 *      · Low season    Jun 1  → Aug 31
 *      · Mid-season    the rest (Apr 15–May 31, Sep 1–Dec 14)
 *      · Christmas     Dec 20 → 26  — flat weekly package, 7-night minimum
 *      · New Year      Dec 27 → Jan 2 — flat weekly package, 7-night minimum
 *  - Dated rate periods (admin → Tarifs par date) override the season for
 *    the nights they cover: fixed weekly rates or a ± % on the season rate,
 *    with their own minimum stay. The shortest matching period wins.
 *  - 5% tourist tax on the rental (can be offered)
 *  - Deposit 30% of the total TTC
 *  - Variable periods: a stay can mix bedroom counts and per-period custom
 *    weekly rates; holiday packages are billed once to the period holding
 *    their first night, remaining nights priced per period.
 *  - Offers: "1 bedroom offered" (bill n−1 bedrooms), free nights, % discount,
 *    custom weekly rate, manual final price, tax offered, agency commission.
 */
import { eachNight, nightsBetween } from "./dates";

export type Bedrooms = 2 | 3 | 4;

/** Inclusive "MM-DD" ranges; a range may wrap the new year (12-27 → 01-02). */
export interface SeasonBounds {
  winter: [string, string];
  lowSeason: [string, string];
  christmas: [string, string];
  newyear: [string, string];
}

export const DEFAULT_SEASONS: SeasonBounds = {
  winter: ["12-15", "04-14"],
  lowSeason: ["06-01", "08-31"],
  christmas: ["12-20", "12-26"],
  newyear: ["12-27", "01-02"],
};

/** A dated override (RatePeriod row), plain data so it can reach the client. */
export interface SpecialRate {
  id: number;
  name: string;
  /** first night, ISO */
  start: string;
  /** last night, ISO (inclusive) */
  end: string;
  mode: "fixed" | "percent";
  /** weekly USD per bedrooms (fixed mode); a missing count falls back to the season */
  weekly: Partial<Record<Bedrooms, number>>;
  adjustPercent: number;
  minStay: number | null;
  showOnWebsite: boolean;
}

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
  seasons: SeasonBounds;
  specials: SpecialRate[];
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
  seasons: DEFAULT_SEASONS,
  specials: [],
};

export type SeasonKey = "christmas" | "newyear" | "winter" | "lowSeason" | "summer";

export function clampBedrooms(n: number): Bedrooms {
  return Math.max(2, Math.min(4, Math.round(n))) as Bedrooms;
}

const inMonthDayRange = (md: string, [from, to]: [string, string]) =>
  from <= to ? md >= from && md <= to : md >= from || md <= to;

export function seasonForDate(iso: string, seasons: SeasonBounds = DEFAULT_SEASONS): SeasonKey {
  const md = iso.slice(5, 10);
  if (inMonthDayRange(md, seasons.christmas)) return "christmas";
  if (inMonthDayRange(md, seasons.newyear)) return "newyear";
  if (inMonthDayRange(md, seasons.winter)) return "winter";
  if (inMonthDayRange(md, seasons.lowSeason)) return "lowSeason";
  return "summer";
}

/** The dated period covering a night, if any — the shortest one wins. */
export function specialForNight(rates: RateConfig, iso: string): SpecialRate | null {
  let best: SpecialRate | null = null;
  for (const sp of rates.specials) {
    if (iso < sp.start || iso > sp.end) continue;
    if (!best || nightsBetween(sp.start, sp.end) < nightsBetween(best.start, best.end)) best = sp;
  }
  return best;
}

/** Nightly rate of a dated period at a bedroom count. */
function specialNightly(rates: RateConfig, sp: SpecialRate, iso: string, bedrooms: number): number {
  const seasonal = weeklyRateFor(rates, seasonForDate(iso, rates.seasons), bedrooms) / 7;
  if (sp.mode === "percent") return seasonal * (1 + sp.adjustPercent / 100);
  const weekly = sp.weekly[clampBedrooms(bedrooms)];
  return weekly != null && weekly > 0 ? weekly / 7 : seasonal;
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

interface SpecialBucket {
  special: SpecialRate;
  nights: number;
  amount: number;
}

interface SeasonWalk {
  total: number;
  perSeasonNights: Record<SeasonKey, number>;
  perSeasonAmount: Record<SeasonKey, number>;
  billedNights: Record<SeasonKey, number>; // holiday minimum applied
  /** nights priced by a dated period (not counted in the seasons above) */
  specials: SpecialBucket[];
}

function addToSpecial(buckets: SpecialBucket[], special: SpecialRate, amount: number) {
  let b = buckets.find((x) => x.special.id === special.id);
  if (!b) buckets.push((b = { special, nights: 0, amount: 0 }));
  b.nights += 1;
  b.amount += amount;
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
  const specials: SpecialBucket[] = [];

  for (const night of eachNight(startDate, endDate)) {
    const sp = specialForNight(rates, night);
    if (sp) {
      addToSpecial(specials, sp, specialNightly(rates, sp, night, bedrooms));
      continue;
    }
    const season = seasonForDate(night, rates.seasons);
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

  const total =
    Object.values(perSeasonAmount).reduce((a, b) => a + b, 0) +
    specials.reduce((a, b) => a + b.amount, 0);
  return { total, perSeasonNights, perSeasonAmount, billedNights, specials };
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
    if (specialForNight(rates, night)) continue;
    const s = seasonForDate(night, rates.seasons);
    if (s === "christmas") hasChristmas = true;
    if (s === "newyear") hasNewYear = true;
  }

  let christmasBucket: { amount: number; packages: string[] } | null = null;
  let newYearBucket: { amount: number; packages: string[] } | null = null;

  for (const night of eachNight(startDate, endDate)) {
    const idx = periods.findIndex((p) => night >= p.startDate && night < p.endDate);
    const bucket = idx >= 0 ? periodTotals[idx] : uncovered;
    bucket.nights += 1;

    const custom = idx >= 0 ? periods[idx].weeklyRate : null;
    const bedrooms = idx >= 0 ? periods[idx].bedrooms : defaultBedrooms;
    // a per-stay custom rate beats everything, then a dated period
    const sp = custom != null && custom > 0 ? null : specialForNight(rates, night);
    if (sp) {
      bucket.amount += specialNightly(rates, sp, night, bedrooms);
      continue;
    }

    const season = seasonForDate(night, rates.seasons);
    if (hasChristmas && season === "christmas") {
      christmasBucket ??= bucket;
      continue;
    }
    if (hasNewYear && season === "newyear") {
      newYearBucket ??= bucket;
      continue;
    }

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
  for (const b of walk.specials) summaryParts.push(`${b.nights}n ${b.special.name}`);
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
    for (const b of walk.specials) {
      const nightly = Math.round(b.amount / b.nights).toLocaleString();
      lines.push({
        label: `✦ ${b.nights}n × $${nightly} — ${b.special.name}`,
        labelFr: `✦ ${b.nights}n × $${nightly} — ${b.special.name}`,
        nights: b.nights,
        amount: Math.round(b.amount),
      });
    }

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
  // on the rent HT, never on the tourist tax
  const agencyFeeAmount = Math.round(finalHT * (agencyFeePercent / 100));
  const netRevenue = finalHT - agencyFeeAmount;

  const depositAmount = Math.round(totalTTC * rates.depositPercent);

  const touchesHoliday =
    walk.perSeasonNights.christmas > 0 || walk.perSeasonNights.newyear > 0;
  const minStayRequired = Math.max(
    touchesHoliday ? rates.minStayPeak : rates.minStay,
    ...walk.specials.map((b) => b.special.minStay ?? 0)
  );

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

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FR = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

/** "MM-DD" shifted by whole days (on a non-leap reference year). */
function shiftMonthDay(md: string, days: number): string {
  const d = new Date(`2001-${md}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(5, 10);
}

function mdLabel(md: string, fr: boolean): string {
  const m = parseInt(md.slice(0, 2), 10) - 1;
  const day = parseInt(md.slice(3, 5), 10);
  return fr ? `${day} ${MONTHS_FR[m]}` : `${MONTHS_EN[m]} ${day}`;
}

function rangeLabel([from, to]: [string, string], fr: boolean): string {
  return `${mdLabel(from, fr)} – ${mdLabel(to, fr)}`;
}

/**
 * Mid-season is whatever the other seasons leave: the gaps between the end
 * of winter and the start of the low season, and back.
 */
function midSeasonRanges(seasons: SeasonBounds): Array<[string, string]> {
  const gaps: Array<[string, string]> = [
    [shiftMonthDay(seasons.winter[1], 1), shiftMonthDay(seasons.lowSeason[0], -1)],
    [shiftMonthDay(seasons.lowSeason[1], 1), shiftMonthDay(seasons.winter[0], -1)],
  ];
  return gaps.filter(([a, b]) => a <= b);
}

/** "MM-DD" validation — used when reading the season settings. */
export function isMonthDay(v: string | undefined): v is string {
  if (!v || !/^\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`2001-${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(5, 10) === v;
}

/** Rate table for the public rates page. */
export function publicRateTable(rates: RateConfig, todayISO?: string) {
  const se = rates.seasons;
  const mid = midSeasonRanges(se);
  return {
    seasons: [
      {
        key: "lowSeason" as const,
        datesEn: rangeLabel(se.lowSeason, false),
        datesFr: rangeLabel(se.lowSeason, true),
        weekly: rates.lowSeason,
      },
      {
        key: "summer" as const,
        datesEn: mid.map((r) => rangeLabel(r, false)).join(" · "),
        datesFr: mid.map((r) => rangeLabel(r, true)).join(" · "),
        weekly: rates.summer,
      },
      {
        key: "winter" as const,
        datesEn: rangeLabel(se.winter, false),
        datesFr: rangeLabel(se.winter, true),
        weekly: rates.winter,
      },
    ],
    holidays: [
      {
        key: "christmas" as const,
        datesEn: rangeLabel(se.christmas, false),
        datesFr: rangeLabel(se.christmas, true),
        weekly: rates.christmasWeekly,
      },
      {
        key: "newyear" as const,
        datesEn: rangeLabel(se.newyear, false),
        datesFr: rangeLabel(se.newyear, true),
        weekly: rates.newYearWeekly,
      },
    ],
    /** dated periods the owner chose to publish, upcoming only */
    specials: rates.specials
      .filter((sp) => sp.showOnWebsite && (!todayISO || sp.end >= todayISO))
      .sort((a, b) => a.start.localeCompare(b.start)),
    taxRate: rates.taxRate,
    minStay: rates.minStay,
    minStayPeak: rates.minStayPeak,
  };
}
