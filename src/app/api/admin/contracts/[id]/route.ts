import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ action: z.enum(["void", "extend"]) });

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return jsonError("not_found", 404);
  if (contract.status === "signed") return jsonError("already_signed", 409);

  if (parsed.data.action === "void") {
    await prisma.contract.update({ where: { id }, data: { status: "void" } });
  } else {
    await prisma.contract.update({
      where: { id },
      data: { status: "pending", expiresAt: new Date(Date.now() + 30 * 86400000) },
    });
  }
  await audit({
    action: `contract_${parsed.data.action}`,
    entityType: "contract",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
