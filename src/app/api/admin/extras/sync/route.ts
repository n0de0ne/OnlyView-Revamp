import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { getExtrasSyncStatus, isAutoSyncOn, setAutoSync, syncProviderExtras } from "@/lib/extras-sync";

export const dynamic = "force-dynamic";

/** Last St Barth Provider sync (Admin → Extras). */
export const GET = adminRoute("viewer", async () =>
  jsonOk({ status: await getExtrasSyncStatus(), auto: await isAutoSyncOn() })
);

/** Daily sync on/off ({ auto: boolean }). */
export const PUT = adminRoute("manager", async (req, _ctx, user) => {
  const body = (await req.json().catch(() => null)) as { auto?: unknown } | null;
  if (typeof body?.auto !== "boolean") return jsonError("invalid_input");
  await setAutoSync(body.auto);
  await audit({ action: "extras_sync_auto", entityType: "extra", details: { auto: body.auto }, userId: user.id, username: user.username });
  return jsonOk({ auto: body.auto });
});

/** "Synchroniser maintenant" — same run as the daily one. */
export const POST = adminRoute("manager", async (_req, _ctx, user) => {
  const status = await syncProviderExtras();
  await audit({
    action: "extras_sync",
    entityType: "extra",
    details: { ok: status.ok, error: status.error, created: status.created, updated: status.updated, hidden: status.hidden },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ status });
});
