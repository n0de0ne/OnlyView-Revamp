import type { Page } from "@playwright/test";
import {
  test, expect, addDays, emailLogs, laneWindow, marked, requireWrites, skipIfRateLimited, testEmail, today, uniq, type Api,
} from "../support/fixtures";
import { PHONE } from "../support/pages";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** Requests sent by these tests are removed from the back-office inbox afterwards. */
async function removeRequests(admin: Api, email: string) {
  const all = (await admin.get("/api/admin/requests")).body.requests as any[];
  for (const r of all.filter((x) => x.email === email)) await admin.del(`/api/admin/requests/${r.id}`);
}
const findRequest = async (admin: Api, email: string) =>
  ((await admin.get("/api/admin/requests")).body.requests as any[]).find((r) => r.email === email);

/** Move the availability calendar to the month of a day (it opens on the current month). */
async function showMonth(page: Page, day: string) {
  const now = new Date();
  const [y, m] = day.split("-").map(Number);
  const clicks = (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
  const next = page.getByRole("button", { name: "Next month" }).first();
  for (let i = 0; i < clicks; i++) await next.click();
}

async function submitRequest(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/booking-request")),
    page.locator('form:has(#bk-name) button[type="submit"]').click(),
  ]);
  skipIfRateLimited(response.status(), "booking request");
  return response;
}

test.describe("booking request", () => {
  test("a visitor picks dates, reads the quote and sends a request the owner receives", async ({ page, admin, visitor }) => {
    requireWrites();
    const id = uniq();
    const guest = { name: marked("Booker", id), email: testEmail(id) };
    const { startDate, endDate } = laneWindow("booking-ui", 0);
    const expected = (await visitor.post("/api/quote", { startDate, endDate, bedrooms: 3 })).body;
    test.skip(!expected.available, `${startDate} → ${endDate} is taken on this environment`);

    await page.goto("/booking");
    await page.locator("#bk-start").fill(startDate);
    await page.locator("#bk-end").fill(endDate);
    await page.locator("#bk-bed").selectOption("3");
    // two guests per bedroom: the party size follows the bedrooms
    await expect(page.locator("#bk-guests option")).toHaveCount(6);
    await page.locator("#bk-guests").selectOption("5");

    // the quote on screen is the engine's, to the dollar
    const quote = page.locator("main", { hasText: usd(expected.quote.totalTTC) });
    await expect(quote).toBeVisible();
    await expect(page.locator("main")).toContainText(usd(expected.quote.depositAmount));
    await expect(page.locator("main")).toContainText(`7 nights`);
    await expect(page.locator("main")).toContainText("✓");

    await page.locator("#bk-name").fill(guest.name);
    await page.locator("#bk-email").fill(guest.email);
    await page.locator("#bk-phone").fill("+33 6 00 00 00 00");
    await page.locator("#bk-msg").fill("Automated test request: please ignore.");
    try {
      const response = await submitRequest(page);
      expect(response.status()).toBe(200);
      // the form gives way to the confirmation
      await expect(page.locator("#bk-name")).toHaveCount(0);
      await expect(page.locator("main h2")).toHaveCount(1);

      const request = await findRequest(admin, guest.email);
      expect(request, "request in the back-office inbox").toBeTruthy();
      expect(request).toMatchObject({
        name: guest.name, startDate, endDate, bedrooms: 3, guests: 5, status: "new", language: "en", phone: "+33 6 00 00 00 00",
      });
      // the price the guest saw is kept with the request
      expect(Math.round(request.quote.totalTTC)).toBe(Math.round(expected.quote.totalTTC));

      const logs = await emailLogs(admin);
      const alert = logs.find((l) => l.templateSlug === "admin_booking_request" && l.subject?.includes(guest.name));
      expect(alert, "owner alert").toBeTruthy();
      expect(alert!.body).toContain(startDate);
      expect(logs.find((l) => l.templateSlug === "booking_request_ack" && l.recipientEmail === guest.email), "acknowledgement to the guest").toBeTruthy();

      // a request is not a booking: the dates stay open
      expect((await visitor.post("/api/quote", { startDate, endDate, bedrooms: 3 })).body.available).toBe(true);
    } finally {
      await removeRequests(admin, guest.email);
    }
  });

  test("dates can be picked on the calendar itself", async ({ page }) => {
    const { startDate, endDate } = laneWindow("booking-ui", 1);
    await page.goto("/booking");
    await showMonth(page, startDate);
    await page.getByRole("button", { name: startDate, exact: true }).first().click();
    await expect(page.locator("#bk-start")).toHaveValue(startDate);
    if (endDate.slice(0, 7) !== startDate.slice(0, 7)) {
      // the second month is shown next to the first on a wide screen
      await expect(page.getByRole("button", { name: endDate, exact: true }).first()).toBeVisible();
    }
    await page.getByRole("button", { name: endDate, exact: true }).first().click();
    await expect(page.locator("#bk-end")).toHaveValue(endDate);
    await expect(page.locator("main")).toContainText("7 nights");
    // past days cannot be picked
    await page.goto("/booking");
    await expect(page.getByRole("button", { name: addDays(today(), -1), exact: true }).first()).toBeDisabled();
  });

  test("booked nights are closed on the calendar and the quote says so", async ({ page, scratch }) => {
    const stay = await scratch.reservation("booking-ui", {}, { fromSlot: 3 });
    await page.goto("/booking");
    await showMonth(page, stay.startDate);
    await expect(page.getByRole("button", { name: stay.startDate, exact: true }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: addDays(stay.startDate, 3), exact: true }).first()).toBeDisabled();
    // the checkout day is open for the next arrival
    await expect(page.getByRole("button", { name: stay.endDate, exact: true }).first()).toBeEnabled();

    await page.locator("#bk-start").fill(addDays(stay.startDate, 2));
    await page.locator("#bk-end").fill(addDays(stay.endDate, 2));
    const quote = page.waitForResponse((r) => r.url().endsWith("/api/quote"));
    expect((await (await quote).json()).available).toBe(false);
    await expect(page.locator("main")).not.toContainText("✓ ");
  });

  test("a stay under the minimum is flagged before the request is sent", async ({ page }) => {
    const { startDate } = laneWindow("booking-ui", 1);
    await page.goto("/booking");
    await page.locator("#bk-start").fill(startDate);
    const quote = page.waitForResponse((r) => r.url().endsWith("/api/quote") && r.request().postDataJSON().endDate === addDays(startDate, 1));
    await page.locator("#bk-end").fill(addDays(startDate, 1));
    const body = await (await quote).json();
    expect(body.quote.minStayOk).toBe(false);
    await expect(page.locator("main")).toContainText(String(body.quote.minStayRequired));
    await expect(page.locator("main")).toContainText(/minimum/i);
  });

  test("the French page sends a French request", async ({ page, admin }) => {
    requireWrites();
    const id = uniq();
    const guest = { name: marked("Booker FR", id), email: testEmail(id) };
    const { startDate, endDate } = laneWindow("booking-ui", 2);
    await page.goto("/fr/booking");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await page.locator("#bk-start").fill(startDate);
    await page.locator("#bk-end").fill(endDate);
    await expect(page.locator("main")).toContainText("7 nuits");
    await page.locator("#bk-name").fill(guest.name);
    await page.locator("#bk-email").fill(guest.email);
    try {
      const response = await submitRequest(page);
      expect(response.status()).toBe(200);
      const request = await findRequest(admin, guest.email);
      expect(request.language).toBe("fr");
      const ack = (await emailLogs(admin)).find((l) => l.templateSlug === "booking_request_ack" && l.recipientEmail === guest.email);
      expect(ack, "acknowledgement").toBeTruthy();
      expect(ack!.body, "written in French").toMatch(/demande|séjour|bientôt/i);
    } finally {
      await removeRequests(admin, guest.email);
    }
  });

  test("the server refuses what the form would not let through", async ({ visitor, admin }) => {
    requireWrites();
    const { startDate, endDate } = laneWindow("booking-ui", 2);
    const email = testEmail();
    const ok = { startDate, endDate, bedrooms: 4, guests: 8, name: marked("Booker"), email, locale: "en" };
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...ok, bedrooms: 2, guests: 6 }, "too_many_guests"],
      [{ ...ok, startDate: addDays(today(), -3), endDate: addDays(today(), 4) }, "invalid_dates"],
      [{ ...ok, startDate: addDays(today(), 800), endDate: addDays(today(), 807) }, "invalid_dates"],
      [{ ...ok, endDate: addDays(startDate, 61) }, "invalid_dates"],
      [{ ...ok, startDate: "2031-02-30" }, "invalid_input"],
      [{ ...ok, email: "not-an-email" }, "invalid_input"],
      [{ ...ok, website: "http://spam.example" }, "invalid_input"],
      [{ ...ok, name: "E2E\r\nBcc: someone@example.com" }, "invalid_input"],
    ];
    try {
      for (const [body, error] of cases) {
        const res = await visitor.post("/api/booking-request", body);
        skipIfRateLimited(res.status, "booking request");
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error, JSON.stringify(body)).toBe(error);
      }
      expect(await findRequest(admin, email), "nothing was recorded").toBeUndefined();
    } finally {
      await removeRequests(admin, email);
    }
  });
});

