import { test, expect, ADMIN_USER, laneWindow, marked, signInAs, testEmail, today, uniq } from "../support/fixtures";

/**
 * Three roles: a viewer reads, a manager runs the bookings and the content,
 * the owner alone sees the money, the settings and the accounts.
 */
test.describe("back-office: roles", () => {
  test("a viewer can read the bookings and change nothing", async ({ scratch }) => {
    const { reservation } = await scratch.guestStay("admin-roles");
    const account = await scratch.user("viewer");
    const viewer = await signInAs(account.username, account.password);

    for (const path of ["reservations", `reservations/${reservation.id}`, "clients", "agencies", "requests", "contracts", "extras", "map-places", "guides", "site-texts", "stats", "badges", "analytics", "promotions"]) {
      expect((await viewer.get(`/api/admin/${path}`)).status, `read ${path}`).toBe(200);
    }
    // money, mail, settings, accounts and the audit trail are not for a viewer
    for (const path of ["expenses", "settings", "users", "audit", "email-logs", "rate-periods", "reminders"]) {
      expect((await viewer.get(`/api/admin/${path}`)).status, `read ${path}`).toBe(403);
    }
    const window = laneWindow("admin-roles", 3);
    const writes: Array<[string, Promise<{ status: number }>]> = [
      ["create a stay", viewer.post("/api/admin/reservations", { status: "confirmed", bedrooms: 4, clientName: marked("Stay"), ...window })],
      ["change a stay", viewer.put(`/api/admin/reservations/${reservation.id}`, { status: "cancelled" })],
      ["delete a stay", viewer.del(`/api/admin/reservations/${reservation.id}`)],
      ["send a contract", viewer.post(`/api/admin/reservations/${reservation.id}/actions`, { action: "send-contract" })],
      ["create a client", viewer.post("/api/admin/clients", { firstname: "E2E", lastname: "Nope", email: testEmail() })],
      ["create an extra", viewer.post("/api/admin/extras", { nameEn: marked("Extra"), nameFr: marked("Extra") })],
      ["edit the site copy", viewer.put("/api/admin/site-texts", { locale: "en", texts: {} })],
      ["add a pin", viewer.post("/api/admin/map-places", { category: "beach", name: marked("Beach"), lat: 17.9, lng: -62.83 })],
      ["add an expense", viewer.post("/api/admin/expenses", { description: marked("Expense"), amount: 10, date: today() })],
      ["change the settings", viewer.put("/api/admin/settings", { settings: { tax_rate: "0" } })],
      ["create an account", viewer.post("/api/admin/users", { username: `e2e-${uniq()}`, email: testEmail(), password: "long-enough-pass-1", role: "owner" })],
    ];
    for (const [what, call] of writes) expect((await call).status, what).toBe(403);
    await viewer.dispose();
  });

  test("a manager runs bookings and content, without the money, the settings or the accounts", async ({ admin, scratch }) => {
    const account = await scratch.user("manager");
    const manager = await signInAs(account.username, account.password);

    // their work: a client, a stay, its contract, an extra
    const id = uniq();
    const client = await manager.post("/api/admin/clients", { firstname: "E2E", lastname: `Guest ${id}`, email: testEmail(id) });
    expect(client.status, JSON.stringify(client.body)).toBe(200);
    scratch.track(() => admin.del(`/api/admin/clients/${client.body.client.id}`));
    let stay: any = null;
    for (let slot = 0; slot < 5 && !stay; slot++) {
      const res = await manager.post("/api/admin/reservations", { status: "confirmed", bedrooms: 4, guests: 4, clientId: client.body.client.id, clientName: `E2E Guest ${id}`, ...laneWindow("admin-roles", slot) });
      if (res.status === 200) stay = res.body.reservation;
      else expect(res.status).toBe(409);
    }
    expect(stay, "a free week in the lane").toBeTruthy();
    scratch.track(() => admin.del(`/api/admin/reservations/${stay.id}`));
    expect((await manager.post(`/api/admin/reservations/${stay.id}/actions`, { action: "generate-contract" })).status).toBe(200);
    expect((await manager.get("/api/admin/email-logs")).status).toBe(200);
    expect((await manager.get("/api/admin/rate-periods")).status).toBe(200);

    // not theirs
    for (const path of ["expenses", "settings", "users", "audit", "reminders"]) {
      expect((await manager.get(`/api/admin/${path}`)).status, `read ${path}`).toBe(403);
    }
    expect((await manager.post("/api/admin/expenses", { description: marked("Expense"), amount: 10, date: today() })).status).toBe(403);
    expect((await manager.put("/api/admin/settings", { settings: { tax_rate: "0" } })).status).toBe(403);
    expect((await manager.post("/api/admin/rate-periods", { name: marked("Rate"), ...laneWindow("admin-roles", 4), weeklyRate: 1 })).status).toBe(403);
    expect((await manager.post("/api/admin/users", { username: `e2e-${uniq()}`, email: testEmail(), password: "long-enough-pass-1", role: "owner" })).status).toBe(403);
    expect((await manager.put(`/api/admin/users/${account.id}`, { role: "owner" })).status, "cannot promote themselves").toBe(403);
    // removing clients and agencies for good is the owner's call
    expect((await manager.del(`/api/admin/clients/${client.body.client.id}`)).status).toBe(403);
    await manager.dispose();
  });

  test("the menu shows each role only what it may open", async ({ browser, scratch }) => {
    const account = await scratch.user("viewer");
    const api = await signInAs(account.username, account.password);
    // skip the forced password change so the menu is reachable
    expect((await api.post("/api/admin/change-password", { currentPassword: account.password, newPassword: `${account.password}-2` })).status).toBe(200);
    const context = await browser.newContext({ storageState: await api.ctx.storageState() });
    await api.dispose();
    const page = await context.newPage();
    await page.goto("/admin");
    const nav = page.locator("aside nav").first();
    await expect(nav.locator('a[href="/admin/reservations"]')).toBeVisible();
    for (const hidden of ["/admin/finance", "/admin/settings", "/admin/users", "/admin/pricing"]) {
      await expect(nav.locator(`a[href="${hidden}"]`), hidden).toHaveCount(0);
    }
    await context.close();
  });
});

