import { test, expect, addDays, adminContext, emailLogs, guestApi, marked, openGuestPortal } from "../support/fixtures";
import { reservationOf } from "../support/contracts";

/**
 * Extras: the catalog the owner keeps in the back-office, what guests can
 * ask for from the portal, and the lines the owner adds to a stay.
 */
test.describe("extras: the guest asks from the portal", () => {
  test("request an extra in the portal, the owner confirms it", async ({ page, admin, scratch }) => {
    const extra = await scratch.extra({ price: 40 });
    const { reservation } = await scratch.guestStay("extras");
    const id = reservation.id;
    await openGuestPortal(page, admin, id);

    const panel = page.locator("details").filter({ has: page.locator('[role="tablist"]') }).filter({ hasText: extra.nameEn });
    await panel.locator("summary").click();
    const tab = panel.getByRole("tab", { name: "E2E tests" });
    if (await tab.count()) await tab.click();
    const row = panel.locator("li").filter({ hasText: extra.nameEn });
    await expect(row).toContainText("40");
    await row.getByRole("button").click();
    await page.locator(`#q-${extra.id}-${id}`).fill("2");
    await page.locator(`#serviceDate-${extra.id}-${id}`).fill(addDays(reservation.startDate, 1));
    await page.locator(`#n-${extra.id}-${id}`).fill("E2E: by the pool please");
    const sent = page.waitForResponse((r) => r.url().includes(`/reservations/${id}/extras`) && r.request().method() === "POST");
    await row.locator("button.btn-gold").click();
    expect((await sent).status()).toBe(200);
    // the form closes and the request is listed for the guest
    await expect(page.locator(`#n-${extra.id}-${id}`)).toHaveCount(0);

    let stay = await reservationOf(admin, id);
    const line = stay.extras.find((x: any) => x.extraId === extra.id);
    expect(line).toMatchObject({ status: "requested", quantity: 2, unitPrice: 40, amount: 80, serviceDate: addDays(reservation.startDate, 1), notes: "E2E: by the pool please" });
    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "admin_guest_update" && l.reservationId === id);
    expect(mail?.subject, "the owner is told").toContain(extra.nameEn);

    const confirmed = await admin.put(`/api/admin/reservations/${id}/extras/${line.id}`, { status: "confirmed" });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.item).toMatchObject({ status: "confirmed", amount: 80 });
    stay = await reservationOf(admin, id);
    expect(stay.extras.find((x: any) => x.id === line.id).status).toBe("confirmed");
    // a confirmed extra is no longer the guest's to remove
    const res = await page.request.delete(`/api/account/reservations/${id}/extras/${line.id}`);
    expect(res.status()).toBe(403);
  });

  test("the guest can withdraw a request the owner has not answered", async ({ admin, scratch }) => {
    const extra = await scratch.extra();
    const { reservation } = await scratch.guestStay("extras");
    const guest = await guestApi(admin, reservation.id);
    const asked = await guest.post(`/api/account/reservations/${reservation.id}/extras`, { extraId: extra.id, quantity: 1 });
    expect(asked.status, JSON.stringify(asked.body)).toBe(200);
    expect((await guest.del(`/api/account/reservations/${reservation.id}/extras/${asked.body.item.id}`)).status).toBe(200);
    expect((await reservationOf(admin, reservation.id)).extras).toHaveLength(0);
    await guest.dispose();
  });

  test("a rental by the day is priced on its number of days", async ({ admin, scratch }) => {
    const extra = await scratch.extra({ price: 25, unit: "night" });
    const { reservation } = await scratch.guestStay("extras");
    const guest = await guestApi(admin, reservation.id);
    const url = `/api/account/reservations/${reservation.id}/extras`;
    const start = reservation.startDate;
    const asked = await guest.post(url, { extraId: extra.id, quantity: 2, serviceDate: start, serviceEndDate: addDays(start, 2) });
    expect(asked.status, JSON.stringify(asked.body)).toBe(200);
    const days = asked.body.item.days;
    expect(days).toBeGreaterThanOrEqual(2);
    expect(asked.body.item.amount).toBe(2 * 25 * days);
    const backwards = await guest.post(url, { extraId: extra.id, serviceDate: addDays(start, 3), serviceEndDate: start });
    expect(backwards.status).toBe(400);
    expect(backwards.body.error).toBe("invalid_dates");
    await guest.dispose();
  });

  test("extras that are switched off or kept for the owner cannot be asked for", async ({ page, admin, scratch }) => {
    const off = await scratch.extra({ isActive: false });
    const ownerOnly = await scratch.extra({ guestBookable: false });
    const { reservation } = await scratch.guestStay("extras");
    const guest = await guestApi(admin, reservation.id);
    const url = `/api/account/reservations/${reservation.id}/extras`;
    expect((await guest.post(url, { extraId: off.id })).status).toBe(404);
    expect((await guest.post(url, { extraId: ownerOnly.id })).status).toBe(404);
    expect((await guest.post(url, { extraId: 99999999 })).status).toBe(404);
    expect((await guest.post(url, { extraId: off.id, quantity: 0 })).status).toBe(400);
    await guest.dispose();
    await openGuestPortal(page, admin, reservation.id);
    await expect(page.locator("main")).not.toContainText(off.nameEn);
    await expect(page.locator("main")).not.toContainText(ownerOnly.nameEn);
  });
});

