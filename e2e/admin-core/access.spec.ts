import { test, expect, ANONYMOUS, BASE_URL, newClient, signInAs } from "../support/fixtures";
import { request } from "@playwright/test";

const SCREENS = [
  "/admin", "/admin/calendar", "/admin/reservations", "/admin/requests", "/admin/concierge-requests", "/admin/contracts",
  "/admin/clients", "/admin/pricing", "/admin/promotions", "/admin/agencies", "/admin/extras", "/admin/concierge",
  "/admin/map", "/admin/site", "/admin/texts", "/admin/guide", "/admin/analytics", "/admin/finance", "/admin/settings", "/admin/users",
];

/** Every data route of the back-office. A visitor must get nothing from any of them. */
const READS = [
  "agencies", "analytics", "analytics/live", "analytics/visits", "audit", "badges", "clients", "clients/1", "concierge-requests",
  "concierge/taxis", "contracts", "date-changes", "email-logs", "expenses", "extras", "extras/sync", "guides", "loyalty", "map-places",
  "photos", "promotions", "rate-periods", "reminders", "requests", "reservations", "reservations/1", "seo/indexnow", "settings",
  "site-texts", "stats", "testimonials", "users", "analytics/import-legacy",
];
const WRITES: Array<["post" | "put" | "del", string]> = [
  ["post", "agencies"], ["put", "agencies/1"], ["del", "agencies/1"], ["post", "clients"], ["put", "clients/1"], ["del", "clients/1"],
  ["post", "concierge/taxis"], ["put", "concierge/taxis/1"], ["del", "concierge/taxis/1"], ["put", "contracts/1"], ["put", "date-changes/1"],
  ["post", "expenses"], ["put", "expenses/1"], ["del", "expenses/1"], ["post", "extras"], ["put", "extras/1"], ["del", "extras/1"],
  ["post", "extras/sync"], ["post", "guides"], ["put", "guides/1"], ["del", "guides/1"], ["post", "loyalty"], ["post", "map-places"],
  ["put", "map-places/1"], ["del", "map-places/1"], ["post", "photos"], ["put", "photos"], ["del", "photos"], ["post", "photos/reorder"],
  ["post", "promotions"], ["put", "promotions/1"], ["del", "promotions/1"], ["post", "rate-periods"], ["put", "rate-periods/1"],
  ["del", "rate-periods/1"], ["post", "reminders"], ["put", "requests/1"], ["del", "requests/1"], ["post", "reservations"],
  ["put", "reservations/1"], ["del", "reservations/1"], ["post", "reservations/1/actions"], ["post", "reservations/1/extras"],
  ["put", "reservations/1/extras/1"], ["del", "reservations/1/extras/1"], ["put", "reservations/1/guest-details"], ["post", "seo/indexnow"],
  ["put", "settings"], ["post", "settings/owner-signature"], ["del", "settings/owner-signature"], ["put", "site-texts"],
  ["post", "site-texts/preview"], ["put", "testimonials"], ["del", "testimonials"], ["post", "users"], ["put", "users/1"], ["del", "users/1"],
  ["post", "change-password"], ["post", "analytics/import-legacy"],
];

test.describe("back-office: closed to visitors", () => {
  test("no data route answers without a session", async ({ visitor }) => {
    for (const path of READS) {
      const res = await visitor.get(`/api/admin/${path}`);
      expect(res.status, `GET ${path}`).toBe(401);
    }
    for (const [method, path] of WRITES) {
      const res = await visitor[method](`/api/admin/${path}`, {} as never);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  test("a made-up or tampered session cookie is not a session", async () => {
    const forged = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { cookie: "ov_admin=00000000000000000000000000000000" } });
    expect((await forged.get("/api/admin/reservations")).status()).toBe(401);
    expect((await forged.get("/api/admin/settings")).status()).toBe(401);
    await forged.dispose();
  });

  test("every screen sends a visitor to the sign-in page", async ({ browser }) => {
    const context = await browser.newContext(ANONYMOUS);
    const page = await context.newPage();
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login/);
    }
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await context.close();
  });

  test("the back-office is kept out of search engines", async ({ visitor }) => {
    const robots = String((await visitor.get("/robots.txt")).body);
    expect(robots).toMatch(/Disallow:\s*\/admin/);
    const login = await visitor.get("/admin/login");
    expect(login.status).toBe(200);
    expect(`${login.headers["x-robots-tag"] ?? ""} ${login.body}`).toMatch(/noindex/i);
  });
});

