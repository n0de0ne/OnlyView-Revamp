import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { RatePeriodInput, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { serializeRatePeriod } from "@/lib/rate-periods";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("owner", async (req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  const parsed = RatePeriodInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  const d = parsed.data;
  try {
    const period = await prisma.ratePeriod.update({
      where: { id },
      data: { ...d, startDate: dateOrNull(d.startDate)!, endDate: dateOrNull(d.endDate)! },
    });
    await audit({
      action: "rate_period_update",
      entityType: "rate_period",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ period: serializeRatePeriod(period) });
  } catch {
    return jsonError("not_found", 404);
  }
});

export const DELETE = adminRoute<Ctx>("owner", async (_req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  await prisma.ratePeriod.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "rate_period_delete",
    entityType: "rate_period",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
