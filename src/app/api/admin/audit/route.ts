import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export const GET = adminRoute("owner", async (req) => {
  const take = Math.min(200, parseInt(req.nextUrl.searchParams.get("take") ?? "100", 10) || 100);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
  return jsonOk({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details ? JSON.parse(l.details) : null,
      username: l.username,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});
