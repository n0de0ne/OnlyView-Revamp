import { test, expect, marked, requireWrites, skipIfRateLimited } from "../support/fixtures";

/** A review left on the site waits for the owner's approval before anyone sees it. */
test.describe("guest reviews", () => {
  test("lists approved reviews with their rating", async ({ page }) => {
    await page.goto("/reviews");
    const reviews = page.locator("main figure");
    test.skip((await reviews.count()) === 0, "no approved review on this environment");
    await expect(reviews.first().locator("blockquote")).toContainText(/\S{10,}/);
    await expect(reviews.first()).toContainText("★");
  });

  test("a new review is moderated: hidden, then public once approved", async ({ page, admin }) => {
    requireWrites();
    const name = marked("Reviewer");
    const message = `A stay to remember, written by an automated test (${name}).`;

    await page.goto("/reviews");
    await page.locator("#r-name").fill(name);
    await page.locator("#r-country").fill("Testland");
    await page.getByRole("button", { name: "4/5" }).click();
    await page.locator("#r-msg").fill(message);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/guestbook")),
      page.locator("main form button[type=submit]").click(),
    ]);
    skipIfRateLimited(response.status(), "review form");
    expect(response.status()).toBe(200);
    await expect(page.locator("#r-msg")).toHaveCount(0);

    const find = async () =>
      ((await admin.get("/api/admin/testimonials")).body.testimonials as any[]).find((t) => t.name === name);
    const pending = await find();
    try {
      expect(pending, "review waiting in the back-office").toBeTruthy();
      expect(pending.isApproved).toBe(false);
      expect(pending.rating).toBe(4);

      await page.goto("/reviews");
      await expect(page.locator("main")).not.toContainText(name);

      const approve = await admin.put("/api/admin/testimonials", { id: pending.id, isApproved: true });
      expect(approve.status).toBe(200);
      await page.goto("/reviews");
      await expect(page.locator("main figure", { hasText: name })).toContainText("A stay to remember");
      await expect(page.locator("main figure", { hasText: name })).toContainText("★★★★");
    } finally {
      if (pending) await admin.del(`/api/admin/testimonials?id=${pending.id}`);
    }
    await page.goto("/reviews");
    await expect(page.locator("main")).not.toContainText(name);
  });

  test("the server refuses an empty or out-of-range review", async ({ visitor }) => {
    requireWrites();
    for (const body of [
      { name: "E2E Reviewer", rating: 6, message: "long enough message" },
      { name: "E2E Reviewer", rating: 5, message: "short" },
      { name: "E", rating: 5, message: "long enough message" },
    ]) {
      const res = await visitor.post("/api/guestbook", body);
      skipIfRateLimited(res.status, "review form");
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});
