import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { conciergeSchema, deleteConcierge, isConciergeType, updateConcierge } from "@/lib/concierge";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ type: string; id: string }> };

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { type, id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  if (!isConciergeType(type)) return jsonError("not_found", 404);
  const parsed = conciergeSchema[type].partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.path.join("."));
  try {
    const item = await updateConcierge(type, id, parsed.data);
    await audit({
      action: "concierge_update",
      entityType: type,
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ item });
  } catch {
    return jsonError("not_found", 404);
  }
});

/** Stays that already carry a request keep its label — requests copy it. */
export const DELETE = adminRoute<Ctx>("manager", async (_req, { params }, user) => {
  const { type, id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  if (!isConciergeType(type)) return jsonError("not_found", 404);
  await deleteConcierge(type, id).catch(() => null);
  await audit({
    action: "concierge_delete",
    entityType: type,
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
