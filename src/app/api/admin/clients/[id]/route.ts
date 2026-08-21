import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { ClientInput } from "@/lib/admin-schemas";
import { toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = adminRoute<Ctx>("viewer", async (_req, { params }) => {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id: parseInt(id, 10) },
    include: {
      reservations: { orderBy: { startDate: "desc" } },
      loyalty: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 30 } } },
    },
  });
  if (!client) return jsonError("not_found", 404);
  return jsonOk({
    client: {
      ...client,
      reservations: client.reservations.map((r) => ({
        id: r.id,
        status: r.status,
        startDate: toISODate(r.startDate),
        endDate: toISODate(r.endDate),
        priceTTC: r.priceTTC,
        balanceReceived: r.balanceReceived,
      })),
    },
  });
});

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = ClientInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;
  try {
    const client = await prisma.client.update({
      where: { id },
      data: { ...d, email: d.email !== undefined ? (d.email?.toLowerCase() ?? null) : undefined },
    });
    await audit({
      action: "client_update",
      entityType: "client",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ client });
  } catch {
    return jsonError("not_found_or_conflict", 409);
  }
});

export const DELETE = adminRoute<Ctx>("owner", async (_req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  await prisma.client.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "client_delete",
    entityType: "client",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
