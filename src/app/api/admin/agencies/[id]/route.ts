import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { AgencyInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = AgencyInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  try {
    const agency = await prisma.agency.update({ where: { id }, data: parsed.data });
    await audit({
      action: "agency_update",
      entityType: "agency",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ agency });
  } catch {
    return jsonError("not_found", 404);
  }
});

export const DELETE = adminRoute<Ctx>("owner", async (_req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  await prisma.agency.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "agency_delete",
    entityType: "agency",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
