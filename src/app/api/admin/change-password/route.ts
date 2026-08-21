import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { changePassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});

export const POST = adminRoute("viewer", async (req, _ctx, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || !(await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash))) {
    return jsonError("invalid_credentials", 401);
  }
  await changePassword(user.id, parsed.data.newPassword);
  await audit({ action: "password_changed", userId: user.id, username: user.username });
  return jsonOk();
});
