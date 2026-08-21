import { prisma } from "./db";
import { DEFAULT_RATES, type RateConfig } from "./pricing";

let cache: { at: number; map: Record<string, string> } | null = null;
const TTL = 30_000;

export async function getSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  const map: Record<string, string> = {};
  try {
    const rows = await prisma.setting.findMany();
    for (const r of rows) map[r.key] = r.value;
    cache = { at: Date.now(), map };
  } catch {
    // DB unavailable (e.g. image build without a database) — callers fall
    // back to their defaults; don't cache the empty result.
  }
  return map;
}

export function invalidateSettings() {
  cache = null;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  invalidateSettings();
}

const num = (v: string | undefined, fallback: number): number => {
  const n = v != null ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export async function getRateConfig(): Promise<RateConfig> {
  const s = await getSettings();
  const d = DEFAULT_RATES;
  return {
    summer: {
      2: num(s.price_summer_2, d.summer[2]),
      3: num(s.price_summer_3, d.summer[3]),
      4: num(s.price_summer_4, d.summer[4]),
    },
    lowSeason: {
      2: num(s.price_low_season_2, d.lowSeason[2]),
      3: num(s.price_low_season_3, d.lowSeason[3]),
      4: num(s.price_low_season_4, d.lowSeason[4]),
    },
    winter: {
      2: num(s.price_winter_2, d.winter[2]),
      3: num(s.price_winter_3, d.winter[3]),
      4: num(s.price_winter_4, d.winter[4]),
    },
    christmasWeekly: num(s.price_christmas, d.christmasWeekly),
    newYearWeekly: num(s.price_newyear, d.newYearWeekly),
    taxRate: num(s.tax_rate, d.taxRate * 100) / 100,
    minStay: num(s.min_stay, d.minStay),
    minStayPeak: num(s.min_stay_peak, d.minStayPeak),
    depositPercent: num(s.deposit_percent, d.depositPercent * 100) / 100,
  };
}

export interface LoyaltyConfig {
  earnPerDollar: number;
  pointValue: number;
  minRedeem: number;
  maxRedeemPercent: number;
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const s = await getSettings();
  return {
    earnPerDollar: num(s.loyalty_earn_per_dollar, 0.01),
    pointValue: num(s.loyalty_point_value, 1),
    minRedeem: num(s.loyalty_min_redeem, 100),
    maxRedeemPercent: num(s.loyalty_max_redeem_percent, 10),
  };
}
