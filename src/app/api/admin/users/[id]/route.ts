import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { UserInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("owner", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = UserInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;

  // an owner cannot deactivate or demote themselves (lock-out protection)
  if (id === user.id && (d.isActive === false || (d.role && d.role !== "owner"))) {
    return jsonError("cannot_modify_self", 400);
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        username: d.username?.toLowerCase(),
        email: d.email?.toLowerCase(),
        firstname: d.firstname,
        lastname: d.lastname,
        role: d.role,
        isActive: d.isActive,
        ...(d.password
          ? { passwordHash: await bcrypt.hash(d.password, 12), mustChangePassword: true }
          : {}),
      },
    });
    await audit({
      action: "user_update",
      entityType: "user",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk();
  } catch {
    return jsonError("not_found_or_conflict", 409);
  }
});

export const DELETE = adminRoute<Ctx>("owner", async (_req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  if (id === user.id) return jsonError("cannot_delete_self", 400);
  await prisma.user.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "user_delete",
    entityType: "user",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
