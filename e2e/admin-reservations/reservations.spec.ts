import { test, expect, addDays, emailLogs, laneWindow, marked, settings, today } from "../support/fixtures";
import { addPayment, reservationOf, updateReservation } from "../support/contracts";

const near = (a: number, b: number, tolerance = 1) => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThanOrEqual(tolerance);

/** The stays themselves: creation, pricing options, clashes of dates, payments, archive. */
test.describe("reservations: create and price", () => {
  test("a new stay is priced: rent, tax and deposit add up to the settings", async ({ admin, scratch }) => {
    const s = await settings(admin);
    const { client, reservation: r } = await scratch.guestStay("admin-reservations");
    expect(r).toMatchObject({ status: "confirmed", bedrooms: 4, guests: 8, clientId: client.id, isArchived: false, depositReceived: false, balanceReceived: false });
    expect(r.priceHT).toBeGreaterThan(0);
    near(r.priceHT + r.taxAmount, r.priceTTC);
    if (s.tax_rate) near(r.taxAmount, (r.priceHT * parseFloat(s.tax_rate)) / 100);
    if (s.deposit_percent) near(r.depositAmount, (r.priceTTC * parseFloat(s.deposit_percent)) / 100);
    expect(r.client).toMatchObject({ id: client.id, email: client.email });

    // it is in the list of its season and can be read back alone
    const listed = ((await admin.get("/api/admin/reservations?status=confirmed")).body.reservations as any[]).find((x) => x.id === r.id);
    expect(listed.priceTTC).toBe(r.priceTTC);
    expect((await admin.get("/api/admin/reservations/99999999")).status).toBe(404);
    const audit = (await admin.get("/api/admin/audit?take=50")).body.logs as any[];
    expect(audit.some((l) => l.entityType === "reservation" && l.entityId === r.id)).toBe(true);
  });

  test("discount, free nights, waived tax, agreed price and custom weekly rate each change the total as told", async ({ admin, scratch }) => {
    const base = await scratch.reservation("admin-reservations");
    const id = base.id;
    const save = async (changes: Record<string, unknown>) => {
      const res = await updateReservation(admin, id, {
        discountPercent: 0, freeNights: 0, noTax: false, finalPriceOverride: null, customWeeklyRate: null, offerOneRoom: false, ...changes,
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return res.body.reservation;
    };

    const discounted = await save({ discountPercent: 10 });
    near(discounted.priceHT, base.priceHT * 0.9);
    const oneFree = await save({ freeNights: 1 });
    near(oneFree.priceHT, (base.priceHT * 6) / 7, 2);
    const noTax = await save({ noTax: true });
    expect(noTax.taxAmount).toBe(0);
    expect(noTax.priceTTC).toBe(noTax.priceHT);
    near(noTax.priceHT, base.priceHT);
    const agreed = await save({ finalPriceOverride: 20000 });
    expect(agreed.priceHT).toBe(20000);
    near(agreed.priceTTC - agreed.taxAmount, 20000);
    const custom = await save({ customWeeklyRate: 14000 });
    near(custom.priceHT, 14000);
    const threeRooms = await save({ bedrooms: 3, guests: 6 });
    expect(threeRooms.priceHT).toBeLessThanOrEqual(base.priceHT);
    // back to the plain week
    const plain = await save({ bedrooms: 4, guests: 8 });
    near(plain.priceTTC, base.priceTTC);
  });

  test("bedrooms can vary by period inside one stay", async ({ admin, scratch }) => {
    const base = await scratch.reservation("admin-reservations", {}, { nights: 14 });
    const mid = addDays(base.startDate, 7);
    const res = await updateReservation(admin, base.id, {
      periods: [
        { startDate: base.startDate, endDate: mid, bedrooms: 4, weeklyRate: null },
        { startDate: mid, endDate: base.endDate, bedrooms: 2, weeklyRate: null },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const r = res.body.reservation;
    expect(r.periods).toHaveLength(2);
    expect(r.periods.map((p: any) => p.bedrooms)).toEqual([4, 2]);
    expect(r.priceHT).toBeLessThan(base.priceHT);
    expect(r.priceHT).toBeGreaterThan(base.priceHT / 2);
  });

  test("badly formed stays are refused", async ({ admin, scratch }) => {
    const w = laneWindow("admin-reservations", 4);
    const post = (over: Record<string, unknown>) => admin.post("/api/admin/reservations", { status: "confirmed", bedrooms: 4, guests: 8, clientName: marked("Stay"), ...w, ...over });
    const backwards = await post({ startDate: w.endDate, endDate: w.startDate });
    expect(backwards.status).toBe(400);
    expect(backwards.body.error).toBe("invalid_dates");
    expect((await post({ endDate: w.startDate })).status).toBe(400);
    expect((await post({ startDate: "next week" })).status).toBe(400);
    expect((await post({ bedrooms: 5 })).status).toBe(400);
    expect((await post({ guests: 9 })).status).toBe(400);
    expect((await post({ bedrooms: 2, guests: 8 })).status, "more guests than two bedrooms sleep").toBe(400);
    expect((await post({ status: "maybe" })).status).toBe(400);
    expect((await post({ discountPercent: 150 })).status).toBe(400);
    // nothing was created along the way
    const left = ((await admin.get("/api/admin/reservations?archived=all")).body.reservations as any[]).filter((r) => r.startDate === w.startDate && r.clientName?.startsWith("E2E Stay"));
    for (const r of left) scratch.track(() => admin.del(`/api/admin/reservations/${r.id}`));
    expect(left).toHaveLength(0);
  });
});

test.describe("reservations: dates never clash", () => {
  test("overlapping stays are refused; back-to-back, cancelled and request-only ones are fine", async ({ admin, scratch }) => {
    const first = await scratch.reservation("admin-reservations");
    const post = (over: Record<string, unknown>) => admin.post("/api/admin/reservations", { status: "confirmed", bedrooms: 4, guests: 8, clientName: marked("Stay"), ...over });
    const keep = (res: any) => res.status === 200 && scratch.track(() => admin.del(`/api/admin/reservations/${res.body.reservation.id}`));

    for (const [what, window] of [
      ["same dates", { startDate: first.startDate, endDate: first.endDate }],
      ["overlap at the end", { startDate: addDays(first.endDate, -1), endDate: addDays(first.endDate, 4) }],
      ["overlap at the start", { startDate: addDays(first.startDate, -3), endDate: addDays(first.startDate, 1) }],
      ["inside", { startDate: addDays(first.startDate, 2), endDate: addDays(first.startDate, 4) }],
      ["around", { startDate: addDays(first.startDate, -1), endDate: addDays(first.endDate, 1) }],
    ] as const) {
      for (const status of ["confirmed", "option", "blocked"]) {
        const res = await post({ ...window, status });
        keep(res);
        expect(res.status, `${what} as ${status}`).toBe(409);
        expect(res.body.error).toBe("dates_conflict");
      }
    }
    // a cancelled stay on the same dates takes nothing
    const cancelled = await post({ startDate: first.startDate, endDate: first.endDate, status: "cancelled" });
    keep(cancelled);
    expect(cancelled.status).toBe(200);
    // …and cannot be revived over the confirmed one
    const revive = await updateReservation(admin, cancelled.body.reservation.id, { status: "confirmed" });
    expect(revive.status).toBe(409);

    // arrival on the day the others leave (the slot after is one day apart: use that day)
    const after = await post({ startDate: first.endDate, endDate: addDays(first.endDate, 1), status: "blocked", clientName: marked("Block") });
    keep(after);
    expect(after.status, JSON.stringify(after.body)).toBe(200);
    // moving the first stay onto the block is refused, shortening it is fine
    expect((await updateReservation(admin, first.id, { endDate: addDays(first.endDate, 1) })).status).toBe(409);
    const shorter = await updateReservation(admin, first.id, { endDate: addDays(first.endDate, -1) });
    expect(shorter.status).toBe(200);
    expect(shorter.body.reservation.priceTTC).toBeLessThan(first.priceTTC);
  });

  test("an option carries its expiry date", async ({ admin, scratch }) => {
    const expires = addDays(today(), 10);
    const option = await scratch.reservation("admin-reservations", { status: "option", optionExpires: expires });
    expect(option).toMatchObject({ status: "option", optionExpires: expires });
    const confirmed = await updateReservation(admin, option.id, { status: "confirmed", optionExpires: null });
    expect(confirmed.body.reservation).toMatchObject({ status: "confirmed", optionExpires: null });
  });
});

test.describe("reservations: money received", () => {
  test("deposit then balance: the flags follow what was paid, a refund reopens the balance", async ({ admin, scratch }) => {
    const { reservation: r } = await scratch.guestStay("admin-reservations");
    const deposit = Math.round(r.depositAmount);
    expect((await addPayment(admin, r.id, "deposit", deposit, today())).totalPaid).toBe(deposit);
    let now = await reservationOf(admin, r.id);
    expect(now).toMatchObject({ depositReceived: true, balanceReceived: false });
    expect(now.payments).toHaveLength(1);
    expect(now.payments[0]).toMatchObject({ kind: "deposit", amount: deposit, method: "wire" });

    const rest = r.priceTTC - deposit;
    near((await addPayment(admin, r.id, "balance", rest, today())).totalPaid, r.priceTTC, 0.01);
    now = await reservationOf(admin, r.id);
    expect(now.balanceReceived).toBe(true);

    near((await addPayment(admin, r.id, "refund", 500, today())).totalPaid, r.priceTTC - 500, 0.01);
    expect((await reservationOf(admin, r.id)).balanceReceived).toBe(false);

    // a payment entered by mistake is removed
    const mistake = (await reservationOf(admin, r.id)).payments.find((p: any) => p.kind === "refund");
    expect((await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "delete-payment", paymentId: mistake.id })).status).toBe(200);
    expect((await reservationOf(admin, r.id)).payments).toHaveLength(2);
    expect((await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "add-payment" })).status).toBe(400);
    expect((await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "add-payment", payment: { kind: "tip", amount: 5, method: "wire", receivedAt: today() } })).status).toBe(400);
  });

  test("an agency booking is settled in one payment: the rent less its commission on the rent before tax", async ({ admin, scratch }) => {
    const agency = await scratch.agency({ commissionPercent: 20 });
    const r = await scratch.reservation("admin-reservations", { agencyId: agency.id, agencyFeePercent: 20 });
    expect(r.agency).toMatchObject({ id: agency.id, name: agency.name });
    const commission = r.priceHT * 0.2;
    const due = r.priceTTC - commission;

    // one euro short is not paid in full
    await addPayment(admin, r.id, "balance", Math.floor(due) - 1, today());
    expect((await reservationOf(admin, r.id)).balanceReceived).toBe(false);
    await addPayment(admin, r.id, "balance", due - (Math.floor(due) - 1), today());
    expect((await reservationOf(admin, r.id)).balanceReceived, "paid in full without the commission").toBe(true);

    const row = ((await admin.get("/api/admin/agencies")).body.agencies as any[]).find((a) => a.id === agency.id);
    expect(row.stats.reservations).toBe(1);
    near(row.stats.commissions, commission);
    near(row.stats.volume, r.priceTTC);
  });
});

