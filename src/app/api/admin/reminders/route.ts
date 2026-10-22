import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { runReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/** What the next run would send today — works even while switched off. */
export const GET = adminRoute("owner", async () => {
  const res = await runReminders({ dryRun: true });
  return jsonOk(res as unknown as Record<string, unknown>);
});

/** "Envoyer maintenant" — same as the hourly run. */
export const POST = adminRoute("owner", async (_req, _ctx, user) => {
  const preview = await runReminders({ dryRun: true });
  if (!preview.enabled) return jsonError("reminders_disabled");
  const res = await runReminders();
  await audit({
    action: "reminders_run",
    details: { sent: res.actions.length },
    userId: user.id,
    username: user.username,
  });
  return jsonOk(res as unknown as Record<string, unknown>);
});
