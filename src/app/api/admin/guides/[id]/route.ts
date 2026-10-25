import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonInvalid, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { GuideInput } from "@/lib/admin-schemas";
import { GUIDE_PATHS, rowToGuide } from "@/lib/guides";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  const parsed = GuideInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  const clash = await prisma.guideArticle.findUnique({ where: { slug: parsed.data.slug } });
  if (clash && clash.id !== id) return jsonError("slug_taken");
  const row = await prisma.guideArticle.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!row) return jsonError("not_found", 404);
  await audit({
    action: "guide_update",
    entityType: "guide",
    entityId: id,
    details: { slug: row.slug },
    userId: user.id,
    username: user.username,
  });
  for (const [path, type] of GUIDE_PATHS) revalidatePath(path, type);
  return jsonOk({ guide: rowToGuide(row) });
});

export const DELETE = adminRoute<Ctx>("manager", async (_req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  const row = await prisma.guideArticle.delete({ where: { id } }).catch(() => null);
  if (!row) return jsonError("not_found", 404);
  await audit({
    action: "guide_delete",
    entityType: "guide",
    entityId: id,
    details: { slug: row.slug },
    userId: user.id,
    username: user.username,
  });
  for (const [path, type] of GUIDE_PATHS) revalidatePath(path, type);
  return jsonOk();
});
