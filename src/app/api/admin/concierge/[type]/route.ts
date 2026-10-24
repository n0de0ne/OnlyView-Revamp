import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { conciergeSchema, createConcierge, isConciergeType, listConcierge } from "@/lib/concierge";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ type: string }> };

export const GET = adminRoute<Ctx>("viewer", async (_req, { params }) => {
  const { type } = await params;
  if (!isConciergeType(type)) return jsonError("not_found", 404);
  const [items, partners] = await Promise.all([
    listConcierge(type),
    // the boat / chef editors pick their provider from this list
    type === "boats" || type === "chef-offers"
      ? prisma.servicePartner.findMany({
          where: { kind: type === "boats" ? "boat" : "chef" },
          select: { id: true, name: true, isActive: true, currency: true },
          orderBy: { name: "asc" },
        })
      : null,
  ]);
  return jsonOk({ items, ...(partners ? { partners } : {}) });
});

export const POST = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { type } = await params;
  if (!isConciergeType(type)) return jsonError("not_found", 404);
  const parsed = conciergeSchema[type].safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.path.join("."));
  try {
    const item = await createConcierge(type, parsed.data);
    await audit({
      action: `concierge_create`,
      entityType: type,
      entityId: item.id,
      details: { name: item.name },
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ item });
  } catch {
    // ServicePartner (kind, name) is unique
    return jsonError("duplicate");
  }
});