test.describe("back-office: accounts", () => {
  test("the owner creates, edits, deactivates and removes accounts", async ({ admin, scratch }) => {
    const account = await scratch.user("viewer");
    const listed = ((await admin.get("/api/admin/users")).body.users as any[]).find((u) => u.id === account.id);
    expect(listed).toMatchObject({ username: account.username, role: "viewer", isActive: true, mustChangePassword: true });
    expect(JSON.stringify(listed)).not.toMatch(/passwordHash|\$2[aby]\$/);

    // same username or email again
    expect((await admin.post("/api/admin/users", { username: account.username, email: testEmail(), password: "long-enough-pass-1" })).status).toBe(409);
    expect((await admin.post("/api/admin/users", { username: `e2e-${uniq()}`, email: account.email, password: "long-enough-pass-1" })).status).toBe(409);
    // weak or missing password, odd username
    expect((await admin.post("/api/admin/users", { username: `e2e-${uniq()}`, email: testEmail(), password: "short" })).status).toBe(400);
    expect((await admin.post("/api/admin/users", { username: `e2e-${uniq()}`, email: testEmail() })).status).toBe(400);
    expect((await admin.post("/api/admin/users", { username: "e2e bad name!", email: testEmail(), password: "long-enough-pass-1" })).status).toBe(400);

    const session = await signInAs(account.username, account.password);
    expect((await session.get("/api/admin/reservations")).status).toBe(200);
    expect((await session.post("/api/admin/clients", { firstname: "E2E", lastname: "Nope", email: testEmail() })).status).toBe(403);

    // promoted: the open session gains the role at once
    expect((await admin.put(`/api/admin/users/${account.id}`, { role: "manager" })).status).toBe(200);
    expect((await session.get("/api/admin/email-logs")).status).toBe(200);

    // deactivated: the open session dies and the account cannot sign in
    expect((await admin.put(`/api/admin/users/${account.id}`, { isActive: false })).status).toBe(200);
    expect((await session.get("/api/admin/reservations")).status).toBe(401);
    expect((await session.post("/api/admin/login", { username: account.username, password: account.password })).status).toBe(401);
    await session.dispose();

    // a new password set by the owner must be changed at next sign-in
    expect((await admin.put(`/api/admin/users/${account.id}`, { isActive: true, password: "owner-set-pass-22" })).status).toBe(200);
    const back = await signInAs(account.username, "owner-set-pass-22");
    await back.dispose();
    const row = ((await admin.get("/api/admin/users")).body.users as any[]).find((u) => u.id === account.id);
    expect(row).toMatchObject({ role: "manager", isActive: true, mustChangePassword: true });
    expect(row.lastLogin).toBeTruthy();

    expect((await admin.del(`/api/admin/users/${account.id}`)).status).toBe(200);
    expect(((await admin.get("/api/admin/users")).body.users as any[]).some((u) => u.id === account.id)).toBe(false);
  });

  test("the owner cannot lock themselves out", async ({ admin }) => {
    const login = ADMIN_USER.toLowerCase();
    const me = ((await admin.get("/api/admin/users")).body.users as any[]).find((u) => u.username === login || u.email === login);
    expect(me, "the account of this run").toBeTruthy();
    expect((await admin.put(`/api/admin/users/${me.id}`, { isActive: false })).body.error).toBe("cannot_modify_self");
    expect((await admin.put(`/api/admin/users/${me.id}`, { role: "viewer" })).body.error).toBe("cannot_modify_self");
    expect((await admin.del(`/api/admin/users/${me.id}`)).body.error).toBe("cannot_delete_self");
    expect((await admin.get("/api/admin/users")).status).toBe(200);
  });

  test("what the team does is written to the audit trail", async ({ admin, scratch }) => {
    const account = await scratch.user("manager");
    const session = await signInAs(account.username, account.password);
    await session.dispose();
    const logs = (await admin.get("/api/admin/audit?take=200")).body.logs as any[];
    expect(logs.find((l) => l.action === "user_create" && l.entityId === account.id)?.details).toMatchObject({ username: account.username, role: "manager" });
    expect(logs.some((l) => l.action === "login" && l.username === account.username)).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(account.password);
  });
});
