import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { RatePeriodInput, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { serializeRatePeriod } from "@/lib/rate-periods";

export const dynamic = "force-dynamic";

export const GET = adminRoute("manager", async () => {
  const periods = await prisma.ratePeriod.findMany({ orderBy: { startDate: "desc" } });
  return jsonOk({ periods: periods.map(serializeRatePeriod) });
});

export const POST = adminRoute("owner", async (req, _ctx, user) => {
  const parsed = RatePeriodInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  const d = parsed.data;
  const period = await prisma.ratePeriod.create({
    data: { ...d, startDate: dateOrNull(d.startDate)!, endDate: dateOrNull(d.endDate)! },
  });
  await audit({
    action: "rate_period_create",
    entityType: "rate_period",
    entityId: period.id,
    details: { name: d.name, start: d.startDate, end: d.endDate },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ period: serializeRatePeriod(period) });
});
