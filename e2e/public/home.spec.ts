import { test, expect } from "../support/fixtures";

const GOLDEN = 'section[aria-labelledby="golden-hour"]';
/** "17:36" → minutes */
const minutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

test.describe("home page", () => {
  test("shows the villa's key facts and its sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText(/ONLY VIEW/i);
    // key facts are plain text (search engines and assistants read them)
    await expect(page.locator("main dl dt").first()).toBeAttached();
    expect(await page.locator("main dl dt").count()).toBeGreaterThanOrEqual(8);
    // each space of the villa opens its part of the gallery
    const galleryLinks = page.locator('main a[href^="/gallery?c="]');
    expect(await galleryLinks.count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('main a[href="/reviews"]')).toBeAttached();
    await expect(page.locator('main a[href="/rates"]')).toBeAttached();
    await expect(page.locator('main a[href^="https://wa.me/"]').first()).toBeAttached();
  });

  test("photos load", async ({ page }) => {
    await page.goto("/");
    const broken = await page.locator("main img").evaluateAll(async (imgs) => {
      const firsts = (imgs as HTMLImageElement[]).slice(0, 6);
      await Promise.all(firsts.map((img) => (img.complete ? null : new Promise((done) => ((img.onload = done), (img.onerror = done))))));
      return firsts.filter((img) => img.naturalWidth === 0).map((img) => img.currentSrc || img.src);
    });
    expect(broken, "images that failed to load").toEqual([]);
  });
});

/**
 * The "golden hour" living photograph: the view from the pool that moves from
 * sunset to night. The owner's favourite part of the site: these tests hold
 * its behaviour through any redesign.
 */
test.describe("golden hour animation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator(GOLDEN).scrollIntoViewIfNeeded();
  });

  test("the still photograph is there before and under the animation", async ({ page }) => {
    const still = page.locator(`${GOLDEN} img`).first();
    await expect(still).toBeAttached();
    expect(await still.evaluate((img: HTMLImageElement) => img.currentSrc || img.src)).toContain("golden");
    for (const asset of ["/media/golden/view-night-01.webp", "/media/golden/mask-night-01-a.webp", "/media/golden/mask-night-01-b.webp"]) {
      expect((await page.request.get(asset)).status(), asset).toBe(200);
    }
  });

  test("the scene starts in WebGL when the block comes into view", async ({ page }) => {
    const webgl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
    test.skip(!webgl, "this browser has no WebGL: only the still photograph is shown");
    const canvas = page.locator(`${GOLDEN} canvas`).first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    // the scene fills the block (the canvas is re-created while it starts: poll its size)
    await expect.poll(() => canvas.evaluate((c) => c.clientWidth).catch(() => 0)).toBeGreaterThan(300);
    await expect.poll(() => canvas.evaluate((c) => c.clientHeight).catch(() => 0)).toBeGreaterThan(300);
    // and the still photograph steps aside once the scene is live
    await expect(page.locator(`${GOLDEN} img`).first()).toBeHidden({ timeout: 20_000 });
  });

  test("the evening runs on its own, and pauses", async ({ page }) => {
    const slider = page.locator("#golden-hour-time");
    const clock = async () => minutes((await slider.getAttribute("aria-valuetext"))!);
    const pause = page.locator(`${GOLDEN} button[aria-pressed]`);
    await expect(pause).toHaveAttribute("aria-pressed", "true");

    // speed it up so the clock visibly moves within the test
    const speed = page.locator(`${GOLDEN} button[aria-label$="×"]`);
    await speed.click();
    await speed.click();
    await speed.click();
    await expect(speed).toHaveText("8×");
    const before = await clock();
    await expect.poll(clock, { timeout: 15_000 }).toBeGreaterThan(before);

    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    const paused = await clock();
    await page.waitForTimeout(1500);
    expect(await clock()).toBe(paused);
  });

  test("the hour can be chosen with the slider and the five moments", async ({ page }) => {
    const slider = page.locator("#golden-hour-time");
    const pause = page.locator(`${GOLDEN} button[aria-pressed]`);
    // the moments are the buttons that are neither play/pause nor speed
    const moments = page.locator(`${GOLDEN} button:not([aria-pressed]):not([aria-label])`);
    await expect(moments).toHaveCount(5);

    const hours: number[] = [];
    for (let i = 0; i < 5; i++) {
      await moments.nth(i).click();
      hours.push(parseFloat(await slider.inputValue()));
      await expect(pause).toHaveAttribute("aria-pressed", "false");
    }
    // golden hour → sunset → dusk → blue hour → night, each later than the one before
    expect([...hours].sort((a, b) => a - b)).toEqual(hours);
    expect(hours[0]).toBeGreaterThanOrEqual(17);
    expect(hours[4]).toBeLessThanOrEqual(19.5);

    await slider.fill("18.5");
    await expect(slider).toHaveAttribute("aria-valuetext", "18:30");
    await expect(page.locator(GOLDEN)).toContainText("18:30");
  });

  test("it is also on the Pointe Milou page", async ({ page }) => {
    await page.goto("/pointe-milou");
    await expect(page.locator(GOLDEN)).toBeAttached();
    await expect(page.locator("#golden-hour-time")).toBeAttached();
  });

  test("visitors who ask for less motion get a still evening", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.locator(GOLDEN).scrollIntoViewIfNeeded();
    const slider = page.locator("#golden-hour-time");
    const before = await slider.inputValue();
    await page.waitForTimeout(2000);
    expect(await slider.inputValue()).toBe(before);
    await context.close();
  });
});
