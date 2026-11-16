import { test, expect } from "../support/fixtures";
import { PHONE, PUBLIC_PAGES, horizontalOverflow, localized } from "../support/pages";

test.use(PHONE);

/** The site on a phone: nothing sticks out sideways and the navigation is reachable with a thumb. */
test.describe("on a phone", () => {
  for (const locale of ["en", "fr"] as const) {
    test(`no page scrolls sideways (${locale})`, async ({ page }) => {
      test.slow();
      const overflowing: string[] = [];
      for (const path of PUBLIC_PAGES) {
        const url = localized(path, locale);
        await page.goto(url);
        const extra = await horizontalOverflow(page);
        if (extra > 1) overflowing.push(`${url} (+${extra}px)`);
      }
      expect(overflowing, "pages wider than the screen").toEqual([]);
    });
  }

  test("the bottom bar leads to the main sections and to booking", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Principal" });
    await expect(bar).toBeVisible();
    await bar.locator('a[href="/gallery"]').click();
    await expect(page).toHaveURL(/\/gallery$/);
    await expect(bar.locator('a[href="/gallery"]')).toHaveAttribute("aria-current", "page");
    await bar.locator('a[href="/booking"]').click();
    await expect(page).toHaveURL(/\/booking$/);
  });

  test("the menu opens the rest of the site and the other language", async ({ page }) => {
    await page.goto("/villa");
    const toggle = page.locator("header button[aria-expanded]");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("navigation", { name: "Secondaire" });
    await expect(menu.locator('a[href="/contact"]')).toBeVisible();
    await expect(menu.locator('a[href="/account"]')).toBeVisible();
    await page.locator('[aria-modal="true"] a[href="/fr/villa"]').click();
    await expect(page).toHaveURL(/\/fr\/villa$/);
  });
});
