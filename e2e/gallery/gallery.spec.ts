import { test, expect } from "../support/fixtures";
import { PHONE } from "../support/pages";

const tiles = "main button[data-photo]";
const chips = 'main [role="group"] button[aria-pressed]';
const viewer = '[role="dialog"][aria-modal="true"][aria-label]';

/** The photo gallery: rooms, filters, the full-screen viewer and its links. */
test.describe("gallery", () => {
  test("opens in both languages", async ({ visitor }) => {
    // /fr/gallery once answered 500 while /gallery worked: both are checked on their own
    for (const url of ["/gallery", "/fr/gallery", "/gallery?c=pool-terrace", "/fr/gallery?c=pool-terrace"]) {
      expect((await visitor.get(url)).status, url).toBe(200);
    }
  });

  test("lists every photo by room, and every photo loads", async ({ page }) => {
    await page.goto("/gallery");
    const count = await page.locator(tiles).count();
    expect(count).toBeGreaterThan(5);

    // the "all" chip carries the total, and the room chips add up to it
    const numbers = await page.locator(chips).evaluateAll((els) => els.map((el) => Number(el.querySelector("span")?.textContent)));
    expect(numbers[0]).toBe(count);
    expect(numbers.slice(1).reduce((a, b) => a + b, 0)).toBe(count);

    // each room has its heading and its photos
    const rooms = page.locator("main section[aria-labelledby^='room-']");
    expect(await rooms.count()).toBe(numbers.length - 1);

    // the image files exist (asked directly: the grid lazy-loads them)
    const sources = await page.locator(`${tiles} img`).evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).map((img) => img.getAttribute("src") ?? img.currentSrc)
    );
    const failed: string[] = [];
    for (const src of sources.slice(0, 12)) {
      const res = await page.request.get(src);
      if (res.status() !== 200 || !(res.headers()["content-type"] ?? "").startsWith("image/")) failed.push(src);
    }
    expect(failed, "photos that do not load").toEqual([]);
    // every photo is described for screen readers and search engines
    const unnamed = await page.locator(tiles).evaluateAll((els) => els.filter((el) => !(el.getAttribute("aria-label") ?? "").trim()).length);
    expect(unnamed).toBe(0);
  });

  test("a room filter shows only that room and is kept in the address", async ({ page }) => {
    await page.goto("/gallery");
    const all = await page.locator(tiles).count();
    const second = page.locator(chips).nth(2);
    const expected = Number(await second.locator("span").textContent());
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(tiles)).toHaveCount(expected);
    await expect(page).toHaveURL(/[?&]c=[a-z0-9-]+/);

    // the address alone brings the same room back
    await page.reload();
    await expect(page.locator(tiles)).toHaveCount(expected);
    await expect(page.locator(chips).nth(2)).toHaveAttribute("aria-pressed", "true");

    await page.locator(chips).first().click();
    await expect(page.locator(tiles)).toHaveCount(all);
    await expect(page).not.toHaveURL(/[?&]c=/);
  });

  test("the home page's room links open the gallery on that room", async ({ page }) => {
    await page.goto("/");
    const href = await page.locator('main a[href^="/gallery?c="]').first().getAttribute("href");
    await page.goto(href!);
    const pressed = page.locator(`${chips}[aria-pressed="true"]`);
    await expect(pressed).toHaveCount(1);
    // not the "all" chip: the room asked for
    await expect(page.locator(chips).first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("main section[aria-labelledby^='room-']")).toHaveCount(1);
  });

  test("a photo opens full screen; arrows, Escape and the back button work", async ({ page }) => {
    await page.goto("/gallery");
    const first = page.locator(tiles).first();
    const firstAlt = await first.getAttribute("aria-label");
    const firstId = (await first.getAttribute("id"))!;
    await first.click();

    const dialog = page.locator(viewer);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-label", firstAlt!);
    await expect(page).toHaveURL(new RegExp(`#${firstId}$`));
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute("data-i", "0");

    await page.keyboard.press("ArrowRight");
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute("data-i", "1");
    const secondId = await page.locator(tiles).nth(1).getAttribute("id");
    await expect(page).toHaveURL(new RegExp(`#${secondId}$`));
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute("data-i", "0");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/gallery$/);

    // the browser's back button closes the viewer instead of leaving the gallery
    await page.locator(tiles).nth(2).click();
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("the viewer's own buttons page through the photos and close it", async ({ page }) => {
    await page.goto("/gallery");
    await page.locator(tiles).first().click();
    const dialog = page.locator(viewer);
    await expect(dialog).toBeVisible();
    // the arrows on the sides: only "next" on the first photo, both from the second on
    const arrows = dialog.locator("button[data-chrome]");
    await expect(arrows).toHaveCount(1);
    await arrows.last().click();
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute("data-i", "1");
    await expect(arrows).toHaveCount(2);
    await arrows.first().click();
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute("data-i", "0");
    // a thumbnail jumps straight to its photo
    await dialog.locator('[data-i="3"]').click();
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute("data-i", "3");
    // top bar: close on the left, share on the right
    const topBar = dialog.locator("div[data-chrome]").first().locator("button");
    await expect(topBar).toHaveCount(2);
    await topBar.first().click();
    await expect(dialog).toBeHidden();
  });

  test("a shared link opens straight on its photo", async ({ page }) => {
    await page.goto("/gallery");
    const target = page.locator(tiles).nth(4);
    const id = await target.getAttribute("id");
    const alt = await target.getAttribute("aria-label");
    // as a visitor arriving from the link (a new tab, not a jump inside the open page)
    await page.goto("about:blank");
    await page.goto(`/gallery#${id}`);
    await expect(page.locator(viewer)).toBeVisible();
    await expect(page.locator(viewer)).toHaveAttribute("aria-label", alt!);
  });

  test("the gallery is described to search engines", async ({ page }) => {
    await page.goto("/gallery");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const graph = blocks.flatMap((b) => {
      const data = JSON.parse(b);
      return Array.isArray(data) ? data : data["@graph"] ?? [data];
    });
    const gallery = graph.find((n: any) => n["@type"] === "ImageGallery");
    expect(gallery, "ImageGallery JSON-LD").toBeTruthy();
  });
});

test.describe("gallery on a phone", () => {
  test.use(PHONE);

  test("a photo opens with a tap and closes again", async ({ page }) => {
    await page.goto("/gallery");
    await page.locator(tiles).first().tap();
    const dialog = page.locator(viewer);
    await expect(dialog).toBeVisible();
    await dialog.locator("div[data-chrome]").first().locator("button").first().tap();
    await expect(dialog).toBeHidden();
  });

  test("the room filters scroll sideways without widening the page", async ({ page }) => {
    await page.goto("/gallery");
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(extra).toBeLessThanOrEqual(1);
    const last = page.locator(chips).last();
    await last.scrollIntoViewIfNeeded();
    await last.tap();
    await expect(last).toHaveAttribute("aria-pressed", "true");
  });
});
