import { test, expect } from "../support/fixtures";

test.describe("navigation", () => {
  test("the header leads to each section", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const path of ["/villa", "/tour", "/gallery", "/rates", "/guide", "/reviews", "/contact"]) {
      await nav.locator(`a[href="${path}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("the language switch keeps the visitor on the same page", async ({ page }) => {
    await page.goto("/villa");
    await page.locator('header a[href="/fr/villa"]').first().click();
    await expect(page).toHaveURL(/\/fr\/villa$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    await page.locator('header a[href="/villa"]').first().click();
    await expect(page).toHaveURL(/\/villa$/);
    await expect(page).not.toHaveURL(/\/fr\//);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("the home page calls to action lead to booking", async ({ page }) => {
    await page.goto("/");
    await page.locator('main a[href="/booking"]').first().click();
    await expect(page).toHaveURL(/\/booking$/);
    await expect(page.locator("#bk-start")).toBeAttached();
  });

  test("the footer links work", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.locator("footer a[href^='/']").evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
    expect(hrefs).toEqual(expect.arrayContaining(["/map", "/faq", "/why-book-direct", "/pointe-milou", "/legal", "/privacy", "/account"]));
    for (const href of hrefs.filter((h) => !h.startsWith("/admin"))) {
      const res = await page.request.get(href);
      expect(res.status(), `footer link ${href}`).toBe(200);
    }
  });
});

test.describe("addresses", () => {
  test("/en/… is not a second address for the English pages", async ({ visitor }) => {
    const res = await visitor.get("/en/villa", { maxRedirects: 0 });
    expect(res.status).toBe(308);
    expect(res.headers.location).toMatch(/\/villa$/);
  });

  test("the old site's addresses still land on the right page", async ({ visitor }) => {
    const legacy: Array<[string, string]> = [
      ["/index.php", "/"],
      ["/pricing.php", "/rates"],
      ["/about.php", "/villa"],
      ["/book-direct.php", "/booking"],
      ["/guestbook.php", "/reviews"],
      ["/gallery.php", "/gallery"],
      ["/best-beaches.php", "/guide/best-beaches"],
      ["/st-barth-seasons.php", "/guide/seasons"],
      ["/location", "/pointe-milou"],
      ["/fr/location", "/fr/pointe-milou"],
    ];
    for (const [from, to] of legacy) {
      const res = await visitor.get(from, { maxRedirects: 0 });
      expect([301, 308], `${from} is a permanent redirect`).toContain(res.status);
      expect(new URL(res.headers.location, "http://x").pathname, `${from} target`).toBe(to);
      expect((await visitor.get(to)).status, `${to} exists`).toBe(200);
    }
  });

  test("?lang=fr from the old site lands on the French page", async ({ visitor }) => {
    const res = await visitor.get("/pricing.php?lang=fr");
    expect(res.status).toBe(200);
    expect(res.raw.url()).toMatch(/\/fr\/rates/);
  });

  test("old guest and contract links are kept alive", async ({ visitor }) => {
    const guest = await visitor.get("/guest", { maxRedirects: 0 });
    expect(new URL(guest.headers.location, "http://x").pathname).toBe("/account");
    const sign = await visitor.get("/sign-contract.php?t=abcdefghijklmnop&lang=fr", { maxRedirects: 0 });
    expect(new URL(sign.headers.location, "http://x").pathname).toBe("/fr/contracts/sign/abcdefghijklmnop");
  });

  test("security headers are set on every page", async ({ visitor }) => {
    const res = await visitor.get("/");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