test.describe("back-office: signing in", () => {
  test("wrong password, then the first sign-in of a new account: password change is forced", async ({ browser, scratch }) => {
    const account = await scratch.user("manager");
    const context = await browser.newContext(ANONYMOUS);
    const page = await context.newPage();
    await page.goto("/admin/login");
    await page.locator("#username").fill(account.username);
    await page.locator("#password").fill("not-the-password");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("form p.text-red-700")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.locator("#password").fill(account.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin$/);
    // the account still has the password the owner typed: nothing else until it is changed
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    const fields = dialog.locator('input[type="password"]');
    const next = `E2e-chosen-${account.username}`;
    await fields.nth(0).fill(account.password);
    await fields.nth(1).fill(next);
    const changed = page.waitForResponse((r) => r.url().includes("/api/admin/change-password"));
    await dialog.locator("form button").click();
    expect((await changed).status()).toBe(200);
    await expect(dialog).toBeHidden();
    await expect(page.locator("main h1")).toBeVisible();

    // sign out from the menu
    await page.locator("aside button").filter({ hasText: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin/reservations");
    await expect(page).toHaveURL(/\/admin\/login/);
    await context.close();

    // the first password is dead, the chosen one works, by username or by email
    const visitor = await newClient();
    expect((await visitor.post("/api/admin/login", { username: account.username, password: account.password })).status).toBe(401);
    const byEmail = await visitor.post("/api/admin/login", { username: account.email, password: next });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.mustChangePassword).toBe(false);
    expect(byEmail.body.user).toMatchObject({ username: account.username, role: "manager" });
    expect(JSON.stringify(byEmail.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    await visitor.dispose();
  });

  test("sign-in answers the same for an unknown account and a wrong password", async ({ visitor, scratch }) => {
    const account = await scratch.user("viewer");
    const unknown = await visitor.post("/api/admin/login", { username: "e2e-nobody-here", password: "whatever-it-is" });
    const wrong = await visitor.post("/api/admin/login", { username: account.username, password: "whatever-it-is" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect((await visitor.post("/api/admin/login", { username: account.username })).status).toBe(400);
    // a good sign-in from this address clears the failed attempts counted against it
    const ok = await signInAs(account.username, account.password);
    await ok.dispose();
  });

  test("changing a password needs the current one and ten characters", async ({ scratch }) => {
    const account = await scratch.user("viewer");
    const me = await signInAs(account.username, account.password);
    const change = (currentPassword: string, newPassword: string) => me.post("/api/admin/change-password", { currentPassword, newPassword });
    expect((await change("not-my-password", "long-enough-pass-1")).status).toBe(401);
    expect((await change(account.password, "short")).status).toBe(400);
    expect((await change(account.password, "long-enough-pass-1")).status).toBe(200);
    await me.dispose();
    const again = await signInAs(account.username, "long-enough-pass-1");
    await again.dispose();
  });

  test("signing out ends the session on the server, not only in the browser", async ({ scratch }) => {
    const account = await scratch.user("viewer");
    const me = await signInAs(account.username, account.password);
    const cookie = (await me.ctx.storageState()).cookies.find((c) => c.name === "ov_admin")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).not.toBe("None");
    expect((await me.get("/api/admin/badges")).status).toBe(200);
    expect((await me.post("/api/admin/logout")).status).toBe(200);
    await me.dispose();
    // someone who kept the cookie cannot use it any more
    const thief = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { cookie: `ov_admin=${cookie.value}` } });
    expect((await thief.get("/api/admin/badges")).status()).toBe(401);
    await thief.dispose();
  });
});
