import { test, expect, addDays, today, BASE_URL, emailLogs } from "../support/fixtures";

/**
 * The few checks worth running first on any deploy: the site answers, the
 * database is reachable both ways, the back-office opens, and the server
 * knows its own address. A couple of minutes at most.
 */
test.describe("smoke", () => {
  test("the home page renders in English and in French", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ONLY VIEW/i);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/fr");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("availability and quote APIs answer", async ({ visitor }) => {
    const availability = await visitor.get("/api/availability");
    expect(availability.status).toBe(200);
    expect(Array.isArray(availability.body.bookings)).toBe(true);

    const startDate = addDays(today(), 500);
    const quote = await visitor.post("/api/quote", { startDate, endDate: addDays(startDate, 7), bedrooms: 4 });
    expect(quote.status).toBe(200);
    expect(quote.body.quote.nights).toBe(7);
    expect(quote.body.quote.totalTTC).toBeGreaterThan(0);
  });

  test("the back-office is closed to visitors", async ({ page, visitor }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(page.getByLabel("Mot de passe")).toBeVisible();

    const api = await visitor.get("/api/admin/reservations");
    expect(api.status).toBe(401);
  });

  test("the back-office answers once signed in", async ({ admin }) => {
    const stats = await admin.get("/api/admin/stats");
    expect(stats.status).toBe(200);
    expect(stats.body.months).toHaveLength(12);
  });

  test("the database takes a write and gives it back", async ({ admin, scratch }) => {
    const client = await scratch.client();
    const read = await admin.get(`/api/admin/clients/${client.id}`);
    expect(read.status).toBe(200);
    expect(read.body.client.email).toBe(client.email);
  });

  test("links the server hands out point at this environment", async ({ admin, scratch }) => {
    // emails, contract links and portal links are built from SITE_URL: on a
    // staging copy still carrying the live address they would send guests to production
    const { reservation } = await scratch.guestStay("smoke");
    const link = await admin.post(`/api/admin/reservations/${reservation.id}/actions`, { action: "portal-link" });
    expect(link.status).toBe(200);
    expect(
      new URL(link.body.portalUrl).origin,
      "SITE_URL of the server is not the address under test: set SITE_URL on this environment"
    ).toBe(new URL(BASE_URL).origin);
  });

  test("emails are recorded", async ({ admin }, testInfo) => {
    const logs = await emailLogs(admin, 5);
    // informative: "queued" = no SMTP on this server (nothing leaves), "sent" = real mail goes out
    testInfo.annotations.push({ type: "mail", description: logs[0] ? `last email was "${logs[0].status}"` : "no email logged yet" });
    expect(Array.isArray(logs)).toBe(true);
  });
});
