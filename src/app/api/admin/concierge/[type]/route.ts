import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { conciergeSchema, createConcierge, isConciergeType, listConcierge } from "@/lib/concierge";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ type: string }> };

export const GET = adminRoute<Ctx>("viewer", async (_req, { params }) => {
  const { type } = await params;
  if (!isConciergeType(type)) return jsonError("not_found", 404);
  const partnerKind = { boats: "boat", "chef-offers": "chef", activities: "activity" }[type as string];
  const [items, partners, categories] = await Promise.all([
    listConcierge(type),
    // the boat / chef / activity editors pick their provider from this list
    partnerKind
      ? prisma.servicePartner.findMany({
          where: { kind: partnerKind },
          select: { id: true, name: true, isActive: true, currency: true },
          orderBy: { name: "asc" },
        })
      : null,
    type === "activities"
      ? prisma.activityCategory.findMany({
          select: { id: true, nameFr: true, icon: true, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
        })
      : null,
  ]);
  return jsonOk({ items, ...(partners ? { partners } : {}), ...(categories ? { categories } : {}) });
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
