import { test, expect, settings } from "../support/fixtures";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** The rates the public reads are the ones set in Admin → Réglages, nothing else. */
test.describe("rates page", () => {
  test("shows a rate for each season and number of bedrooms", async ({ page }) => {
    await page.goto("/rates");
    const rows = page.locator("main table tbody tr");
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(rows.nth(i).locator("td")).toHaveCount(5);
      await expect(rows.nth(i)).toContainText(/\$\d{1,3},\d{3}/);
    }
    await expect(page.locator('main a[href="/booking"]')).toBeAttached();
  });

  test("matches the back-office settings, in both languages", async ({ page, admin }) => {
    const s = await settings(admin);
    const keys = [
      "price_summer_2", "price_summer_3", "price_summer_4",
      "price_low_season_2", "price_low_season_3", "price_low_season_4",
      "price_winter_2", "price_winter_3", "price_winter_4",
      "price_christmas", "price_newyear",
    ];
    for (const url of ["/rates", "/fr/rates"]) {
      // the page is cached for a few minutes: a rate changed just before the run may lag
      await page.goto(url);
      const text = (await page.locator("main").innerText()).replace(/[  ]/g, " ");
      for (const key of keys) {
        const amount = Number(s[key]);
        const shown = url.startsWith("/fr") ? [usd(amount), `${Math.round(amount).toLocaleString("fr-FR").replace(/[  ]/g, " ")} $`] : [usd(amount)];
        expect(shown.some((v) => text.includes(v)), `${key} (${usd(amount)}) on ${url}`).toBe(true);
      }
      expect(text, "tourist tax").toContain(`${Number(s.tax_rate)}%`.replace("%", url.startsWith("/fr") ? " %" : "%"));
    }
  });

  test("the quote engine charges the weekly rate of the table", async ({ page, visitor }) => {
    // a mid-June week sits in a single season whatever the year
    const year = new Date().getUTCFullYear() + 1;
    const quote = await visitor.post("/api/quote", { startDate: `${year}-06-10`, endDate: `${year}-06-17`, bedrooms: 4 });
    expect(quote.status).toBe(200);
    await page.goto("/rates");
    await expect(page.locator("main table")).toContainText(usd(quote.body.quote.baseBeforeOffers));
  });
});
