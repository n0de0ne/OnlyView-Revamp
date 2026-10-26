import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk, jsonInvalid } from "@/lib/admin-api";
import { MapPlaceInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { withOnlineBooking } from "@/lib/map-places";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The map page renders on every request (its pins must never be stale);
 *  the guides, cached for an hour, show live pins too ("On the map") and are
 *  refreshed here. By route (group included), not URL: the middleware
 *  rewrites `/map` to `/en/map`, so revalidatePath("/map") matched no page. */
const revalidateMap = () => {
  revalidatePath("/(site)/[locale]/map", "page");
  revalidatePath("/(site)/[locale]/guide/[slug]", "page");
};

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = MapPlaceInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  if (!Number.isFinite(id)) return jsonError("not_found", 404);
  const previous = await prisma.mapPlace.findUnique({
    where: { id },
    select: { category: true, bookingUrl: true },
  });
  if (!previous) return jsonError("not_found", 404);
  const data = withOnlineBooking(parsed.data, previous);
  try {
    const place = await prisma.mapPlace.update({ where: { id }, data });
    await audit({
      action: "map_place_update",
      entityType: "map_place",
      entityId: id,
      details: data,
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
