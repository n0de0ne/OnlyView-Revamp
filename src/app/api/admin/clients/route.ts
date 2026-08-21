import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { ClientInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async (req) => {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const where = q
    ? {
        OR: [
          { firstname: { contains: q } },
          { lastname: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      }
    : {};
  const clients = await prisma.client.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: q ? 12 : 500,
    include: {
      loyalty: { select: { points: true, lifetimePoints: true } },
      _count: { select: { reservations: true } },
      reservations: {
        where: { status: "confirmed" },
        select: { priceHT: true, startDate: true, endDate: true, balanceReceived: true },
      },
    },
  });
  return jsonOk({
    clients: clients.map((c) => {
      const confirmed = c.reservations;
      const totalSpent = confirmed
        .filter((r) => r.balanceReceived)
        .reduce((s, r) => s + r.priceHT, 0);
      const totalNights = confirmed.reduce(
        (s, r) =>
          s + Math.round((r.endDate.getTime() - r.startDate.getTime()) / 86400000),
        0
      );
      return {
        id: c.id,
        firstname: c.firstname,
        lastname: c.lastname,
        email: c.email,
        phone: c.phone,
        country: c.country,
        language: c.language,
        address: c.address,
        city: c.city,
        postalCode: c.postalCode,
        notes: c.notes,
        discountPercent: c.discountPercent,
        discountReason: c.discountReason,
        isVip: c.isVip,
        blacklisted: c.blacklisted,
        blacklistReason: c.blacklistReason,
        tags: c.tags,
        source: c.source,
        stats: {
          stays: confirmed.length,
          nights: totalNights,
          spent: totalSpent,
          reservations: c._count.reservations,
        },
        loyalty: c.loyalty,
      };
    }),
  });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = ClientInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;
  if (d.email) {
    const dupe = await prisma.client.findUnique({ where: { email: d.email.toLowerCase() } });
    if (dupe) return jsonError("email_exists", 409);
  }
  const client = await prisma.client.create({
    data: { ...d, email: d.email?.toLowerCase() ?? null },
  });
  await audit({
    action: "client_create",
    entityType: "client",
    entityId: client.id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ client });
});
