import { test, expect, laneWindow, marked, skipIfRateLimited, testEmail, uniq } from "../support/fixtures";

/**
 * From a website request to a stay: the owner turns a request into an option
 * (or a confirmed booking) in one click from the inbox.
 */
test.describe("request → reservation", () => {
  test("converting a request creates the stay, its client, and takes the dates", async ({ visitor, admin, scratch }) => {
    const id = uniq();
    const guest = { name: `E2E Convert ${id}`, email: testEmail(id) };
    const { startDate, endDate } = laneWindow("booking-convert", 0);
    test.skip(!(await visitor.post("/api/quote", { startDate, endDate, bedrooms: 3 })).body.available, "dates taken on this environment");

    const sent = await visitor.post("/api/booking-request", {
      startDate, endDate, bedrooms: 3, guests: 6, locale: "fr", phone: "+590 690 00 00 00", message: "Automated test request.", ...guest,
    });
    skipIfRateLimited(sent.status, "booking request");
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    const requestId = sent.body.id;
    scratch.track(() => admin.del(`/api/admin/requests/${requestId}`));

    // it counts in the menu badge until it is handled
    expect((await admin.get("/api/admin/badges")).body.requests).toBeGreaterThanOrEqual(1);

    const converted = await admin.put(`/api/admin/requests/${requestId}`, {
      action: "convert", reservationStatus: "option", optionExpires: laneWindow("booking-convert", 0).startDate,
    });
    expect(converted.status, JSON.stringify(converted.body)).toBe(200);
    const reservationId = converted.body.reservationId;
    scratch.track(() => admin.del(`/api/admin/reservations/${reservationId}`));

    const stay = (await admin.get(`/api/admin/reservations/${reservationId}`)).body.reservation;
    scratch.track(() => admin.del(`/api/admin/clients/${stay.clientId}`));
    expect(stay).toMatchObject({ status: "option", startDate, endDate, bedrooms: 3, guests: 6, clientName: guest.name, email: guest.email });
    expect(stay.notes).toContain("Automated test request");
    // priced by the same engine as the quote the guest saw
    const quote = (await visitor.post("/api/quote", { startDate, endDate: stay.endDate, bedrooms: 3 })).body.quote;
    expect(Math.round(stay.priceTTC)).toBe(Math.round(quote.totalTTC));

    // the guest became a client, in their language, marked as coming from the website
    const client = (await admin.get(`/api/admin/clients/${stay.clientId}`)).body.client;
    expect(client).toMatchObject({ firstname: "E2E", lastname: `Convert ${id}`, email: guest.email, language: "fr", source: "website" });

    const request = ((await admin.get("/api/admin/requests")).body.requests as any[]).find((r) => r.id === requestId);
    expect(request).toMatchObject({ status: "converted", reservationId });

    // the dates are now held
    expect((await visitor.post("/api/quote", { startDate, endDate, bedrooms: 3 })).body.available).toBe(false);

    // a second request for the same dates cannot be converted over the first
    const rival = await visitor.post("/api/booking-request", {
      startDate, endDate, bedrooms: 4, guests: 8, name: marked("Rival", id), email: testEmail(`${id}b`),
    });
    skipIfRateLimited(rival.status, "booking request");
    scratch.track(() => admin.del(`/api/admin/requests/${rival.body.id}`));
    const refused = await admin.put(`/api/admin/requests/${rival.body.id}`, { action: "convert", reservationStatus: "confirmed" });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe("dates_conflict");

    // it can be declined instead, with a note
    const declined = await admin.put(`/api/admin/requests/${rival.body.id}`, { action: "set-status", status: "declined", adminNotes: "Dates taken." });
    expect(declined.status).toBe(200);
    const after = ((await admin.get("/api/admin/requests?status=declined")).body.requests as any[]).find((r) => r.id === rival.body.id);
    expect(after.adminNotes).toBe("Dates taken.");
  });

  test("a returning guest's request is attached to their existing client record", async ({ visitor, admin, scratch }) => {
    const client = await scratch.client({ language: "en" });
    const { startDate, endDate } = laneWindow("booking-convert", 2);
    test.skip(!(await visitor.post("/api/quote", { startDate, endDate, bedrooms: 4 })).body.available, "dates taken on this environment");
    const sent = await visitor.post("/api/booking-request", {
      startDate, endDate, bedrooms: 4, guests: 8, name: client.fullName, email: client.email.toUpperCase(),
    });
    skipIfRateLimited(sent.status, "booking request");
    scratch.track(() => admin.del(`/api/admin/requests/${sent.body.id}`));
    const converted = await admin.put(`/api/admin/requests/${sent.body.id}`, { action: "convert", reservationStatus: "confirmed" });
    expect(converted.status, JSON.stringify(converted.body)).toBe(200);
    scratch.track(() => admin.del(`/api/admin/reservations/${converted.body.reservationId}`));
    const stay = (await admin.get(`/api/admin/reservations/${converted.body.reservationId}`)).body.reservation;
    expect(stay.clientId).toBe(client.id);
    expect(stay.status).toBe("confirmed");
  });

  test("the inbox is closed to visitors", async ({ visitor }) => {
    expect((await visitor.get("/api/admin/requests")).status).toBe(401);
    expect((await visitor.put("/api/admin/requests/1", { action: "convert" })).status).toBe(401);
    expect((await visitor.del("/api/admin/requests/1")).status).toBe(401);
  });
});