test.describe("reservations: follow-up", () => {
  test("archive hides a stay from the list without freeing or deleting anything", async ({ admin, scratch }) => {
    const r = await scratch.reservation("admin-reservations");
    const inList = async (query: string) => ((await admin.get(`/api/admin/reservations${query}`)).body.reservations as any[]).some((x) => x.id === r.id);
    expect((await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "archive" })).status).toBe(200);
    expect(await inList("")).toBe(false);
    expect(await inList("?archived=1")).toBe(true);
    expect(await inList("?archived=all")).toBe(true);
    expect((await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "unarchive" })).status).toBe(200);
    expect(await inList("")).toBe(true);
    expect((await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "explode" })).status).toBe(400);
    expect((await admin.post("/api/admin/reservations/99999999/actions", { action: "archive" })).status).toBe(404);
  });

  test("the confirmation and the portal access are emailed to the guest on request", async ({ admin, scratch }) => {
    const { client, reservation: r } = await scratch.guestStay("admin-reservations");
    const sent = await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "send-confirmation" });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    const access = await admin.post(`/api/admin/reservations/${r.id}/actions`, { action: "send-portal-email" });
    expect(access.status).toBe(200);
    expect(access.body.portalUrl).toContain("/api/account/login?pt=");
    const logs = (await emailLogs(admin)).filter((l) => l.recipientEmail === client.email);
    expect(logs.map((l) => l.templateSlug)).toEqual(expect.arrayContaining(["booking_confirmed", "guest_portal_access"]));
    expect(logs.find((l) => l.templateSlug === "guest_portal_access")!.body).toContain(access.body.portalUrl.replace(/&/g, "&amp;").split("?")[0]);

    // an option is not confirmed; a stay with no address has nobody to write to
    const option = await scratch.reservation("admin-reservations", { status: "option" });
    expect((await admin.post(`/api/admin/reservations/${option.id}/actions`, { action: "send-confirmation" })).body.error).toBe("not_confirmed");
    expect((await admin.post(`/api/admin/reservations/${option.id}/actions`, { action: "send-portal-email" })).body.error).toBe("missing_client_email");
  });

  test("the owner fills in the guest's arrival details for them", async ({ admin, scratch }) => {
    const r = await scratch.reservation("admin-reservations");
    const put = await admin.put(`/api/admin/reservations/${r.id}/guest-details`, { arrivalFlight: "TJ 310", arrivalEta: "14:00", adults: 5, children: 1 });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect((await reservationOf(admin, r.id)).guestDetails).toMatchObject({ arrivalFlight: "TJ 310", arrivalEta: "14:00", adults: 5, children: 1 });
    expect((await admin.put(`/api/admin/reservations/${r.id}/guest-details`, { adults: -1 })).status).toBe(400);
  });

  test("deleting a stay removes it and frees its dates", async ({ admin, visitor, scratch }) => {
    const r = await scratch.reservation("admin-reservations");
    expect((await admin.del(`/api/admin/reservations/${r.id}`)).status).toBe(200);
    expect((await admin.get(`/api/admin/reservations/${r.id}`)).status).toBe(404);
    const again = await admin.post("/api/admin/reservations", { status: "confirmed", bedrooms: 4, guests: 8, clientName: marked("Stay"), startDate: r.startDate, endDate: r.endDate });
    expect(again.status).toBe(200);
    scratch.track(() => admin.del(`/api/admin/reservations/${again.body.reservation.id}`));
    expect(visitor).toBeTruthy();
  });
});
