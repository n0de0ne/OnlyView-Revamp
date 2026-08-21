import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { PromotionInput, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = PromotionInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;
  try {
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...d,
        validFrom: d.validFrom !== undefined ? dateOrNull(d.validFrom) : undefined,
        validUntil: d.validUntil !== undefined ? dateOrNull(d.validUntil) : undefined,
        stayStartFrom: d.stayStartFrom !== undefined ? dateOrNull(d.stayStartFrom) : undefined,
        stayStartUntil: d.stayStartUntil !== undefined ? dateOrNull(d.stayStartUntil) : undefined,
        mustIncludeDate: d.mustIncludeDate !== undefined ? dateOrNull(d.mustIncludeDate) : undefined,
      },
    });
    await audit({
      action: "promotion_update",
      entityType: "promotion",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ promotion });
  } catch {
    return jsonError("not_found", 404);
  }
});

export const DELETE = adminRoute<Ctx>("manager", async (_req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  await prisma.promotion.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "promotion_delete",
    entityType: "promotion",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
