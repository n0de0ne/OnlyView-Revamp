import type { Page } from "@playwright/test";
import { test, expect } from "../support/fixtures";
import { contractRow, issueContract } from "../support/contracts";
import { PHONE } from "../support/pages";

/** Draw something on the signature pad, as a hand would. */
async function drawSignature(page: Page) {
  const pad = page.locator("canvas").first();
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(box.x + 30 + i * 22, box.y + box.height / 2 + (i % 2 ? -22 : 22), { steps: 3 });
  }
  await page.mouse.up();
}

const signButton = (page: Page) => page.locator("main button.btn-gold, main button:has-text('Sign'), main button:has-text('Signer')").last();

/** The page a guest lands on from the email: read, draw, type their name, sign. */
test.describe("signing page", () => {
  test("a guest reads the agreement, signs it by hand and gets the signed PDF", async ({ page, admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts-ui");
    const issued = await issueContract(admin, reservation.id, { lang: "en" });
    await page.goto(new URL(issued.signUrl).pathname);

    await expect(page.locator(".contract-body")).toContainText(client.fullName);
    await expect(page.locator(".contract-body")).toContainText(Math.round(reservation.priceTTC).toLocaleString("en-US"));
    await expect(page.locator(`a[href="/api/contracts/pdf/${issued.contract.token}"]`)).toBeVisible();

    // opening the page is recorded: the owner sees the guest has looked at it
    await expect.poll(async () => (await contractRow(admin, issued.contract.token)).viewCount).toBeGreaterThanOrEqual(1);

    const sign = signButton(page);
    await expect(sign, "signing waits for the agreement checkbox").toBeDisabled();
    await drawSignature(page);
    await page.locator('main input[type="checkbox"]').check();

    // a name that is not the client's is refused on the spot, nothing is sent
    let sent = 0;
    page.on("request", (r) => r.url().endsWith("/api/contracts/sign") && sent++);
    await page.locator("#sig-name").fill("Somebody Else");
    await sign.click();
    await expect(page.locator("main p.text-red-600, main [class*='text-red']").first()).toBeVisible();
    expect(sent).toBe(0);

    await page.locator("#sig-name").fill(client.fullName);
    await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/contracts/sign") && r.status() === 200), sign.click()]);

    // the page comes back signed: no pad any more, the PDF to download
    await expect(page.locator("#sig-name")).toHaveCount(0);
    await expect(page.locator("main")).toContainText("✓");
    const row = await contractRow(admin, issued.contract.token);
    expect(row.status).toBe("signed");

    const download = await page.request.get(`/api/contracts/pdf/${issued.contract.token}`);
    expect(download.headers()["content-type"]).toBe("application/pdf");
  });

  test("nothing is sent without a drawn signature", async ({ page, admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts-ui");
    const issued = await issueContract(admin, reservation.id, { lang: "en" });
    await page.goto(new URL(issued.signUrl).pathname);
    let sent = 0;
    page.on("request", (r) => r.url().endsWith("/api/contracts/sign") && sent++);
    await page.locator("#sig-name").fill(client.fullName);
    await page.locator('main input[type="checkbox"]').check();
    await signButton(page).click();
    await page.waitForTimeout(700);
    expect(sent).toBe(0);
    expect((await contractRow(admin, issued.contract.token)).status).toBe("pending");
  });

  test("the French agreement opens on the French page", async ({ page, admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts-ui", {}, { language: "fr" });
    const issued = await issueContract(admin, reservation.id);
    await page.goto(new URL(issued.signUrl).pathname);
    await expect(page).toHaveURL(/\/fr\/contracts\/sign\//);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator(".contract-body")).toContainText(/CONTRAT DE LOCATION/i);
    await expect(page.locator(".contract-body")).toContainText(client.fullName);
    await expect(page.locator("#sig-name")).toBeVisible();
  });

  test("a cancelled agreement cannot be signed from its old link", async ({ page, admin, scratch }) => {
    const { reservation } = await scratch.guestStay("contracts-ui");
    const issued = await issueContract(admin, reservation.id, { lang: "en" });
    const row = await contractRow(admin, issued.contract.token);
    await admin.put(`/api/admin/contracts/${row.id}`, { action: "void" });
    await page.goto(new URL(issued.signUrl).pathname);
    await expect(page.locator("#sig-name")).toHaveCount(0);
    await expect(page.locator(".contract-body")).toHaveCount(0);
  });
});

test.describe("signing page on a phone", () => {
  test.use(PHONE);

  test("the signature is drawn with a finger and the agreement fits the screen", async ({ page, admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts-ui");
    const issued = await issueContract(admin, reservation.id, { lang: "en" });
    await page.goto(new URL(issued.signUrl).pathname);
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(extra, "the agreement does not scroll sideways").toBeLessThanOrEqual(1);

    const pad = page.locator("canvas").first();
    await pad.scrollIntoViewIfNeeded();
    // a finger stroke: pointer events of type touch, as the pad listens for
    await pad.evaluate((canvas) => {
      const r = canvas.getBoundingClientRect();
      const fire = (type: string, x: number, y: number) =>
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", pointerId: 1, clientX: r.left + x, clientY: r.top + y }));
      fire("pointerdown", 20, r.height / 2);
      for (let i = 1; i <= 8; i++) fire("pointermove", 20 + i * 20, r.height / 2 + (i % 2 ? -18 : 18));
      fire("pointerup", 180, r.height / 2);
    });
    await page.locator("#sig-name").fill(client.fullName);
    await page.locator('main input[type="checkbox"]').check();
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/contracts/sign") && r.status() === 200),
      signButton(page).tap(),
    ]);
    await expect(page.locator("#sig-name")).toHaveCount(0);
    expect((await contractRow(admin, issued.contract.token)).status).toBe("signed");
  });
});
