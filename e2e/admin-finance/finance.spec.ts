import { test, expect, isMarked, marked, newAdminClient, type Api, type Scratch } from "../support/fixtures";
import { addPayment, updateReservation } from "../support/contracts";

/**
 * The finance figures are checked on a season of their own, eight years
 * ahead, where no other suite and no real booking adds to the numbers.
 * A season runs 1 September → 31 August and is named after the year it opens.
 */
const SEASON = new Date().getUTCFullYear() + 8;
const day = (monthDay: string) => `${Number(monthDay.slice(0, 2)) >= 9 ? SEASON : SEASON + 1}-${monthDay}`;
const month = (mm: string) => day(`${mm}-01`).slice(0, 7);
const near = (a: number, b: number, tolerance = 1) => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThanOrEqual(tolerance);

type Stats = { months: any[]; totals: any; sources: any[] };
const stats = async (admin: Api): Promise<Stats> => (await admin.get(`/api/admin/stats?season=${SEASON}`)).body;
const row = (s: Stats, mm: string) => s.months.find((m) => m.month === month(mm));
const stay = (scratch: Scratch, from: string, to: string, over: Record<string, unknown> = {}) =>
  scratch.reservation("admin-finance", { startDate: day(from), endDate: day(to), ...over });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // a run that was cut short may have left stays on this season's fixed dates
  if (!process.env.E2E_ADMIN_PASS) return;
  const admin = await newAdminClient();
  const left = ((await admin.get(`/api/admin/reservations?season=${SEASON}&archived=all`)).body?.reservations ?? []) as any[];
  for (const r of left) if (isMarked(r.clientName) || r.client?.firstname === "E2E") await admin.del(`/api/admin/reservations/${r.id}`);
  await admin.dispose();
});

test.describe("finance: season figures", () => {
  test("a confirmed stay adds its rent, tax and nights to its month; options and cancellations add nothing", async ({ admin, scratch }) => {
    const before = await stats(admin);
    expect(before.months).toHaveLength(12);
    expect(before.months[0].month).toBe(`${SEASON}-09`);
    expect(before.months[11].month).toBe(`${SEASON + 1}-08`);

    const r = await stay(scratch, "02-10", "02-17");
    await stay(scratch, "02-18", "02-25", { status: "option" });
    await stay(scratch, "03-02", "03-09", { status: "cancelled" });
    const after = await stats(admin);

    const feb0 = row(before, "02");
    const feb = row(after, "02");
    near(feb.revenueHT - feb0.revenueHT, r.priceHT);
    near(feb.tax - feb0.tax, r.taxAmount);
    expect(feb.nightsBooked - feb0.nightsBooked).toBe(7);
    near(feb.net - feb0.net, r.priceHT);
    expect(feb.commissions - feb0.commissions).toBe(0);
    expect(feb.occupancy).toBeGreaterThan(feb0.occupancy);
    expect(row(after, "03").revenueHT).toBe(row(before, "03").revenueHT);
    expect(after.totals.reservations - before.totals.reservations).toBe(1);
    near(after.totals.revenueHT - before.totals.revenueHT, r.priceHT);
    const direct = (s: Stats) => s.sources.find((x) => x.name === "Direct") ?? { count: 0, revenue: 0 };
    expect(direct(after).count - direct(before).count).toBe(1);
    near(direct(after).revenue - direct(before).revenue, r.priceHT);

    // cancelling it takes everything back out
    expect((await updateReservation(admin, r.id, { status: "cancelled" })).status).toBe(200);
    const undone = await stats(admin);
    near(row(undone, "02").revenueHT, feb0.revenueHT);
    expect(row(undone, "02").nightsBooked).toBe(feb0.nightsBooked);
  });

  test("a stay over two months is split night by night", async ({ admin, scratch }) => {
    const before = await stats(admin);
    const r = await stay(scratch, "03-28", "04-04");
    const after = await stats(admin);
    expect(row(after, "03").nightsBooked - row(before, "03").nightsBooked).toBe(4);
    expect(row(after, "04").nightsBooked - row(before, "04").nightsBooked).toBe(3);
    const march = row(after, "03").revenueHT - row(before, "03").revenueHT;
    const april = row(after, "04").revenueHT - row(before, "04").revenueHT;
    near(march + april, r.priceHT, 2);
    near(march, (r.priceHT * 4) / 7, 2);
  });

  test("an agency stay shows its commission (on the rent before tax) and its source", async ({ admin, scratch }) => {
    const agency = await scratch.agency({ commissionPercent: 20 });
    const before = await stats(admin);
    const r = await stay(scratch, "01-12", "01-19", { agencyId: agency.id, agencyFeePercent: 20 });
    const after = await stats(admin);
    const jan0 = row(before, "01");
    const jan = row(after, "01");
    near(jan.commissions - jan0.commissions, r.priceHT * 0.2);
    near(jan.net - jan0.net, r.priceHT * 0.8, 2);
    const source = after.sources.find((x) => x.name === agency.name);
    expect(source.count).toBe(1);
    near(source.revenue, r.priceHT);
    expect(after.totals.directShare).toBeLessThan(1);
  });

  test("money counts in the month it was received, refunds come off", async ({ admin, scratch }) => {
    const before = await stats(admin);
    const r = await stay(scratch, "05-19", "05-26");
    await addPayment(admin, r.id, "deposit", 5000, day("10-05"));
    await addPayment(admin, r.id, "balance", 7000, day("04-20"));
    await addPayment(admin, r.id, "refund", 1000, day("04-22"));
    const after = await stats(admin);
    expect(row(after, "10").cashIn - row(before, "10").cashIn).toBe(5000);
    expect(row(after, "04").cashIn - row(before, "04").cashIn).toBe(6000);
    expect(row(after, "05").cashIn).toBe(row(before, "05").cashIn);
    expect(after.totals.cashIn - before.totals.cashIn).toBe(11000);
  });
});

