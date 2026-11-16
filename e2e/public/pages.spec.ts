import { test, expect } from "../support/fixtures";
import { PUBLIC_PAGES, localized } from "../support/pages";

/**
 * Every public page, in both languages: it answers, in the right language,
 * with one main heading, the site header and footer, and without a script
 * error or a failed call behind it (the `page` fixture watches for those).
 */
for (const locale of ["en", "fr"] as const) {
  test.describe(`public pages (${locale})`, () => {
    for (const path of PUBLIC_PAGES) {
      const url = localized(path, locale);
      test(`${url} renders`, async ({ page }) => {
        const res = await page.goto(url);
        expect(res?.status(), `${url} status`).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page).toHaveTitle(/.{10,}/);
        await expect(page.locator("header").first()).toBeVisible();
        await expect(page.locator("footer")).toBeVisible();
        // the booking entry point is reachable from every page
        await expect(page.locator(`a[href="${localized("/booking", locale)}"]`).first()).toBeAttached();
      });
    }

    test(`every guide article opens (${locale})`, async ({ page }) => {
      await page.goto(localized("/guide", locale));
      const hrefs = await page
        .locator(`main a[href^="${localized("/guide/", locale)}"]`)
        .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
      expect(hrefs.length, "guide hub lists articles").toBeGreaterThan(0);
      for (const href of hrefs) {
        const res = await page.goto(href);
        expect(res?.status(), `${href} status`).toBe(200);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("article, main").first()).toContainText(/\S{3,}/);
      }
    });
  });
}

test("an unknown page answers 404 with a way back", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.locator('a[href="/"]').first()).toBeAttached();
});

test("an unknown guide article answers 404", async ({ visitor }) => {
  expect((await visitor.get("/guide/no-such-article")).status).toBe(404);
  expect((await visitor.get("/fr/guide/no-such-article")).status).toBe(404);
});
