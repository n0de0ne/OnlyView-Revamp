import { adminRoute, jsonOk } from "@/lib/admin-api";
import { SITE_URL } from "@/lib/seo";
import { allPublicUrls, indexNowEnabled, INDEXNOW_KEY_PATH, lastIndexNow, submitIndexNow } from "@/lib/indexnow";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Réglages → Référencement: the state of the last IndexNow submission. */
export const GET = adminRoute("owner", async () => {
  return jsonOk({
    enabled: indexNowEnabled(),
    siteUrl: SITE_URL,
    keyUrl: `${SITE_URL}${INDEXNOW_KEY_PATH}`,
    last: await lastIndexNow(),
  });
});

/** Resubmit every public URL (both languages) to IndexNow. */
export const POST = adminRoute("owner", async (_req, _ctx, user) => {
  const urls = await allPublicUrls();
  const result = await submitIndexNow(urls);
  await audit({
    action: "indexnow_submit",
    entityType: "seo",
    details: { count: result.count, status: result.status, ok: result.ok, error: result.error ?? null },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ result });
});
