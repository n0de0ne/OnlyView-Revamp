import { test, expect, addDays, laneWindow, marked, settings, today, uniq } from "../support/fixtures";

const near = (cents: number, expected: number) => Math.abs(cents - expected) <= 1;

/** The public quote: what a visitor is told a stay costs, and whether the dates are free. */
test.describe("quote", () => {
  test("a week is priced with tax, deposit and balance that add up", async ({ visitor }) => {
    const { startDate, endDate } = laneWindow("booking-request", 0);
    const res = await visitor.post("/api/quote", { startDate, endDate, bedrooms: 4 });
    expect(res.status).toBe(200);
    const q = res.body.quote;
    expect(q.nights).toBe(7);
    expect(q.minStayOk).toBe(true);
    expect(q.subtotalHT).toBeGreaterThan(0);
    expect(near(q.taxAmount, (q.subtotalHT * q.taxPercent) / 100), "tax = rate × rent").toBe(true);
    expect(near(q.totalTTC, q.subtotalHT + q.taxAmount), "total = rent + tax").toBe(true);
    expect(near(q.depositAmount, (q.totalTTC * q.depositPercent) / 100), "deposit = its share of the total").toBe(true);
    expect(near(q.balanceAmount, q.totalTTC - q.depositAmount), "balance = total − deposit").toBe(true);
    expect(q.lines.reduce((s: number, l: any) => s + l.nights, 0)).toBe(7);
  });

  test("tax, deposit and minimum stay are the ones set in the back-office", async ({ visitor, admin }) => {
    const s = await settings(admin);
    const { startDate } = laneWindow("booking-request", 0);
    const week = (await visitor.post("/api/quote", { startDate, endDate: addDays(startDate, 7), bedrooms: 4 })).body.quote;
    expect(week.taxPercent).toBe(Number(s.tax_rate));
    expect(week.depositPercent).toBe(Number(s.deposit_percent));

    const short = (await visitor.post("/api/quote", { startDate, endDate: addDays(startDate, 1), bedrooms: 4 })).body.quote;
    expect(short.minStayOk).toBe(false);
    expect(short.minStayRequired).toBeGreaterThanOrEqual(Number(s.min_stay));
  });

  test("fewer bedrooms in use never cost more", async ({ visitor }) => {
    const { startDate, endDate } = laneWindow("booking-request", 0);
    const price = async (bedrooms: number) => (await visitor.post("/api/quote", { startDate, endDate, bedrooms })).body.quote.subtotalHT;
    const [two, three, four] = [await price(2), await price(3), await price(4)];
    expect(two).toBeLessThanOrEqual(three);
    expect(three).toBeLessThanOrEqual(four);
    expect(two).toBeLessThan(four);
  });

  test("Christmas week is sold as a seven-night package at its own rate", async ({ visitor, admin }) => {
    const s = await settings(admin);
    const [mm, dd] = (s.season_christmas_start || "12-20").split("-").map(Number);
    let year = new Date().getUTCFullYear();
    const pad = (n: number) => String(n).padStart(2, "0");
    if (`${year}-${pad(mm)}-${pad(dd)}` <= today()) year += 1;
    const startDate = `${year}-${pad(mm)}-${pad(dd)}`;

    const week = (await visitor.post("/api/quote", { startDate, endDate: addDays(startDate, 7), bedrooms: 4 })).body.quote;
    expect(week.baseBeforeOffers).toBe(Number(s.price_christmas));

    const short = (await visitor.post("/api/quote", { startDate, endDate: addDays(startDate, 3), bedrooms: 4 })).body.quote;
    expect(short.minStayOk).toBe(false);
    expect(short.minStayRequired).toBe(Number(s.min_stay_peak));
    // three nights are billed as the whole package
    expect(short.baseBeforeOffers).toBe(Number(s.price_christmas));
  });

  test("dates that make no sense are refused", async ({ visitor }) => {
    const start = addDays(today(), 400);
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ startDate: start, endDate: start, bedrooms: 4 }, "invalid_dates"],
      [{ startDate: start, endDate: addDays(start, -3), bedrooms: 4 }, "invalid_dates"],
      [{ startDate: addDays(today(), -2), endDate: addDays(today(), 5), bedrooms: 4 }, "invalid_dates"],
      [{ startDate: start, endDate: addDays(start, 91), bedrooms: 4 }, "too_long"],
      [{ startDate: start, endDate: addDays(start, 7), bedrooms: 5 }, "invalid_input"],
      [{ startDate: start, endDate: addDays(start, 7), bedrooms: 1 }, "invalid_input"],
      [{ startDate: "next week", endDate: addDays(start, 7), bedrooms: 4 }, "invalid_input"],
    ];
    for (const [body, error] of cases) {
      const res = await visitor.post("/api/quote", body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error, JSON.stringify(body)).toBe(error);
    }
  });
});