test.describe("finance: expenses", () => {
  const expense = async (scratch: Scratch, data: Record<string, unknown>) => {
    const res = await scratch.admin.post("/api/admin/expenses", { category: "entretien", description: marked("Expense"), ...data });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    scratch.track(() => scratch.admin.del(`/api/admin/expenses/${res.body.expense.id}`));
    return res.body.expense;
  };

  test("a one-off expense lands in its month; editing and deleting it follow", async ({ admin, scratch }) => {
    const before = await stats(admin);
    const e = await expense(scratch, { date: day("11-14"), amount: 450.5 });
    expect(e).toMatchObject({ amount: 450.5, currency: "EUR", isFixed: false, frequency: null });
    let now = await stats(admin);
    near(row(now, "11").expensesEUR - row(before, "11").expensesEUR, 450.5, 0.01);
    near(now.totals.expensesEUR - before.totals.expensesEUR, 450.5, 0.01);

    const listed = (await admin.get(`/api/admin/expenses?season=${SEASON}`)).body.expenses as any[];
    expect(listed.find((x) => x.id === e.id)).toMatchObject({ date: day("11-14"), category: "entretien" });
    const otherSeason = (await admin.get(`/api/admin/expenses?season=${SEASON - 3}`)).body.expenses as any[];
    expect(otherSeason.some((x) => x.id === e.id)).toBe(false);

    // only the amount changes: date, category and description stay
    const put = await admin.put(`/api/admin/expenses/${e.id}`, { amount: 300 });
    expect(put.status).toBe(200);
    expect(put.body.expense).toMatchObject({ amount: 300, category: "entretien", description: e.description, currency: "EUR" });
    now = await stats(admin);
    near(row(now, "11").expensesEUR - row(before, "11").expensesEUR, 300, 0.01);

    expect((await admin.del(`/api/admin/expenses/${e.id}`)).status).toBe(200);
    near(row(await stats(admin), "11").expensesEUR, row(before, "11").expensesEUR, 0.01);
  });

  test("recurring charges repeat at their rhythm, from their start to their end", async ({ admin, scratch }) => {
    const before = await stats(admin);
    await expense(scratch, { date: day("09-01"), amount: 100, isFixed: true, frequency: "monthly", category: "internet" });
    await expense(scratch, { date: day("10-01"), amount: 900, isFixed: true, frequency: "quarterly", category: "assurance" });
    await expense(scratch, { date: day("12-01"), amount: 40, isFixed: true, frequency: "monthly", endDate: day("02-28"), category: "eau" });
    const after = await stats(admin);
    const added = after.months.map((m, i) => Math.round((m.expensesEUR - before.months[i].expensesEUR) * 100) / 100);
    //            Sep  Oct   Nov  Dec  Jan   Feb  Mar  Apr   May  Jun  Jul   Aug
    expect(added).toEqual([100, 1000, 100, 140, 1040, 140, 100, 1000, 100, 100, 1000, 100]);
    // the templates are listed apart, whatever the season looked at
    const recurring = (await admin.get(`/api/admin/expenses?season=${SEASON - 3}`)).body.recurring as any[];
    expect(recurring.filter((x) => isMarked(x.description))).toHaveLength(3);
    // they do not reach back before their start
    const earlier = (await admin.get(`/api/admin/stats?season=${SEASON - 1}`)).body as Stats;
    expect(earlier.months).toHaveLength(12);
  });

  test("expenses with a bad date, category or amount are refused", async ({ admin }) => {
    const post = (data: Record<string, unknown>) => admin.post("/api/admin/expenses", { date: day("11-14"), category: "entretien", amount: 10, description: marked("Expense"), ...data });
    for (const bad of [{ date: "14/11" }, { category: "champagne" }, { amount: -1 }, { amount: "ten" }, { frequency: "weekly", isFixed: true }, { paymentDay: 31 }]) {
      const res = await post(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect((await admin.put("/api/admin/expenses/99999999", { amount: 1 })).status).toBe(404);
  });
});

test.describe("finance: screens", () => {
  test("the finance screen and the dashboard draw the season's figures", async ({ page }) => {
    for (const path of ["/admin/finance", "/admin"]) {
      await page.goto(path);
      await expect(page.locator("main h1"), path).toBeVisible();
      await expect(page.locator("main"), path).not.toContainText(/NaN|undefined|\[object|Infinity/);
      await expect(page.locator("main select").first(), path).toBeVisible();
    }
  });
});
