import { test, expect, addDays, adminContext, emailLogs, guestApi, marked, openGuestPortal, type Api, type Scratch } from "../support/fixtures";
import { reservationOf } from "../support/contracts";

/** A small catalog of its own, so the tests never depend on the real providers. */
async function catalog(scratch: Scratch) {
  const boatPartner = await scratch.concierge("partners", { kind: "boat", name: marked("Boats"), phone: "+590 590 00 00 01", currency: "EUR" });
  const boat = await scratch.concierge("boats", { partnerId: boatPartner.id, name: marked("Boat"), capacity: 8, priceHalfDay: 1200, priceFullDay: 2000 });
  const chefPartner = await scratch.concierge("partners", { kind: "chef", name: marked("Chef"), currency: "EUR" });
  const chef = await scratch.concierge("chef-offers", { partnerId: chefPartner.id, name: marked("Dinner"), category: "dinner", price: 150, priceType: "per_person", minimumGuests: 4 });
  const kind = await scratch.concierge("activity-categories", { nameEn: marked("Diving"), nameFr: marked("Plongée") });
  const offer = await scratch.concierge("activities", { categoryId: kind.id, name: marked("Two-tank dive"), price: 120, priceType: "per_person" });
  const restaurant = await scratch.place({ phone: "+590 590 00 00 02" });
  return { boatPartner, boat, chefPartner, chef, kind, offer, restaurant };
}

const openRequests = async (admin: Api, reservationId: number, scope = "open") =>
  ((await admin.get(`/api/admin/concierge-requests?scope=${scope}`)).body.requests as any[]).filter((r) => r.reservation.id === reservationId);

/**
 * Concierge: the guest asks for a table, a boat, a chef or an activity from
 * the portal; the owner answers from the back-office inbox and the guest is
 * told. These are requests, not extras: they never add to what the guest owes.
 */
