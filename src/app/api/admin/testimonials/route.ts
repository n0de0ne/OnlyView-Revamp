import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const testimonials = await prisma.testimonial.findMany({
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({ testimonials });
});

const Body = z.object({
  id: z.number().int(),
  isApproved: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const PUT = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const { id, ...data } = parsed.data;
  try {
    const testimonial = await prisma.testimonial.update({ where: { id }, data });
    await audit({
      action: "testimonial_update",
      entityType: "testimonial",
      entityId: id,
      details: data,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ testimonial });
  } catch {
    return jsonError("not_found", 404);
  }
});

export const DELETE = adminRoute("manager", async (req, _ctx, user) => {
  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (!id) return jsonError("missing_id");
  await prisma.testimonial.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "testimonial_delete",
    entityType: "testimonial",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
