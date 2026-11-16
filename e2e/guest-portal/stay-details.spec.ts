import { test, expect, emailLogs, guestApi, openGuestPortal } from "../support/fixtures";

/** Arrival & departure details: the guest fills them in, the owner reads them in the reservation. */
test.describe("guest portal: arrival details", () => {
  test("the guest saves flights, times and party; the owner sees them and is told", async ({ page, admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal");
    const id = reservation.id;
    await openGuestPortal(page, admin, id);
    const field = (k: string) => page.locator(`#${k}-${id}`);
    // the form sits in a folded section
    await field("arrivalFlight").evaluate((el) => el.closest("details")?.setAttribute("open", ""));
    await field("arrivalFlight").fill("PV 2211 from St Maarten");
    await field("arrivalEta").fill("15:30");
    await field("departureFlight").fill("PV 2214");
    await field("departureEta").fill("11:00");
    await field("adults").fill("6");
    await field("children").fill("2");
    await field("guestNames").fill("E2E Ada\nE2E Grace");
    await field("specialRequests").fill("E2E: one nut allergy, a baby cot");
    const saved = page.waitForResponse((r) => r.url().includes(`/api/account/reservations/${id}/details`));
    await field("arrivalFlight").locator("xpath=ancestor::form").locator('button[type="submit"]').click();
    expect((await saved).status()).toBe(200);
    await expect(field("arrivalFlight").locator("xpath=ancestor::form")).toContainText("✓");

    const r = (await admin.get(`/api/admin/reservations/${id}`)).body.reservation;
    expect(r.guestDetails).toMatchObject({
      arrivalFlight: "PV 2211 from St Maarten",
      arrivalEta: "15:30",
      departureFlight: "PV 2214",
      departureEta: "11:00",
      adults: 6,
      children: 2,
      guestNames: "E2E Ada\nE2E Grace",
      specialRequests: "E2E: one nut allergy, a baby cot",
    });
    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "admin_guest_update" && l.reservationId === id);
    expect(mail, "the owner is notified").toBeTruthy();

    // the details are still there when the guest comes back
    await page.reload();
    await expect(field("arrivalFlight")).toHaveValue("PV 2211 from St Maarten");
    await expect(field("adults")).toHaveValue("6");
  });

  test("emptied fields are cleared, out-of-range values refused", async ({ admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal");
    const guest = await guestApi(admin, reservation.id);
    const url = `/api/account/reservations/${reservation.id}/details`;
    expect((await guest.post(url, { arrivalFlight: "PV 1", adults: 4 })).status).toBe(200);
    expect((await guest.post(url, { arrivalFlight: "  ", adults: null })).status).toBe(200);
    const r = (await admin.get(`/api/admin/reservations/${reservation.id}`)).body.reservation;
    expect(r.guestDetails.arrivalFlight).toBeNull();
    expect(r.guestDetails.adults).toBeNull();
    expect((await guest.post(url, { adults: 500 })).status).toBe(400);
    expect((await guest.post(url, { arrivalFlight: "x".repeat(500) })).status).toBe(400);
    await guest.dispose();
  });
});