test.describe("concierge: requests from the portal", () => {
  test("a table, a boat, a chef and an activity land in the owner's inbox", async ({ admin, scratch }) => {
    const c = await catalog(scratch);
    const { reservation } = await scratch.guestStay("concierge");
    const guest = await guestApi(admin, reservation.id);
    const url = `/api/account/reservations/${reservation.id}/concierge`;
    const date = addDays(reservation.startDate, 2);
    const before = (await admin.get("/api/admin/badges")).body.concierge;

    const table = await guest.post(url, { type: "restaurant", id: c.restaurant.id, date, time: "20:00", guests: 6, notes: "E2E: terrace" });
    expect(table.status, JSON.stringify(table.body)).toBe(200);
    const boat = await guest.post(url, { type: "boat", id: c.boat.id, outing: "half_day", date, guests: 6 });
    expect(boat.status, JSON.stringify(boat.body)).toBe(200);
    const chef = await guest.post(url, { type: "chef", id: c.chef.id, date, time: "19:30", guests: 6 });
    expect(chef.status, JSON.stringify(chef.body)).toBe(200);
    const dive = await guest.post(url, { type: "activity", id: c.kind.id, offerId: c.offer.id, date, guests: 2 });
    expect(dive.status, JSON.stringify(dive.body)).toBe(200);
    const anyDive = await guest.post(url, { type: "activity", id: c.kind.id, date, guests: 2 });
    expect(anyDive.status, "a kind of activity with no provider chosen").toBe(200);

    const inbox = await openRequests(admin, reservation.id);
    expect(inbox).toHaveLength(5);
    expect(inbox.map((r) => r.category).sort()).toEqual(["activity", "activity", "boat", "chef", "restaurant"]);
    const tableRow = inbox.find((r) => r.category === "restaurant");
    expect(tableRow).toMatchObject({ status: "requested", serviceDate: date, serviceTime: "20:00", guests: 6, placeSlug: c.restaurant.slug, placePhone: "+590 590 00 00 02" });
    expect(tableRow.label).toContain(c.restaurant.name);
    expect(tableRow.notes).toContain("E2E: terrace");
    // indicative prices are kept for the owner: 6 × 150 for the chef
    expect(inbox.find((r) => r.category === "chef").notes).toContain("900");
    expect(inbox.find((r) => r.category === "boat").notes).toContain("1,200");
    expect((await admin.get("/api/admin/badges")).body.concierge).toBe(before + 5);

    // none of it is billed with the stay
    const stay = await reservationOf(admin, reservation.id);
    expect(stay.priceTTC).toBe(reservation.priceTTC);
    expect(stay.extras.every((x: any) => x.amount === 0)).toBe(true);
    const mails = (await emailLogs(admin)).filter((l) => l.templateSlug === "admin_guest_update" && l.reservationId === reservation.id);
    expect(mails.length).toBeGreaterThanOrEqual(5);
    await guest.dispose();
  });

  test("the owner confirms with a note: the guest is emailed and reads it in the portal", async ({ page, admin, scratch }) => {
    const c = await catalog(scratch);
    const { client, reservation } = await scratch.guestStay("concierge");
    const id = reservation.id;
    const guest = await guestApi(admin, id);
    const date = addDays(reservation.startDate, 1);
    const asked = await guest.post(`/api/account/reservations/${id}/concierge`, { type: "restaurant", id: c.restaurant.id, date, time: "20:30", guests: 4 });
    expect(asked.status).toBe(200);
    await guest.dispose();
    const item = asked.body.item;

    const answer = await admin.put(`/api/admin/reservations/${id}/extras/${item.id}`, { status: "confirmed", serviceTime: "21:00", adminNote: "E2E: table booked under your name" });
    expect(answer.status, JSON.stringify(answer.body)).toBe(200);
    expect(answer.body.item).toMatchObject({ status: "confirmed", serviceTime: "21:00", adminNote: "E2E: table booked under your name" });
    expect(answer.body.item.answeredAt).toBeTruthy();
    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "concierge_confirmed" && l.recipientEmail === client.email);
    expect(mail, "the guest is emailed the answer").toBeTruthy();
    expect(mail!.body).toContain(c.restaurant.name);
    expect(mail!.body).toContain("E2E: table booked under your name");

    // answered: out of the open inbox, still in the upcoming list
    expect(await openRequests(admin, id)).toHaveLength(0);
    expect(await openRequests(admin, id, "upcoming")).toHaveLength(1);

    // the portal tells the server the answer was seen, so it is highlighted once only
    const seen = page.waitForResponse((r) => r.url().includes(`/reservations/${id}/concierge/seen`));
    await openGuestPortal(page, admin, id);
    expect((await seen).status()).toBe(200);
    const mine = page.locator(`#concierge-requests-${id}`);
    await expect(mine).toContainText(c.restaurant.name);
    await expect(mine).toContainText("E2E: table booked under your name");
    await expect(mine).toContainText("9:00 PM");
    // an answered request is no longer the guest's to remove
    expect((await page.request.delete(`/api/account/reservations/${id}/extras/${item.id}`)).status()).toBe(403);
  });

  test("declined quietly when the owner chooses not to notify", async ({ admin, scratch }) => {
    const c = await catalog(scratch);
    const { client, reservation } = await scratch.guestStay("concierge");
    const guest = await guestApi(admin, reservation.id);
    const asked = await guest.post(`/api/account/reservations/${reservation.id}/concierge`, { type: "chef", id: c.chef.id, date: reservation.startDate, guests: 2 });
    expect(asked.status).toBe(200);
    // below the chef's minimum: the owner is warned in the notes
    expect(asked.body.item.notes).toMatch(/minimum/);
    const answer = await admin.put(`/api/admin/reservations/${reservation.id}/extras/${asked.body.item.id}`, { status: "declined", notifyGuest: false });
    expect(answer.body.guestEmailed).toBe(false);
    expect((await emailLogs(admin)).some((l) => l.templateSlug === "concierge_declined" && l.recipientEmail === client.email)).toBe(false);
    await guest.dispose();
  });

  test("the guest withdraws a request that has no answer yet", async ({ admin, scratch }) => {
    const c = await catalog(scratch);
    const { reservation } = await scratch.guestStay("concierge");
    const guest = await guestApi(admin, reservation.id);
    const asked = await guest.post(`/api/account/reservations/${reservation.id}/concierge`, { type: "boat", id: c.boat.id, outing: "full_day", date: reservation.startDate, guests: 4 });
    expect(asked.status).toBe(200);
    expect((await guest.del(`/api/account/reservations/${reservation.id}/extras/${asked.body.item.id}`)).status).toBe(200);
    expect(await openRequests(admin, reservation.id, "all")).toHaveLength(0);
    await guest.dispose();
  });

  test("requests outside the stay, for things switched off or badly formed are refused", async ({ admin, scratch }) => {
    const c = await catalog(scratch);
    const { reservation } = await scratch.guestStay("concierge");
    const guest = await guestApi(admin, reservation.id);
    const url = `/api/account/reservations/${reservation.id}/concierge`;
    const date = reservation.startDate;

    const early = await guest.post(url, { type: "chef", id: c.chef.id, date: addDays(reservation.startDate, -3), guests: 4 });
    expect(early.status).toBe(400);
    expect(early.body.error).toBe("outside_stay");
    expect((await guest.post(url, { type: "chef", id: c.chef.id, date: addDays(reservation.endDate, 1), guests: 4 })).body.error).toBe("outside_stay");
    // an outing this boat has no price for
    expect((await guest.post(url, { type: "boat", id: c.boat.id, outing: "sunset", date, guests: 4 })).status).toBe(400);
    expect((await guest.post(url, { type: "restaurant", id: c.restaurant.id, date, guests: 4 })).status, "a table needs a time").toBe(400);
    expect((await guest.post(url, { type: "spa", id: 1, date, guests: 2 })).status).toBe(400);
    expect((await guest.post(url, { type: "chef", id: 99999999, date, guests: 4 })).status).toBe(404);

    // a provider switched off takes its offers with it
    const off = await admin.put(`/api/admin/concierge/partners/${c.boatPartner.id}`, { kind: "boat", name: c.boatPartner.name, isActive: false });
    expect(off.status, JSON.stringify(off.body)).toBe(200);
    expect((await guest.post(url, { type: "boat", id: c.boat.id, outing: "half_day", date, guests: 4 })).status).toBe(404);
    // a restaurant that takes no bookings through the villa
    const walkIn = await scratch.place({ bookingMode: null });
    expect((await guest.post(url, { type: "restaurant", id: walkIn.id, date, time: "20:00", guests: 2 })).status).toBe(404);
    expect(await openRequests(admin, reservation.id, "all")).toHaveLength(0);
    await guest.dispose();
  });

  test("the portal offers the catalog and takes a chef request", async ({ page, admin, scratch }) => {
    const c = await catalog(scratch);
    const { reservation } = await scratch.guestStay("concierge");
    const id = reservation.id;
    await openGuestPortal(page, admin, id);
    const panel = page.locator("details").filter({ has: page.locator('[role="tablist"]') }).first();
    await panel.locator("summary").click();
    const tabs = panel.getByRole("tab");
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);
    // each tab lists what the back-office holds: find the chef offer
    let row = panel.locator("li").filter({ hasText: c.chef.name });
    for (let i = 0; i < (await tabs.count()) && !(await row.count()); i++) await tabs.nth(i).click();
    await expect(row).toBeVisible();
    await expect(row).toContainText("150");
    await row.getByRole("button").first().click();
    await page.locator(`#cg-date-${id}`).fill(addDays(reservation.startDate, 1));
    await page.locator(`#cg-guests-${id}`).fill("6");
    await page.locator(`#cg-notes-${id}`).fill("E2E: a birthday");
    const sent = page.waitForResponse((r) => r.url().includes(`/reservations/${id}/concierge`) && r.request().method() === "POST");
    await page.locator(`#cg-notes-${id}`).locator("xpath=following::button[1]").click();
    expect((await sent).status()).toBe(200);
    await expect(page.locator(`#concierge-requests-${id}`)).toContainText(c.chef.name);
    const inbox = await openRequests(admin, id);
    expect(inbox[0]).toMatchObject({ category: "chef", guests: 6, serviceDate: addDays(reservation.startDate, 1) });
  });
});

