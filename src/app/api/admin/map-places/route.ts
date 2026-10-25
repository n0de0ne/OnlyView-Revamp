import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk, jsonInvalid } from "@/lib/admin-api";
import { MapPlaceInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/map-places";

export const dynamic = "force-dynamic";

/** The map page renders on every request (its pins must never be stale);
 *  the guides, cached for an hour, show live pins too ("On the map") and are
 *  refreshed here. By route (group included), not URL: the middleware
 *  rewrites `/map` to `/en/map`, so revalidatePath("/map") matched no page. */
const revalidateMap = () => {
  revalidatePath("/(site)/[locale]/map", "page");
  revalidatePath("/(site)/[locale]/guide/[slug]", "page");
};


export const GET = adminRoute("viewer", async () => {
  const places = await prisma.mapPlace.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return jsonOk({ places });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = MapPlaceInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  const base = slugify(parsed.data.name);
  let slug = base;
  for (let n = 2; await prisma.mapPlace.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
  const place = await prisma.mapPlace.create({ data: { ...parsed.data, slug } });
  await audit({
    action: "map_place_create",
    entityType: "map_place",
    entityId: place.id,
    details: { name: place.name, category: place.category },
    userId: user.id,
    username: user.username,
  });
  revalidateMap();
  return jsonOk({ place });
});
