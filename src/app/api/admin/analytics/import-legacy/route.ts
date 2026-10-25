import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { importLegacyAnalytics } from "@/lib/analytics/legacy-import";

export const dynamic = "force-dynamic";

/** GET: what the old site's history holds · POST: import it (replaces an earlier import) */
export const GET = adminRoute("owner", async () => {
  const r = await importLegacyAnalytics(true);
  return r.ok ? jsonOk({ summary: r }) : jsonError(r.error, 404);
});

export const POST = adminRoute("owner", async (_req, _ctx, user) => {
  const r = await importLegacyAnalytics(false);
  if (!r.ok) return jsonError(r.error, 404);
  await audit({
    action: "analytics.import_legacy",
    details: { sessions: r.sessions, pageviews: r.pageviews },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ summary: r });
});