test.describe("booking request on a phone", () => {
  test.use(PHONE);

  test("the quote and the form open in a sheet from the bottom bar", async ({ page, admin, visitor }) => {
    requireWrites();
    const id = uniq();
    const guest = { name: marked("Booker Phone", id), email: testEmail(id) };
    const { startDate, endDate } = laneWindow("booking-ui", 5);
    test.skip(!(await visitor.post("/api/quote", { startDate, endDate, bedrooms: 4 })).body.available, "dates taken on this environment");

    await page.goto("/booking");
    const bar = page.locator("main div.fixed.bottom-0").last();
    const open = bar.locator("button");
    await expect(open).toBeDisabled();

    await showMonth(page, startDate);
    await page.getByRole("button", { name: startDate, exact: true }).first().tap();
    if (endDate.slice(0, 7) !== startDate.slice(0, 7)) await page.getByRole("button", { name: "Next month" }).first().tap();
    await page.getByRole("button", { name: endDate, exact: true }).first().tap();
    // the bar sums the stay up and unlocks the request
    await expect(bar).toContainText(/\$\d/);
    await expect(open).toBeEnabled();
    await open.tap();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(/\$\d{1,3},\d{3}/);
    await sheet.locator("#bk-name").fill(guest.name);
    await sheet.locator("#bk-email").fill(guest.email);
    try {
      const response = await submitRequest(page);
      expect(response.status()).toBe(200);
      const request = await findRequest(admin, guest.email);
      expect(request).toMatchObject({ startDate, endDate, bedrooms: 4, guests: 8 });
    } finally {
      await removeRequests(admin, guest.email);
    }
  });
});
