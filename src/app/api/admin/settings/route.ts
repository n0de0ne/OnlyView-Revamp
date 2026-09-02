import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { invalidateSettings } from "@/lib/settings";
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
  "villa_lat",
  "villa_lng",
] as const;

export const GET = adminRoute("owner", async () => {
  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return jsonOk({ settings, keys: ALLOWED_KEYS });
});

const Body = z.object({ settings: z.record(z.string(), z.string().max(500)) });

export const PUT = adminRoute("owner", async (req, _ctx, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const entries = Object.entries(parsed.data.settings).filter(([k]) =>
    (ALLOWED_KEYS as readonly string[]).includes(k)
  );
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
