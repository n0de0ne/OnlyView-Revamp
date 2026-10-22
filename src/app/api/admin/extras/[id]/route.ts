import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { ExtraInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { serializeExtra } from "@/lib/extras";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  const parsed = ExtraInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  try {
    const extra = await prisma.extra.update({ where: { id }, data: parsed.data });
    await audit({
      action: "extra_update",
      entityType: "extra",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ extra: serializeExtra(extra) });
  } catch {
    return jsonError("not_found", 404);
  }
});

/** Stays that already carry the item keep their copied label and price. */
export const DELETE = adminRoute<Ctx>("manager", async (_req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  await prisma.extra.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "extra_delete",
    entityType: "extra",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
