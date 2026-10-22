import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { GuestDetailsInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { saveGuestDetails } from "@/lib/guest-stay";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  const exists = await prisma.reservation.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return jsonError("not_found", 404);
  const parsed = GuestDetailsInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  await saveGuestDetails(id, parsed.data);
  await audit({
    action: "guest_details_update",
    entityType: "reservation",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
