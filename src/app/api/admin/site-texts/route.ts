import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminRoute, jsonError, jsonInvalid, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { CONTENT_GROUPS, CONTENT_PLACEHOLDERS, listContentBlocks, saveContentBlock } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  return jsonOk({ groups: CONTENT_GROUPS, blocks: await listContentBlocks(), placeholders: CONTENT_PLACEHOLDERS });
});

const Body = z.object({ key: z.string().min(1), locale: z.string().min(1), value: z.unknown() });

export const PUT = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  const { key, locale, value } = parsed.data;
  const error = await saveContentBlock(key, locale, value, user.username);
  if (error) return jsonError(error);
  await audit({
    action: "site_text_update",
    entityType: "site_text",
    details: { key, locale },
    userId: user.id,
    username: user.username,
  });
  // every public page renders some of the copy (the footer, the titles…)
  revalidatePath("/", "layout");
  return jsonOk();
});
