import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk, jsonInvalid } from "@/lib/admin-api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const Body = z.object({
  category: z.string(),
  /** Every photo id of the category, in the new display order. */
  ids: z.array(z.number().int()).min(1),
});

/**
 * Persist the order of one category's photos. The first published photo of a
 * category is its cover (room cards on the villa page, tour stops…).
 */
export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  const { category, ids } = parsed.data;

  const existing = await prisma.photo.findMany({ where: { category }, select: { id: true } });
  const known = new Set(existing.map((p) => p.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    return jsonError("stale_order", 409);
  }

  await prisma.$transaction(
    ids.map((id, i) => prisma.photo.update({ where: { id }, data: { sortOrder: i } }))
  );
  await audit({
    action: "photo_reorder",
    entityType: "photo",
    entityId: ids[0],
    details: { category },
    userId: user.id,
    username: user.username,
  });
  revalidatePath("/", "layout");
  return jsonOk();
});