test.describe("concierge: back-office", () => {
  test("catalog records are created, edited and removed; duplicates and bad input refused", async ({ admin, visitor, scratch }) => {
    const partner = await scratch.concierge("partners", { kind: "activity", name: marked("Outfitter"), email: "e2e-outfitter@example.com" });
    const dup = await admin.post("/api/admin/concierge/partners", { kind: "activity", name: partner.name });
    expect(dup.status).toBe(400);
    expect(dup.body.error).toBe("duplicate");

    const taxi = await scratch.concierge("taxis", { name: marked("Taxi"), phone: "+590 690 00 00 03", zone: "Gustavia" });
    expect(taxi.phone, "numbers are stored dialable").toBe("+590690000003");
    const put = await admin.put(`/api/admin/concierge/taxis/${taxi.id}`, { name: taxi.name, phone: "+590 690 00 00 04", zone: "St Jean" });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    const listed = ((await admin.get("/api/admin/concierge/taxis")).body.items as any[]).find((t) => t.id === taxi.id);
    expect(listed).toMatchObject({ phone: "+590690000004", zone: "St Jean" });

    expect((await admin.post("/api/admin/concierge/boats", { name: "" })).status).toBe(400);
    expect((await admin.post("/api/admin/concierge/chef-offers", { name: "x", category: "picnic" })).status).toBe(400);
    expect((await admin.get("/api/admin/concierge/spaceships")).status).toBe(404);
    expect((await visitor.get("/api/admin/concierge/taxis")).status).toBe(401);
    expect((await visitor.get("/api/admin/concierge-requests")).status).toBe(401);

    expect((await admin.del(`/api/admin/concierge/taxis/${taxi.id}`)).status).toBe(200);
    expect(((await admin.get("/api/admin/concierge/taxis")).body.items as any[]).some((t) => t.id === taxi.id)).toBe(false);
  });

  test("the concierge screens open with the catalog and the inbox", async ({ browser, admin, scratch }) => {
    const c = await catalog(scratch);
    const { reservation } = await scratch.guestStay("concierge");
    const guest = await guestApi(admin, reservation.id);
    expect((await guest.post(`/api/account/reservations/${reservation.id}/concierge`, { type: "boat", id: c.boat.id, outing: "half_day", date: reservation.startDate, guests: 4 })).status).toBe(200);
    await guest.dispose();

    const context = await adminContext(browser);
    const page = await context.newPage();
    await page.goto("/admin/concierge-requests");
    await expect(page.locator("main")).toContainText(c.boat.name);
    await page.goto("/admin/concierge");
    await expect(page.locator("main h1")).toBeVisible();
    await context.close();
  });
});
