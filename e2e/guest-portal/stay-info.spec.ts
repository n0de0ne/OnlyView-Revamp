import { test, expect, nearStay, openGuestPortal, settings, type Api } from "../support/fixtures";

const KEYS = ["wifi_ssid", "wifi_password", "wifi_security", "wifi_hidden", "safe_code"] as const;
const TEST_VALUES = { wifi_ssid: "E2E-Villa", wifi_password: "e2e;pass:word", wifi_security: "WPA", wifi_hidden: "", safe_code: "4321" };

/**
 * The villa essentials need Wi-Fi settings. A target that has its own keeps
 * them (nothing is written); otherwise test values are set for the test and
 * removed after it.
 */
async function withWifi(admin: Api, run: (wifi: Record<string, string>) => Promise<void>) {
  const before = await settings(admin);
  const own = !!before.wifi_ssid?.trim();
  if (!own) expect((await admin.put("/api/admin/settings", { settings: TEST_VALUES })).status).toBe(200);
  try {
    await run(own ? Object.fromEntries(KEYS.map((k) => [k, before[k] ?? ""])) : TEST_VALUES);
  } finally {
    if (!own) await admin.put("/api/admin/settings", { settings: Object.fromEntries(KEYS.map((k) => [k, before[k] ?? ""])) });
  }
}

/** Wi-Fi and safe: shown to a guest only around a confirmed stay. */
test.describe.configure({ mode: "serial" });
test.describe("guest portal: villa essentials", () => {
  test("a guest about to arrive finds the Wi-Fi, its QR code and the safe code", async ({ page, admin, scratch }) => {
    const stay = await nearStay(scratch);
    test.skip(!stay, "no two free nights in the next two weeks on this target");
    await withWifi(admin, async (wifi) => {
      await openGuestPortal(page, admin, stay!.reservation.id);
      const card = page.locator("details#stay-info");
      await expect(card).toBeVisible();
      await expect(card.locator("summary")).toContainText(wifi.wifi_ssid);
      await card.locator("summary").click();
      await expect(card.locator("dd").first()).toHaveText(wifi.wifi_ssid);
      if (wifi.wifi_password) await expect(card.locator("dd").nth(1)).toHaveText(wifi.wifi_password);
      const qr = card.locator("button[aria-expanded]");
      // the button answers once the page is interactive
      await expect(async () => {
        if ((await qr.getAttribute("aria-expanded")) !== "true") await qr.click();
        await expect(qr).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
      }).toPass();
      await expect(card.locator('[role="img"][aria-label*="QR"] svg')).toBeVisible();
      if (wifi.safe_code) await expect(card).toContainText(wifi.safe_code);

      // the profile iPhones and Macs install
      const profile = await page.request.get("/api/account/wifi");
      expect(profile.status()).toBe(200);
      expect(profile.headers()["content-type"]).toContain("apple-aspen-config");
      expect(profile.headers()["cache-control"]).toContain("no-store");
      const xml = await profile.text();
      expect(xml).toContain(`<key>SSID_STR</key><string>${wifi.wifi_ssid}</string>`);
    });
  });

  test("a guest whose stay is far away, or only an option, sees none of it", async ({ page, admin, scratch }) => {
    await withWifi(admin, async (wifi) => {
      const far = await scratch.guestStay("portal");
      await openGuestPortal(page, admin, far.reservation.id);
      await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("#stay-info")).toHaveCount(0);
      if (wifi.wifi_password) await expect(page.locator("body")).not.toContainText(wifi.wifi_password);
      expect((await page.request.get("/api/account/wifi")).status()).toBe(404);
    });
  });

  test("the credentials never reach a visitor or a public page", async ({ visitor, admin }) => {
    await withWifi(admin, async (wifi) => {
      expect((await visitor.get("/api/account/wifi")).status).toBe(404);
      for (const path of ["/", "/account", "/villa", "/faq"]) {
        const html = String((await visitor.get(path)).body);
        if (wifi.wifi_password) expect(html, path).not.toContain(wifi.wifi_password);
        expect(html, path).not.toContain(`Wi-Fi · ${wifi.wifi_ssid}`);
      }
    });
  });
});
