import { test, expect, emailLogs, guestApi, openGuestPortal, requireWrites, testEmail } from "../support/fixtures";
import { updateReservation } from "../support/contracts";
import { horizontalOverflow, PHONE } from "../support/pages";

/**
 * Getting into the guest portal (the link the owner sends, the emailed
 * magic link) and what a signed-in guest may and may not reach.
 */
test.describe("guest portal: access", () => {
  test("a visitor who is not signed in gets the sign-in form, in both languages", async ({ page }) => {
    await page.goto("/account");
    await expect(page.locator("#g-email")).toBeVisible();
    await expect(page.locator('form[action*="/api/account/logout"]')).toHaveCount(0);
    await page.goto("/fr/account");
    await expect(page.locator("#g-email")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("the guest APIs answer nothing to a visitor who is not signed in", async ({ visitor }) => {
    expect((await visitor.post("/api/account/reservations/1/details", { arrivalFlight: "X" })).status).toBe(404);
    expect((await visitor.post("/api/account/reservations/1/date-change", { startDate: "2030-01-01", endDate: "2030-01-08" })).status).toBe(404);
    expect((await visitor.get("/api/account/wifi")).status).toBe(404);
    expect([401, 403, 404]).toContain((await visitor.post("/api/account/reservations/1/extras", { extraId: 1 })).status);
    expect([401, 403, 404]).toContain((await visitor.post("/api/account/reservations/1/concierge", { type: "chef" })).status);
  });

  test("a wrong or made-up link does not sign anyone in", async ({ page }) => {
    await page.goto("/api/account/login?pt=not-a-real-token");
    await expect(page).toHaveURL(/\/account\?error=link/);
    await expect(page.locator("#g-email")).toBeVisible();
    await page.goto("/api/account/login?token=not-a-real-token&locale=fr");
    await expect(page).toHaveURL(/\/fr\/account\?error=link/);
    await expect(page.locator("#g-email")).toBeVisible();
  });

  test("the owner's link opens the portal on the guest's stay", async ({ page, admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("portal");
    await openGuestPortal(page, admin, reservation.id);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toContainText("E2E");
    await expect(main).toContainText(client.email);
    await expect(main).toContainText(client.fullName);
    // the stay: its dates, size and price
    const year = reservation.startDate.slice(0, 4);
    await expect(main).toContainText(year);
    await expect(main).toContainText("7 nights");
    await expect(main).toContainText("$" + Math.round(reservation.priceTTC).toLocaleString("en-US"));
    // what the guest can do from here
    await expect(page.locator(`#arrivalFlight-${reservation.id}`)).toBeAttached();
    await expect(page.locator('form[action*="/api/account/logout"]')).toBeVisible();
    // far from the stay, the Wi-Fi and safe are not shown yet
    await expect(page.locator("#stay-info")).toHaveCount(0);
  });

  test("the portal in French", async ({ page, admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal", {}, { language: "fr" });
    await openGuestPortal(page, admin, reservation.id, "fr");
    await expect(page).toHaveURL(/\/fr\/account/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("main")).toContainText("7 nuits");
    await expect(page.locator('form[action="/api/account/logout?locale=fr"]')).toBeVisible();
  });

  test("the portal fits a phone screen", async ({ browser, admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal");
    const context = await browser.newContext({ ...PHONE });
    const page = await context.newPage();
    await openGuestPortal(page, admin, reservation.id);
    await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await context.close();
  });

  test("signing out closes the session", async ({ page, admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal");
    await openGuestPortal(page, admin, reservation.id);
    await page.locator('form[action*="/api/account/logout"] button').click();
    await expect(page.locator("#g-email")).toBeVisible();
    await page.goto("/account");
    await expect(page.locator("#g-email")).toBeVisible();
    const res = await page.request.post(`/api/account/reservations/${reservation.id}/details`, { data: { arrivalFlight: "X" } });
    expect(res.status()).toBe(404);
  });

  test("a guest cannot read or change another guest's stay", async ({ admin, scratch }) => {
    const mine = await scratch.guestStay("portal");
    const theirs = await scratch.guestStay("portal");
    const guest = await guestApi(admin, mine.reservation.id);
    const other = theirs.reservation.id;
    expect((await guest.post(`/api/account/reservations/${other}/details`, { arrivalFlight: "HACK 1" })).status).toBe(404);
    expect((await guest.post(`/api/account/reservations/${other}/date-change`, { startDate: "2031-01-01", endDate: "2031-01-08", preview: true })).status).toBe(404);
    expect((await guest.del(`/api/account/reservations/${other}/date-change`)).status).toBe(404);
    expect([403, 404]).toContain((await guest.post(`/api/account/reservations/${other}/concierge`, { type: "chef", date: theirs.reservation.startDate, guests: 2 })).status);
    const untouched = (await admin.get(`/api/admin/reservations/${other}`)).body.reservation;
    expect(untouched.guestDetails.arrivalFlight).toBeNull();
    // and their own stay answers
    expect((await guest.post(`/api/account/reservations/${mine.reservation.id}/details`, { arrivalFlight: "PV 2211" })).status).toBe(200);
    await guest.dispose();
  });

  test("a cancelled stay can no longer be changed from the portal", async ({ admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal");
    const guest = await guestApi(admin, reservation.id);
    const cancel = await updateReservation(admin, reservation.id, { status: "cancelled" });
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
    expect((await guest.post(`/api/account/reservations/${reservation.id}/details`, { arrivalFlight: "PV 1" })).status).toBe(404);
    await guest.dispose();
  });
});

test.describe("guest portal: emailed sign-in link", () => {
  test("the answer is the same for a known and an unknown address, and only the known one gets a mail", async ({ admin, visitor, scratch }) => {
    const client = await scratch.client();
    const stranger = testEmail();
    const unknown = await visitor.post("/api/account/magic-link", { email: stranger, locale: "en" });
    const known = await visitor.post("/api/account/magic-link", { email: client.email.toUpperCase(), locale: "en" });
    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(unknown.body.success).toBe(true);
    expect(known.body.success).toBe(true);
    const logs = await emailLogs(admin);
    expect(logs.some((l) => l.recipientEmail === stranger)).toBe(false);
    expect(logs.some((l) => l.templateSlug === "guest_magic_link" && l.recipientEmail === client.email)).toBe(true);
    expect((await visitor.post("/api/account/magic-link", { email: "not-an-email" })).status).toBe(400);
  });

  test("the emailed link signs the guest in once, then stops working", async ({ page, admin, visitor, scratch, browser }) => {
    const { client } = await scratch.guestStay("portal");
    expect((await visitor.post("/api/account/magic-link", { email: client.email, locale: "en" })).status).toBe(200);
    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "guest_magic_link" && l.recipientEmail === client.email);
    expect(mail, "sign-in email").toBeTruthy();
    const token = /login\?token=([A-Za-z0-9_-]+)/.exec(mail!.body ?? "")?.[1];
    expect(token, "the email carries the sign-in link").toBeTruthy();

    await page.request.get(`/api/account/login?token=${token}`, { maxRedirects: 0 });
    await page.goto("/account");
    await expect(page.locator("main")).toContainText(client.email);

    // someone who finds the link later gets nothing
    const context = await browser.newContext();
    const second = await context.newPage();
    await second.request.get(`/api/account/login?token=${token}`, { maxRedirects: 0 });
    await second.goto("/account");
    await expect(second.locator("#g-email")).toBeVisible();
    await context.close();
  });

  test("the sign-in form confirms the send", async ({ page }) => {
    requireWrites();
    await page.goto("/account");
    await page.locator("#g-email").fill(testEmail());
    const answer = page.waitForResponse((r) => r.url().includes("/api/account/magic-link"));
    await page.locator("#g-email").press("Enter");
    expect((await answer).status()).toBe(200);
    await expect(page.locator("#g-email")).toHaveCount(0);
    await expect(page.locator("main")).toContainText("✓");
  });
});
