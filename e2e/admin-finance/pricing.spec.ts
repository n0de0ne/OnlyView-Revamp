import { test, expect, marked, settings, type Scratch } from "../support/fixtures";
import { updateReservation } from "../support/contracts";

/** Far ahead, and clear of the season the finance figures are checked on: rates set here touch no real date. */
const YEAR = new Date().getUTCFullYear() + 10;
const day = (monthDay: string) => `${YEAR}-${monthDay}`;
const near = (a: number, b: number, tolerance = 1) => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThanOrEqual(tolerance);

const period = async (scratch: Scratch, data: Record<string, unknown>) => {
  const res = await scratch.admin.post("/api/admin/rate-periods", { name: marked("Rate"), ...data });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  scratch.track(() => scratch.admin.del(`/api/admin/rate-periods/${res.body.period.id}`));
  return res.body.period;
};
const weekAt = (scratch: Scratch, from: string, to: string, over: Record<string, unknown> = {}) =>
  scratch.reservation("admin-pricing", { startDate: day(from), endDate: day(to), ...over });

test.describe.configure({ mode: "serial" });

test.describe("pricing: rates by date", () => {
  test("a fixed weekly rate on given dates replaces the season's rate, per number of bedrooms", async ({ admin, scratch }) => {
    const plain = await weekAt(scratch, "05-06", "05-13");
    await period(scratch, { startDate: day("05-06"), endDate: day("05-12"), mode: "fixed", rate4: 33300, rate3: 22200 });
    // the stay is repriced when saved again
    const four = (await updateReservation(admin, plain.id, {})).body.reservation;
    near(four.priceHT, 33300);
    expect(four.priceHT).not.toBe(plain.priceHT);
    const three = (await updateReservation(admin, plain.id, { bedrooms: 3, guests: 6 })).body.reservation;
    near(three.priceHT, 22200);
    // no rate was given for two bedrooms: the season's rate applies
    const two = (await updateReservation(admin, plain.id, { bedrooms: 2, guests: 4 })).body.reservation;
    expect(two.priceHT).toBeLessThan(22200);
    expect(two.priceHT).toBeGreaterThan(0);
  });

  test("a percentage adjusts the season's rate; a paused period changes nothing; half a week is half adjusted", async ({ admin, scratch }) => {
    const plain = await weekAt(scratch, "06-03", "06-10");
    const p = await period(scratch, { startDate: day("06-03"), endDate: day("06-09"), mode: "percent", adjustPercent: 50 });
    near((await updateReservation(admin, plain.id, {})).body.reservation.priceHT, plain.priceHT * 1.5, 2);

    const paused = await admin.put(`/api/admin/rate-periods/${p.id}`, { name: p.name, startDate: day("06-03"), endDate: day("06-09"), mode: "percent", adjustPercent: 50, isActive: false });
    expect(paused.status, JSON.stringify(paused.body)).toBe(200);
    near((await updateReservation(admin, plain.id, {})).body.reservation.priceHT, plain.priceHT);

    // on again for the first three nights only
    const part = await admin.put(`/api/admin/rate-periods/${p.id}`, { name: p.name, startDate: day("06-03"), endDate: day("06-05"), mode: "percent", adjustPercent: 50, isActive: true });
    expect(part.status).toBe(200);
    const mixed = (await updateReservation(admin, plain.id, {})).body.reservation.priceHT;
    near(mixed, plain.priceHT * (1 + (0.5 * 3) / 7), 3);
  });

  test("a period can impose its own minimum stay", async ({ admin, scratch }) => {
    const s = await settings(admin);
    const p = await period(scratch, { startDate: day("07-01"), endDate: day("07-14"), mode: "percent", adjustPercent: 0, minStay: 10 });
    expect(p.minStay).toBe(10);
    expect(Number(s.min_stay ?? 4)).toBeLessThan(10);
    const listed = ((await admin.get("/api/admin/rate-periods")).body.periods as any[]).find((x) => x.id === p.id);
    expect(listed).toMatchObject({ startDate: day("07-01"), endDate: day("07-14"), minStay: 10, isActive: true, showOnWebsite: false });
  });

  test("periods that end before they start or carry no rate are refused", async ({ admin }) => {
    const post = (data: Record<string, unknown>) => admin.post("/api/admin/rate-periods", { name: marked("Rate"), startDate: day("08-01"), endDate: day("08-07"), ...data });
    const backwards = await post({ startDate: day("08-07"), endDate: day("08-01"), rate4: 1000 });
    expect(backwards.status).toBe(400);
    expect(backwards.body.error).toContain("end_before_start");
    expect((await post({ mode: "fixed" })).body.error).toContain("missing_rate");
    expect((await post({ mode: "percent" })).body.error).toContain("missing_rate");
    expect((await post({ mode: "percent", adjustPercent: -95 })).status).toBe(400);
    expect((await post({ name: "", rate4: 1000 })).status).toBe(400);
    expect((await admin.put("/api/admin/rate-periods/99999999", { name: "x", startDate: day("08-01"), endDate: day("08-07"), rate4: 1 })).status).toBe(404);
  });

  test("the pricing screen lists the periods", async ({ page, scratch }) => {
    const p = await period(scratch, { startDate: day("09-10"), endDate: day("09-20"), mode: "fixed", rate4: 12345 });
    await page.goto("/admin/pricing");
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).toContainText(p.name);
  });
});