test.describe("promo codes", () => {
  test("a valid code takes its discount off; a wrong, paused or used-up one changes nothing", async ({ visitor, admin, scratch }) => {
    const code = `E2E${uniq().toUpperCase()}`;
    const created = await admin.post("/api/admin/promotions", {
      name: marked("Promo"),
      discountType: "percent",
      discountValue: 10,
      promoCode: code,
      minNights: 5,
      isActive: true,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const promo = created.body.promotion;
    scratch.track(() => admin.del(`/api/admin/promotions/${promo.id}`));

    const { startDate, endDate } = laneWindow("booking-request", 0);
    const quote = async (promoCode: string | null, end = endDate) =>
      (await visitor.post("/api/quote", { startDate, endDate: end, bedrooms: 4, promoCode })).body.quote;

    const plain = await quote(null);
    const withCode = await quote(code.toLowerCase()); // codes are not case-sensitive
    expect(withCode.promoName).toBe(promo.name);
    expect(near(withCode.promoDiscount, withCode.baseBeforeOffers * 0.1)).toBe(true);
    expect(withCode.totalTTC).toBeLessThan(plain.totalTTC);
    expect(near(withCode.subtotalHT, withCode.baseBeforeOffers - withCode.promoDiscount)).toBe(true);

    expect((await quote("E2E-NOT-A-CODE")).totalTTC).toBe(plain.totalTTC);
    // below the promotion's minimum number of nights
    expect((await quote(code, addDays(startDate, 4))).promoName).not.toBe(promo.name);

    const paused = await admin.put(`/api/admin/promotions/${promo.id}`, { ...promo, isActive: false });
    expect(paused.status, JSON.stringify(paused.body)).toBe(200);
    expect((await quote(code)).totalTTC).toBe(plain.totalTTC);
  });
});

test.describe("availability", () => {
  test("a stay closes its nights to the public, and its checkout day stays open for an arrival", async ({ visitor, scratch }) => {
    const stay = await scratch.reservation("booking-request", { status: "confirmed" });
    const quote = async (startDate: string, endDate: string) =>
      (await visitor.post("/api/quote", { startDate, endDate, bedrooms: 4 })).body;

    expect((await quote(stay.startDate, stay.endDate)).available).toBe(false);
    expect((await quote(addDays(stay.startDate, 3), addDays(stay.endDate, 3))).available, "overlap").toBe(false);
    expect((await quote(addDays(stay.startDate, -4), addDays(stay.startDate, 1))).available, "one shared night").toBe(false);
    expect((await quote(stay.endDate, addDays(stay.endDate, 5))).available, "arrival on the checkout day").toBe(true);
    expect((await quote(addDays(stay.startDate, -5), stay.startDate)).available, "departure on the arrival day").toBe(true);

    const ranges = (await visitor.get(`/api/availability?from=${stay.startDate}&to=${stay.endDate}`)).body.bookings;
    const mine = ranges.find((r: any) => r.start === stay.startDate && r.end === stay.endDate);
    expect(mine, "the stay in the public calendar").toEqual({ start: stay.startDate, end: stay.endDate, status: "confirmed" });
  });

  test("an option holds the dates, a cancelled stay frees them", async ({ visitor, admin, scratch }) => {
    const stay = await scratch.reservation("booking-request", { status: "option", optionExpires: addDays(today(), 10) }, { fromSlot: 2 });
    const available = async () =>
      (await visitor.post("/api/quote", { startDate: stay.startDate, endDate: stay.endDate, bedrooms: 4 })).body.available;
    expect(await available()).toBe(false);
    const listed = (await visitor.get(`/api/availability?from=${stay.startDate}&to=${stay.endDate}`)).body.bookings;
    expect(listed.find((r: any) => r.start === stay.startDate)?.status).toBe("option");

    const cancelled = await admin.put(`/api/admin/reservations/${stay.id}`, {
      status: "cancelled",
      startDate: stay.startDate,
      endDate: stay.endDate,
      clientName: stay.clientName,
      bedrooms: 4,
      guests: 8,
    });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(await available()).toBe(true);
  });

  test("the public calendar and feed never carry a guest's name", async ({ visitor, admin, scratch }) => {
    const stay = await scratch.reservation("booking-request", {}, { fromSlot: 4 });
    const compact = stay.startDate.replace(/-/g, "");

    const availability = await visitor.get("/api/availability");
    expect(JSON.stringify(availability.body)).not.toContain(stay.clientName);
    for (const row of availability.body.bookings) expect(Object.keys(row).sort()).toEqual(["end", "start", "status"]);

    const feed = String((await visitor.get("/api/ical")).body);
    expect(feed).toContain(`DTSTART;VALUE=DATE:${compact}`);
    expect(feed).toContain("SUMMARY:Booked");
    expect(feed).not.toContain(stay.clientName);

    // signed in, the owner's feed names the guest
    expect(String((await admin.get("/api/ical")).body)).toContain(stay.clientName);
  });
});
