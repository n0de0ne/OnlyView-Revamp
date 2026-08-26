import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { ExpenseInput, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { toISODate, fromISODate, seasonRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = adminRoute("owner", async (req) => {
  const season = req.nextUrl.searchParams.get("season");
  let where = {};
  if (season && /^\d{4}$/.test(season)) {
    const { start, end } = seasonRange(parseInt(season, 10));
    where = { date: { gte: fromISODate(start), lt: fromISODate(end) } };
  }
  // recurring templates are shown regardless of season
  const [expenses, recurring] = await Promise.all([
    prisma.expense.findMany({ where: { ...where, isFixed: false }, orderBy: { date: "desc" } }),
    prisma.expense.findMany({ where: { isFixed: true }, orderBy: { date: "desc" } }),
  ]);
  const ser = (e: (typeof expenses)[number]) => ({
    ...e,
    date: toISODate(e.date),
    endDate: e.endDate ? toISODate(e.endDate) : null,
  });
  return jsonOk({ expenses: expenses.map(ser), recurring: recurring.map(ser) });
});

export const POST = adminRoute("owner", async (req, _ctx, user) => {
  const parsed = ExpenseInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      ...d,
      date: new Date(`${d.date}T00:00:00Z`),
      endDate: dateOrNull(d.endDate),
      frequency: d.isFixed ? (d.frequency ?? "monthly") : null,
    },
  });
  await audit({
    action: "expense_create",
    entityType: "expense",
    entityId: expense.id,
    details: { amount: d.amount, category: d.category },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ expense });
});
