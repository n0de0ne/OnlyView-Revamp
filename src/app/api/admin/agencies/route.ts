import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { AgencyInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const agencies = await prisma.agency.findMany({
    orderBy: { name: "asc" },
    include: {
      reservations: {
        where: { status: "confirmed" },
        select: { priceTTC: true, agencyFeePercent: true },
      },
    },
  });
  return jsonOk({
    agencies: agencies.map((a) => ({
      id: a.id,
      name: a.name,
      code: a.code,
      contactName: a.contactName,
      email: a.email,
      phone: a.phone,
      commissionPercent: a.commissionPercent,
      isActive: a.isActive,
      notes: a.notes,
      stats: {
        reservations: a.reservations.length,
        volume: a.reservations.reduce((s, r) => s + r.priceTTC, 0),
        commissions: a.reservations.reduce(
          (s, r) => s + (r.priceTTC * r.agencyFeePercent) / 100,
          0
        ),
      },
    })),
  });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = AgencyInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  try {
    const agency = await prisma.agency.create({ data: parsed.data });
    await audit({
      action: "agency_create",
      entityType: "agency",
      entityId: agency.id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ agency });
  } catch {
    return jsonError("name_exists", 409);
  }
});
