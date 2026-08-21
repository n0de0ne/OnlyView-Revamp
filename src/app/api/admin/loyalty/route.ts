import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { adjustPoints } from "@/lib/loyalty";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const accounts = await prisma.loyaltyAccount.findMany({
    include: {
      client: { select: { id: true, firstname: true, lastname: true, email: true, isVip: true } },
      transactions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { lifetimePoints: "desc" },
  });
  return jsonOk({
    accounts: accounts.map((a) => ({
      id: a.id,
      client: a.client,
      points: a.points,
      lifetimePoints: a.lifetimePoints,
      recent: a.transactions.map((t) => ({
        id: t.id,
        kind: t.kind,
        points: t.points,
        reason: t.reason,
        createdAt: t.createdAt.toISOString(),
      })),
    })),
  });
});

const Body = z.object({
  clientId: z.number().int().positive(),
  points: z.number().int().min(-100000).max(100000),
  reason: z.string().min(2).max(255),
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const { clientId, points, reason } = parsed.data;
  if (points === 0) return jsonError("zero_points");
  await adjustPoints({ clientId, points, reason, by: user.username });
  await audit({
    action: "loyalty_adjust",
    entityType: "client",
    entityId: clientId,
    details: { points, reason },
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
