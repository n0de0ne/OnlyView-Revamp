import type { Page } from "@playwright/test";
import { test, expect, marked } from "../support/fixtures";
import { PHONE } from "../support/pages";

const frame = ".island-map";
const chips = `${frame} [role="group"] button[aria-pressed]`;
const rows = `${frame} section[aria-labelledby^="map-"] li button`;
const search = `${frame} input[type="search"]`;
// the open place: the only heading of the frame that is not a category title
const card = `${frame} h3:not([id])`;

/**
 * The road itinerary comes from a public routing service: the tests answer in
 * its place, so they check the site and not that service's mood.
 */
async function mockRouter(page: Page, mode: "ok" | "down" = "ok") {
  await page.route(/router\.project-osrm\.org/, (route) =>
    mode === "down"
      ? route.abort()
      : route.fulfill({
          json: {
            code: "Ok",
            routes: [
              {
                distance: 2400,
                duration: 300,
                geometry: { type: "LineString", coordinates: [[-62.8128, 17.9126], [-62.82, 17.908], [-62.8242, 17.9067]] },
                legs: [{ distance: 2400, duration: 300 }],
              },
            ],
          },
        })
  );
}

test.describe("island map", () => {
  test.beforeEach(async ({ page }) => {
    await mockRouter(page);
  });

  test("lists the island's places by category, with their drive time", async ({ page }) => {
    await page.goto("/map");
    const counts = await page.locator(chips).evaluateAll((els) => els.map((el) => Number((el.textContent ?? "").match(/(\d+)\s*$/)?.[1])));
    expect(counts[0], "total on the 'all' filter").toBeGreaterThan(10);
    expect(counts.slice(1).reduce((a, b) => a + b, 0)).toBe(counts[0]);
    await expect(page.locator(rows)).toHaveCount(counts[0]);
    // each row says how far it is from the villa
    await expect(page.locator(rows).first()).toContainText(/\d+\s*min/);
    // and each place has its pin on the map
    await expect(page.locator(`${frame} .leaflet-marker-icon`).first()).toBeAttached();
  });

  test("a category filter narrows the list", async ({ page }) => {
    await page.goto("/map");
    const beaches = page.locator(chips).nth(1);
    const expected = Number((await beaches.textContent())!.match(/(\d+)\s*$/)![1]);
    await beaches.click();
    await expect(beaches).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(rows)).toHaveCount(expected);
    await expect(page.locator(`${frame} section[aria-labelledby^="map-"]`)).toHaveCount(1);
    await page.locator(chips).first().click();
    await expect(page.locator(`${frame} section[aria-labelledby^="map-"]`)).not.toHaveCount(1);
  });

  test("search finds a place by its name", async ({ page }) => {
    await page.goto("/map");
    const name = (await page.locator(rows).nth(3).innerText()).split("\n")[0].trim();
    expect(name.length).toBeGreaterThan(2);
    await page.locator(search).fill(name);
    await expect(page.locator(rows).first()).toContainText(name);
    expect(await page.locator(rows).count()).toBeLessThan(10);
    await page.locator(search).fill("zzzz-no-such-place");
    await expect(page.locator(rows)).toHaveCount(0);
  });

  test("a place opens its card: details, itinerary, Google Maps and Waze", async ({ page }) => {
    await page.goto("/map");
    await page.locator(chips).nth(1).click();
    const row = page.locator(rows).first();
    await row.click();
    await expect(page.locator(card)).toBeVisible();
    const maps = page.locator(`${frame} a[href^="https://www.google.com/maps/dir/"]`).first();
    await expect(maps).toHaveAttribute("href", /destination=-?\d+\.\d+%2C-?\d+\.\d+/);
    await expect(maps).toHaveAttribute("target", "_blank");

    // "itinerary" draws the road from the villa and sums it up
    await page.locator(`${frame} button[aria-pressed]`).filter({ hasNot: page.locator("span[class*=tabular]") }).last().click();
    const summary = page.locator(`${frame} [role="status"]`).first();
    await expect(summary).toContainText(/\d+\s*min/);
    await expect(summary).toContainText(/2[.,]4\s*km/);
    await expect(summary.locator('a[href^="https://waze.com/ul?ll="]')).toBeVisible();
    await expect(page.locator(`${frame} path.leaflet-interactive, ${frame} .leaflet-overlay-pane path`).first()).toBeAttached();

    // Escape closes the card and brings the list back
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator(rows).first()).toBeVisible();
  });

  test("the itinerary still shows when the routing service is down", async ({ page }) => {
    await page.unroute(/router\.project-osrm\.org/);
    await mockRouter(page, "down");
    await page.goto("/map");
    await page.locator(rows).first().click();
    await expect(page.locator(card)).toBeVisible();
    await page.locator(`${frame} button[aria-pressed]`).filter({ hasNot: page.locator("span[class*=tabular]") }).last().click();
    // a straight line and the saved drive time stand in for the road
    await expect(page.locator(`${frame} [role="status"]`).first()).toContainText(/\d+\s*min/);
    await expect(page.locator(`${frame} a[href^="https://www.google.com/maps/dir/"]`).first()).toBeVisible();
  });

  test("the page describes the island to search engines without the map", async ({ page }) => {
    await page.goto("/map");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = blocks.flatMap((b) => {
      const data = JSON.parse(b);
      return (Array.isArray(data) ? data : data["@graph"] ?? [data]).map((n: any) => n["@type"]);
    });
    expect(types.flat()).toContain("TouristDestination");
    // the places are in the HTML itself, not only drawn by the script
    const html = await (await page.request.get("/map")).text();
    const firstName = (await page.locator(rows).first().innerText()).split("\n")[0].trim();
    expect(html).toContain(firstName.replace(/&/g, "&amp;"));
  });

  test("opens in French", async ({ page }) => {
    await page.goto("/fr/map");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator(rows).first()).toBeVisible();
    await expect(page.locator(search)).toBeVisible();
  });
});

