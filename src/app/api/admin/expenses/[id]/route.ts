import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { ExpenseInput, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = adminRoute<Ctx>("owner", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const parsed = ExpenseInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;
  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...d,
        date: d.date ? new Date(`${d.date}T00:00:00Z`) : undefined,
        endDate: d.endDate !== undefined ? dateOrNull(d.endDate) : undefined,
      },
    });
    await audit({
      action: "expense_update",
      entityType: "expense",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ expense });
  } catch {
    return jsonError("not_found", 404);
  }
});

export const DELETE = adminRoute<Ctx>("owner", async (_req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  await prisma.expense.delete({ where: { id } }).catch(() => null);
  await audit({
    action: "expense_delete",
    entityType: "expense",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
