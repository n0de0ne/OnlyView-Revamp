import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { ExtraInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { serializeExtra } from "@/lib/extras";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const extras = await prisma.extra.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { nameFr: "asc" }],
  });
  return jsonOk({ extras: extras.map(serializeExtra) });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = ExtraInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  const extra = await prisma.extra.create({ data: parsed.data });
  await audit({
    action: "extra_create",
    entityType: "extra",
    entityId: extra.id,
    details: { name: extra.nameFr },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ extra: serializeExtra(extra) });
});
