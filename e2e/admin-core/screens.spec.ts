import { test, expect, adminContext } from "../support/fixtures";

const SCREENS = [
  "/admin", "/admin/calendar", "/admin/reservations", "/admin/requests", "/admin/concierge-requests", "/admin/contracts",
  "/admin/clients", "/admin/pricing", "/admin/promotions", "/admin/agencies", "/admin/extras", "/admin/concierge",
  "/admin/map", "/admin/site", "/admin/texts", "/admin/guide", "/admin/analytics", "/admin/finance", "/admin/settings", "/admin/users",
];

/**
 * Every screen of the back-office opens for the owner: a title, the menu, no
 * script error and no failed call to the server (the page fixture checks the
 * last two on every test).
 */
test.describe("back-office: every screen opens", () => {
  for (const path of SCREENS) {
    test(path, async ({ page }) => {
      const failed: string[] = [];
      page.on("response", (r) => {
        if (r.url().includes("/api/admin/") && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main")).not.toContainText(/\[object Object\]|NaN/);
      expect(failed, "calls the screen made to the server").toEqual([]);
    });
  }

  test("the menu leads to every screen, and each one is where it says", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.locator("aside nav").first();
    for (const path of SCREENS) await expect(nav.locator(`a[href="${path}"]`), path).toHaveCount(1);
    await nav.locator('a[href="/admin/clients"]').click();
    await expect(page).toHaveURL(/\/admin\/clients$/);
    await expect(page.locator("main h1").first()).toBeVisible();
  });

  test("a screen that does not exist says so instead of breaking", async ({ page }) => {
    const res = await page.goto("/admin/no-such-screen");
    expect(res?.status()).toBe(404);
  });

  test("the back-office fits a phone", async ({ browser }) => {
    const context = await adminContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    for (const path of ["/admin", "/admin/reservations", "/admin/calendar"]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
    await context.close();
  });
});
