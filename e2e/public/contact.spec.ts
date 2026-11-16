import { test, expect, emailLogs, requireWrites, skipIfRateLimited, uniq } from "../support/fixtures";

test.describe("contact", () => {
  test("shows how to reach the owner", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator('main a[href^="mailto:"]').first()).toBeVisible();
    await expect(page.locator('main a[href^="https://wa.me/"]').first()).toBeVisible();
  });

  test("a message sent from the form reaches the owner", async ({ page, admin }) => {
    requireWrites();
    const id = uniq();
    await page.goto("/contact");
    await page.locator("#c-name").fill(`E2E Visitor ${id}`);
    await page.locator("#c-email").fill(`e2e-${id}@example.com`);
    await page.locator("#c-msg").fill(`E2E contact message ${id} <b>bold</b>`);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/contact")),
      page.locator("main form button[type=submit]").click(),
    ]);
    skipIfRateLimited(response.status(), "contact form");
    expect(response.status()).toBe(200);
    // the form gives way to the confirmation
    await expect(page.locator("#c-msg")).toHaveCount(0);
    await expect(page.locator("main")).toContainText("✓");

    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "contact_message" && l.subject?.includes(id));
    expect(mail, "owner notification in the email log").toBeTruthy();
    // what the visitor typed is shown as text, never as markup
    expect(mail!.body).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(mail!.body).not.toContain("<b>bold</b>");
  });

  test("the browser refuses an incomplete message", async ({ page }) => {
    await page.goto("/contact");
    await page.locator("#c-name").fill("A");
    await page.locator("#c-email").fill("not-an-email");
    let sent = false;
    page.on("request", (r) => r.url().endsWith("/api/contact") && (sent = true));
    await page.locator("main form button[type=submit]").click();
    await page.waitForTimeout(500);
    expect(sent, "nothing is sent").toBe(false);
    await expect(page.locator("#c-msg")).toBeVisible();
  });

  test("the server refuses what the form would not let through", async ({ visitor }) => {
    requireWrites();
    const bad = [
      { name: "A", email: "a@example.com", message: "long enough" },
      { name: "E2E Visitor", email: "nope", message: "long enough" },
      { name: "E2E Visitor", email: "a@example.com", message: "hi" },
      // a filled hidden field is a robot
      { name: "E2E Visitor", email: "a@example.com", message: "long enough", website: "http://spam.example" },
      // a name on two lines would forge mail headers
      { name: "E2E Visitor\r\nBcc: x@example.com", email: "a@example.com", message: "long enough" },
    ];
    for (const body of bad) {
      const res = await visitor.post("/api/contact", body);
      skipIfRateLimited(res.status, "contact form");
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe("invalid_input");
    }
  });
});