test.describe("extras: back-office", () => {
  test("catalog: create, edit, switch off, delete", async ({ admin, visitor, scratch }) => {
    const extra = await scratch.extra({ price: 60, descriptionEn: "E2E description" });
    const listed = ((await admin.get("/api/admin/extras")).body.extras as any[]).find((x) => x.id === extra.id);
    expect(listed).toMatchObject({ nameEn: extra.nameEn, price: 60, isActive: true, guestBookable: true });

    const renamed = marked("Extra renamed");
    const put = await admin.put(`/api/admin/extras/${extra.id}`, { nameEn: renamed, nameFr: renamed, price: 75, unit: "stay", isActive: false });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    const after = ((await admin.get("/api/admin/extras")).body.extras as any[]).find((x) => x.id === extra.id);
    expect(after).toMatchObject({ nameEn: renamed, price: 75, isActive: false });

    expect((await admin.post("/api/admin/extras", { nameEn: "", nameFr: "" })).status).toBe(400);
    expect((await admin.post("/api/admin/extras", { nameEn: "x", nameFr: "x", price: -5 })).status).toBe(400);
    expect((await visitor.get("/api/admin/extras")).status).toBe(401);
    expect((await visitor.post("/api/admin/extras", { nameEn: "x", nameFr: "x" })).status).toBe(401);

    expect((await admin.del(`/api/admin/extras/${extra.id}`)).status).toBe(200);
    expect(((await admin.get("/api/admin/extras")).body.extras as any[]).some((x) => x.id === extra.id)).toBe(false);
  });

  test("the owner adds, edits and removes lines on a stay; they never change the rent", async ({ admin, scratch }) => {
    const { reservation } = await scratch.guestStay("extras");
    const url = `/api/admin/reservations/${reservation.id}/extras`;
    const added = await admin.post(url, { label: "E2E airport transfer", quantity: 2, unitPrice: 90 });
    expect(added.status, JSON.stringify(added.body)).toBe(200);
    expect(added.body.item).toMatchObject({ label: "E2E airport transfer", amount: 180, status: "confirmed" });
    const item = added.body.item;

    const edited = await admin.put(`${url}/${item.id}`, { quantity: 3 });
    expect(edited.body.item.amount).toBe(270);
    const cancelled = await admin.put(`${url}/${item.id}`, { status: "cancelled" });
    expect(cancelled.body.item).toMatchObject({ status: "cancelled", amount: 270 });

    const stay = await reservationOf(admin, reservation.id);
    expect(stay.priceTTC, "rent untouched").toBe(reservation.priceTTC);
    expect(stay.extras).toHaveLength(1);

    expect((await admin.put(`${url}/99999999`, { quantity: 1 })).status).toBe(404);
    expect((await admin.post(url, { label: "", quantity: 1 })).status).toBe(400);
    expect((await admin.del(`${url}/${item.id}`)).status).toBe(200);
    expect((await reservationOf(admin, reservation.id)).extras).toHaveLength(0);
  });

  test("the extras screen lists the catalog", async ({ browser, scratch }) => {
    const extra = await scratch.extra();
    const context = await adminContext(browser);
    const page = await context.newPage();
    await page.goto("/admin/extras");
    await expect(page.locator("main")).toContainText(extra.nameEn);
    await context.close();
  });
});
