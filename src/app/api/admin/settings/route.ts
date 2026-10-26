import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk, jsonInvalid } from "@/lib/admin-api";
import { invalidateSettings } from "@/lib/settings";
import { isMonthDay } from "@/lib/pricing";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = [
  "price_summer_2",
  "price_summer_3",
  "price_summer_4",
  "price_low_season_2",
  "price_low_season_3",
  "price_low_season_4",
  "price_winter_2",
  "price_winter_3",
  "price_winter_4",
  "price_christmas",
  "price_newyear",
  "tax_rate",
  "min_stay",
  "min_stay_peak",
  "deposit_percent",
  "season_winter_start",
  "season_winter_end",
  "season_low_start",
  "season_low_end",
  "season_christmas_start",
  "season_christmas_end",
  "season_newyear_start",
  "season_newyear_end",
  "reminders_enabled",
  "reminder_option",
  "reminder_option_release",
  "reminder_balance",
  "reminder_balance_days",
  "reminder_prearrival",
  "reminder_prearrival_days",
  "reminder_review",
  "reminder_review_days",
  "loyalty_enabled",
  "analytics_enabled",
  "analytics_cookie",
  "tour_3d_url",
  "loyalty_earn_per_dollar",
  "loyalty_point_value",
  "loyalty_min_redeem",
  "loyalty_max_redeem_percent",
  "cost_cleaning_per_day_eur",
  "cost_fixed_monthly_eur",
  "eur_usd_rate",
  "owner_name",
  "bank_account_name",
  "bank_account_number",
  "bank_name",
  "bank_iban",
  "bank_bic",
  "contact_email",
  "contact_phone",
  "contact_whatsapp",
  "villa_address",
  "villa_map_url",
  "social_instagram",
  "social_facebook",
  "social_tripadvisor",
  "social_google",
  "social_youtube",
  "listing_urls",
  "google_site_verification",
  "bing_site_verification",
  "villa_lat",
  "villa_lng",
  "wifi_ssid",
  "wifi_password",
  "wifi_security",
  "wifi_hidden",
  "safe_code",
] as const;

export const GET = adminRoute("owner", async () => {
  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return jsonOk({ settings, keys: ALLOWED_KEYS });
});

// the board sends every setting back, including ones it doesn't edit (the
// owner's signature image): only allowed keys are length-checked and saved
const Body = z.object({ settings: z.record(z.string(), z.string()) });

export const PUT = adminRoute("owner", async (req, _ctx, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  const entries = Object.entries(parsed.data.settings).filter(([k]) =>
    (ALLOWED_KEYS as readonly string[]).includes(k)
  );
  if (entries.some(([, v]) => v.length > 2000)) return jsonError("invalid_input");
  const badSeason = entries.find(
    ([k, v]) => k.startsWith("season_") && v.trim() !== "" && !isMonthDay(v.trim())
  );
  if (badSeason) return jsonError(`invalid_season_date: ${badSeason[0]}`);
  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  invalidateSettings();
  await audit({
    action: "settings_update",
    entityType: "settings",
    details: { keys: entries.map(([k]) => k) },
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
