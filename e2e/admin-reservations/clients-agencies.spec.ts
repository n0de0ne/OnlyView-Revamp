import { test, expect, marked, testEmail, uniq } from "../support/fixtures";

const near = (a: number, b: number, tolerance = 1) => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThanOrEqual(tolerance);

test.describe("clients", () => {
  test("a client record is created, found by search, edited field by field and removed", async ({ admin, scratch }) => {
    const client = await scratch.client({ phone: "+1 212 555 0100", country: "United States", isVip: true, discountPercent: 5, language: "fr", notes: "E2E note" });
    const found = ((await admin.get(`/api/admin/clients?q=${encodeURIComponent(client.lastname)}`)).body.clients as any[]).find((c) => c.id === client.id);
    expect(found).toMatchObject({ email: client.email, isVip: true, language: "fr" });
    const byEmail = (await admin.get(`/api/admin/clients?q=${encodeURIComponent(client.email)}`)).body.clients as any[];
    expect(byEmail.some((c) => c.id === client.id)).toBe(true);

    // editing one field leaves the others as they were
    const put = await admin.put(`/api/admin/clients/${client.id}`, { phone: "+1 212 555 0199" });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    const after = (await admin.get(`/api/admin/clients/${client.id}`)).body.client;
    expect(after).toMatchObject({ phone: "+1 212 555 0199", isVip: true, discountPercent: 5, language: "fr", notes: "E2E note", country: "United States" });

    expect((await admin.del(`/api/admin/clients/${client.id}`)).status).toBe(200);
    expect((await admin.get(`/api/admin/clients/${client.id}`)).status).toBe(404);
  });

  test("two clients cannot share an email; bad input is refused", async ({ admin, scratch }) => {
    const client = await scratch.client();
    const dup = await admin.post("/api/admin/clients", { firstname: "E2E", lastname: `Twin ${uniq()}`, email: client.email.toUpperCase() });
    if (dup.status === 200) scratch.track(() => admin.del(`/api/admin/clients/${dup.body.client.id}`));
    expect(dup.status).toBeGreaterThanOrEqual(400);
    const other = await scratch.client();
    expect((await admin.put(`/api/admin/clients/${other.id}`, { email: client.email })).status).toBe(409);
    expect((await admin.post("/api/admin/clients", { firstname: "", lastname: "x" })).status).toBe(400);
    expect((await admin.post("/api/admin/clients", { firstname: "E2E", lastname: "x", email: "not-an-email" })).status).toBe(400);
    expect((await admin.post("/api/admin/clients", { firstname: "E2E", lastname: "x", discountPercent: 101 })).status).toBe(400);
  });

  test("a client's record sums up their stays", async ({ admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("admin-clients");
    const cancelled = await scratch.reservation("admin-clients", { clientId: client.id, clientName: client.fullName, status: "cancelled" });
    expect(cancelled.status).toBe("cancelled");
    const row = ((await admin.get(`/api/admin/clients?q=${encodeURIComponent(client.email)}`)).body.clients as any[]).find((c) => c.id === client.id);
    expect(row.stats.stays, "a cancelled stay is not a stay").toBe(1);
    expect(row.stats.nights).toBe(7);
    near(row.stats.spent, reservation.priceHT);
    const detail = (await admin.get(`/api/admin/clients/${client.id}`)).body;
    expect(JSON.stringify(detail)).toContain(reservation.startDate);
  });

  test("the clients screen finds a client by name", async ({ page, scratch }) => {
    const client = await scratch.client();
    await page.goto("/admin/clients");
    await page.locator('main input[type="search"], main input[placeholder]').first().fill(client.lastname);
    await expect(page.locator("main")).toContainText(client.lastname);
    await expect(page.locator("main")).toContainText(client.email);
  });
});

test.describe("agencies", () => {
  test("an agency is created, edited without losing its commission, paused and removed", async ({ admin, scratch }) => {
    const agency = await scratch.agency({ commissionPercent: 18, contactName: "E2E Marie", email: testEmail() });
    expect(agency.commissionPercent).toBe(18);
    const put = await admin.put(`/api/admin/agencies/${agency.id}`, { contactName: "E2E Paul" });
    expect(put.status).toBe(200);
    expect(put.body.agency).toMatchObject({ contactName: "E2E Paul", commissionPercent: 18, isActive: true });
    expect((await admin.put(`/api/admin/agencies/${agency.id}`, { isActive: false })).body.agency).toMatchObject({ isActive: false, commissionPercent: 18 });

    expect((await admin.post("/api/admin/agencies", { name: "" })).status).toBe(400);
    expect((await admin.post("/api/admin/agencies", { name: marked("Agency"), commissionPercent: 120 })).status).toBe(400);
    expect((await admin.put("/api/admin/agencies/99999999", { name: "x" })).status).toBe(404);

    expect((await admin.del(`/api/admin/agencies/${agency.id}`)).status).toBe(200);
    expect(((await admin.get("/api/admin/agencies")).body.agencies as any[]).some((a) => a.id === agency.id)).toBe(false);
  });

  test("the agencies screen lists an agency with its commission", async ({ page, scratch }) => {
    const agency = await scratch.agency({ commissionPercent: 17 });
    await page.goto("/admin/agencies");
    const row = page.locator("main").locator("tr, li, article, div").filter({ hasText: agency.name }).last();
    await expect(row).toBeVisible();
    await expect(page.locator("main")).toContainText("17");
  });
});
