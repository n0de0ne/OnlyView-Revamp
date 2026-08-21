import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { UserInput } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = adminRoute("owner", async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      firstname: true,
      lastname: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLogin: true,
      createdAt: true,
    },
  });
  return jsonOk({ users });
});

export const POST = adminRoute("owner", async (req, _ctx, user) => {
  const parsed = UserInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;
  if (!d.password) return jsonError("password_required");
  try {
    const created = await prisma.user.create({
      data: {
        username: d.username.toLowerCase(),
        email: d.email.toLowerCase(),
        passwordHash: await bcrypt.hash(d.password, 12),
        firstname: d.firstname ?? null,
        lastname: d.lastname ?? null,
        role: d.role,
        isActive: d.isActive,
        mustChangePassword: true,
      },
    });
    await audit({
      action: "user_create",
      entityType: "user",
      entityId: created.id,
      details: { username: created.username, role: created.role },
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ user: { id: created.id } });
  } catch {
    return jsonError("username_or_email_exists", 409);
  }
});