/** What the owner changes in Admin → Carte de l'île shows on the public map at once. */
test.describe("island map, fed by the back-office", () => {
  test.beforeEach(async ({ page }) => {
    await mockRouter(page);
  });

  test("a place added in the back-office is on the map straight away, with its own link", async ({ page, admin, scratch }) => {
    const name = marked("Beach");
    const created = await admin.post("/api/admin/map-places", {
      category: "beach",
      name,
      zone: "Lorient",
      lat: "17,9067", // typed on a French keyboard
      lng: -62.8242,
      descriptionEn: "A beach that only exists for an automated test.",
      descriptionFr: "Une plage qui n'existe que pour un test automatique.",
      driveMinutes: 6,
      website: "example.com/e2e-beach",
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const place = created.body.place;
    scratch.track(() => admin.del(`/api/admin/map-places/${place.id}`));
    expect(place.lat).toBeCloseTo(17.9067, 4);
    expect(place.website).toBe("https://example.com/e2e-beach");

    // no rebuild, no cache to wait for
    await page.goto("/map");
    await page.locator(search).fill(name);
    await expect(page.locator(rows)).toHaveCount(1);
    await expect(page.locator(rows).first()).toContainText("6 min");

    // its address opens it, and ?route=1 draws the way there (the guest portal's "Directions" links)
    await page.goto("about:blank");
    await page.goto(`/map?route=1#${place.slug}`);
    await expect(page.locator(card)).toHaveText(name);
    await expect(page.locator(`${frame} [role="status"]`).first()).toContainText(/km/);
    await expect(page.locator(`${frame} a[href="https://example.com/e2e-beach"]`).first()).toBeVisible();

    // French visitors read the French description
    await page.goto("about:blank");
    await page.goto(`/fr/map#${place.slug}`);
    await expect(page.locator(frame)).toContainText("n'existe que pour un test");

    // hidden in the back-office: gone from the map, kept in the admin
    const hidden = await admin.put(`/api/admin/map-places/${place.id}`, { ...place, isActive: false });
    expect(hidden.status, JSON.stringify(hidden.body)).toBe(200);
    await page.goto("/map");
    await page.locator(search).fill(name);
    await expect(page.locator(rows)).toHaveCount(0);
  });

  test("the back-office refuses a place that cannot be put on a map", async ({ admin, scratch }) => {
    void scratch;
    for (const bad of [
      { category: "beach", name: marked("Bad"), lat: 120, lng: -62.8 },
      { category: "castle", name: marked("Bad"), lat: 17.9, lng: -62.8 },
      { category: "beach", name: "", lat: 17.9, lng: -62.8 },
      { category: "beach", name: marked("Bad"), lat: 17.9, lng: -62.8, waypoints: "not,coordinates|here" },
    ]) {
      const res = await admin.post("/api/admin/map-places", bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  test("the public count matches the active places of the back-office", async ({ page, admin }) => {
    const places = (await admin.get("/api/admin/map-places")).body.places as any[];
    const active = places.filter((p) => p.isActive).length;
    await page.goto("/map");
    await expect(page.locator(chips).first()).toContainText(String(active));
  });
});

test.describe("island map on a phone", () => {
  test.use(PHONE);

  test("the list sits in a sheet under the map and a place opens from it", async ({ page }) => {
    await mockRouter(page);
    await page.goto("/map");
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(extra).toBeLessThanOrEqual(1);
    await page.locator(search).scrollIntoViewIfNeeded();
    await page.locator(search).fill("beach");
    const row = page.locator(rows).first();
    await expect(row).toBeVisible();
    await row.tap();
    await expect(page.locator(card)).toBeVisible();
  });
});
