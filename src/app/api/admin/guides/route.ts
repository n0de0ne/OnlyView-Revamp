import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonInvalid, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { GuideInput } from "@/lib/admin-schemas";
import { GUIDE_PATHS, rowToGuide } from "@/lib/guides";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const rows = await prisma.guideArticle.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return jsonOk({ guides: rows.map(rowToGuide) });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = GuideInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  if (await prisma.guideArticle.findUnique({ where: { slug: parsed.data.slug } })) return jsonError("slug_taken");
  const row = await prisma.guideArticle.create({ data: parsed.data });
  await audit({
    action: "guide_create",
    entityType: "guide",
    entityId: row.id,
    details: { slug: row.slug },
    userId: user.id,
    username: user.username,
  });
  for (const [path, type] of GUIDE_PATHS) revalidatePath(path, type);
  return jsonOk({ guide: rowToGuide(row) });
});
