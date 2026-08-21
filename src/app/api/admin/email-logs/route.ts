import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export const GET = adminRoute("manager", async (req) => {
  const take = Math.min(200, parseInt(req.nextUrl.searchParams.get("take") ?? "100", 10) || 100);
  const logs = await prisma.emailLog.findMany({ orderBy: { sentAt: "desc" }, take });
  return jsonOk({ logs });
});