test.describe("pricing: promotions", () => {
  const promo = async (scratch: Scratch, data: Record<string, unknown> = {}) => {
    const res = await scratch.admin.post("/api/admin/promotions", { name: marked("Promo"), discountType: "percent", discountValue: 10, ...data });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    scratch.track(() => scratch.admin.del(`/api/admin/promotions/${res.body.promotion.id}`));
    return res.body.promotion;
  };

  test("a promotion is created, edited field by field, paused and removed", async ({ admin, scratch }) => {
    const code = `E2E${Date.now().toString(36).toUpperCase()}`;
    const p = await promo(scratch, { promoCode: code, discountValue: 15, minNights: 5, validUntil: day("12-31"), showOnWebsite: false, maxUses: 3 });
    expect(p).toMatchObject({ promoCode: code, discountValue: 15, minNights: 5, isActive: true, maxUses: 3 });

    const put = await admin.put(`/api/admin/promotions/${p.id}`, { discountValue: 20 });
    expect(put.status).toBe(200);
    expect(put.body.promotion).toMatchObject({ discountValue: 20, promoCode: code, minNights: 5, isActive: true, maxUses: 3, discountType: "percent" });
    expect((await admin.put(`/api/admin/promotions/${p.id}`, { isActive: false })).body.promotion).toMatchObject({ isActive: false, discountValue: 20 });
    const listed = ((await admin.get("/api/admin/promotions")).body.promotions as any[]).find((x) => x.id === p.id);
    expect(listed).toMatchObject({ isActive: false, promoCode: code });

    expect((await admin.del(`/api/admin/promotions/${p.id}`)).status).toBe(200);
    expect(((await admin.get("/api/admin/promotions")).body.promotions as any[]).some((x) => x.id === p.id)).toBe(false);
  });

  test("a hidden promotion never shows on the public rates page; bad input is refused", async ({ admin, visitor, scratch }) => {
    const p = await promo(scratch, { showOnWebsite: false });
    expect(String((await visitor.get("/rates")).body)).not.toContain(p.name);
    expect((await admin.post("/api/admin/promotions", { name: "" })).status).toBe(400);
    expect((await admin.post("/api/admin/promotions", { name: marked("Promo"), discountType: "bogof" })).status).toBe(400);
    expect((await admin.post("/api/admin/promotions", { name: marked("Promo"), discountValue: -5 })).status).toBe(400);
    expect((await admin.post("/api/admin/promotions", { name: marked("Promo"), validFrom: "tomorrow" })).status).toBe(400);
  });

  test("the promotions screen lists them", async ({ page, scratch }) => {
    const p = await promo(scratch);
    await page.goto("/admin/promotions");
    await expect(page.locator("main")).toContainText(p.name);
  });
});

test.describe("pricing: settings", () => {
  test("saving the settings unchanged keeps every figure; unknown keys and bad season dates are refused", async ({ admin }) => {
    const before = await settings(admin);
    const same = await admin.put("/api/admin/settings", { settings: { tax_rate: before.tax_rate ?? "5", not_a_setting: "x" } });
    expect(same.status).toBe(200);
    const after = await settings(admin);
    expect(after.not_a_setting).toBeUndefined();
    for (const key of Object.keys(before)) expect(after[key], key).toBe(before[key]);

    const bad = await admin.put("/api/admin/settings", { settings: { season_winter_start: "December 15" } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("invalid_season_date");
    expect((await admin.put("/api/admin/settings", { settings: { contact_email: "x".repeat(2500) } })).status).toBe(400);
    expect((await settings(admin)).season_winter_start).toBe(before.season_winter_start);
  });

  test("the settings screen opens for the owner", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main input").first()).toBeVisible();
  });
});
