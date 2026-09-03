import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { MapPlaceInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const revalidateMap = () => {
  revalidatePath("/map");
  revalidatePath("/fr/map");
};

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = MapPlaceInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  try {
    const place = await prisma.mapPlace.update({ where: { id }, data: parsed.data });
    await audit({
      action: "map_place_update",
      entityType: "map_place",
      entityId: id,
      details: parsed.data,
      userId: user.id,
      username: user.username,
    });
    revalidateMap();
    return jsonOk({ place });
  } catch {
    return jsonError("not_found", 404);
  }
});

export const DELETE = adminRoute<Ctx>("manager", async (_req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  await prisma.mapPlace.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "map_place_delete",
    entityType: "map_place",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  revalidateMap();
  return jsonOk();
});
