import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { PromotionInput, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const promotions = await prisma.promotion.findMany({ orderBy: [{ isActive: "desc" }, { priority: "desc" }] });
  return jsonOk({
    promotions: promotions.map((p) => ({
      ...p,
      validFrom: p.validFrom ? toISODate(p.validFrom) : null,
      validUntil: p.validUntil ? toISODate(p.validUntil) : null,
      stayStartFrom: p.stayStartFrom ? toISODate(p.stayStartFrom) : null,
      stayStartUntil: p.stayStartUntil ? toISODate(p.stayStartUntil) : null,
      mustIncludeDate: p.mustIncludeDate ? toISODate(p.mustIncludeDate) : null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = PromotionInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;
  const promotion = await prisma.promotion.create({
    data: {
      ...d,
      validFrom: dateOrNull(d.validFrom),
      validUntil: dateOrNull(d.validUntil),
      stayStartFrom: dateOrNull(d.stayStartFrom),
      stayStartUntil: dateOrNull(d.stayStartUntil),
      mustIncludeDate: dateOrNull(d.mustIncludeDate),
    },
  });
  await audit({
    action: "promotion_create",
    entityType: "promotion",
    entityId: promotion.id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ promotion });
});
