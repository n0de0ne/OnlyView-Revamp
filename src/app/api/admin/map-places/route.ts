import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { MapPlaceInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** the public page is ISR; an edit should show now, not within the hour */
const revalidateMap = () => {
  revalidatePath("/map");
  revalidatePath("/fr/map");
};

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "place";

export const GET = adminRoute("viewer", async () => {
  const places = await prisma.mapPlace.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return jsonOk({ places });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = MapPlaceInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
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
