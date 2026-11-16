import { test, expect, marked } from "../support/fixtures";
import { reservationOf } from "../support/contracts";

/** The screens the owner works in every day: list, editor, calendar, requests. */
test.describe("reservations: screens", () => {
  test("the list finds a stay in any season and opens its editor", async ({ page, scratch }) => {
    const { client, reservation } = await scratch.guestStay("admin-reservations-ui");
    await page.goto("/admin/reservations");
    // test stays live far ahead: look in every season
    await page.locator("main select").first().selectOption({ index: 0 });
    await page.locator('main input[placeholder*="Rechercher"]').fill(client.lastname);
    const row = page.locator("main tbody tr").filter({ hasText: client.lastname });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("$" + Math.round(reservation.priceTTC).toLocaleString("en-US"));
    await expect(row).toContainText("7");
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/reservations/${reservation.id}$`));
    await expect(page.getByRole("heading", { name: `Réservation #${reservation.id}` })).toBeVisible();
  });

  test("the editor changes the status and saves", async ({ page, admin, scratch }) => {
    const { reservation } = await scratch.guestStay("admin-reservations-ui");
    await page.goto(`/admin/reservations/${reservation.id}`);
    await expect(page.getByRole("heading", { name: `Réservation #${reservation.id}` })).toBeVisible();
    await page.getByRole("button", { name: /Option/ }).first().click();
    const saved = page.waitForResponse((r) => r.url().endsWith(`/api/admin/reservations/${reservation.id}`) && r.request().method() === "PUT");
    await page.getByRole("button", { name: /Enregistrer$/ }).first().click();
    expect((await saved).status()).toBe(200);
    const after = await reservationOf(admin, reservation.id);
    expect(after.status).toBe("option");
    // nothing else moved
    expect(after).toMatchObject({ startDate: reservation.startDate, endDate: reservation.endDate, priceTTC: reservation.priceTTC, clientId: reservation.clientId });
  });

  test("a new stay is entered from the editor", async ({ page, admin, scratch }) => {
    // find a free week of the lane, then enter it by hand
    const probe = await scratch.reservation("admin-reservations-ui");
    expect((await admin.del(`/api/admin/reservations/${probe.id}`)).status).toBe(200);
    const name = marked("Stay");

    await page.goto("/admin/reservations/new");
    const dateOf = (label: string) => page.locator("main .afield").filter({ has: page.getByText(label, { exact: true }) }).locator('input[type="date"]');
    await dateOf("Arrivée").fill(probe.startDate);
    await dateOf("Départ").fill(probe.endDate);
    await page.getByPlaceholder("Ex : Jean").fill("E2E");
    await page.getByPlaceholder("Ex : Martin").fill(name.replace("E2E ", ""));
    const created = page.waitForResponse((r) => r.url().endsWith("/api/admin/reservations") && r.request().method() === "POST");
    await page.getByRole("button", { name: /Enregistrer$/ }).first().click();
    const res = await created;
    const body = await res.json();
    if (body.reservation?.id) scratch.track(() => admin.del(`/api/admin/reservations/${body.reservation.id}`));
    if (body.reservation?.clientId) scratch.track(() => admin.del(`/api/admin/clients/${body.reservation.clientId}`));
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body.reservation).toMatchObject({ startDate: probe.startDate, endDate: probe.endDate });
    expect(body.reservation.priceTTC).toBe(probe.priceTTC);
    await expect(page).toHaveURL(/\/admin\/reservations/);
  });

  test("the calendar opens on the current season with a way to add a stay", async ({ page }) => {
    await page.goto("/admin/calendar");
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator('main a[href="/admin/reservations/new"]')).toBeVisible();
    // twelve months of days
    await expect.poll(() => page.locator("main button").count()).toBeGreaterThan(300);
    // the season can be changed
    const season = page.locator("main select").first();
    const before = await season.inputValue();
    await page.getByRole("button", { name: "Saison précédente" }).click();
    await expect(season).not.toHaveValue(before);
  });

  test("requests, contracts and the dashboard open with their figures", async ({ page }) => {
    for (const path of ["/admin", "/admin/requests", "/admin/contracts"]) {
      await page.goto(path);
      await expect(page.locator("main h1"), path).toBeVisible();
      await expect(page.locator("main"), path).not.toContainText(/NaN|undefined|\[object/);
    }
  });
});
