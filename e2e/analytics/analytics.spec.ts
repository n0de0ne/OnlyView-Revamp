import { test, expect, adminContext, requireWrites, settings, uniq, type Api } from "../support/fixtures";
import type { Page } from "@playwright/test";

/** The visit a test made, as the back-office lists it (found by its campaign tag). */
async function visitOf(admin: Api, tag: string) {
  const res = await admin.get("/api/admin/analytics/visits");
  expect(res.status).toBe(200);
  return (res.body.sessions as any[]).find((s) => s.utmSource === tag) ?? null;
}

/** Open a page and wait for the page view the site's own tracker sends. */
async function visit(page: Page, url: string) {
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/analytics") && r.status() === 200);
  await page.goto(url);
  return (await (await sent).json()) as { pv: number };
}

const beacon = (page: Page, body: unknown) =>
  page.evaluate(async (b) => (await fetch("/api/analytics", { method: "POST", body: JSON.stringify(b), credentials: "same-origin" })).status, body);

/**
 * The site's own audience measurement (Admin → Analytique): what is counted,
 * what is never counted (the team, visitors who opted out, robots) and what
 * the back-office reports. Visits made here carry a campaign tag "e2e-…".
 */
test.describe("visitor analytics", () => {
  test.beforeEach(async ({ admin }) => {
    requireWrites();
    test.skip((await settings(admin)).analytics_enabled === "0", "audience measurement is switched off on this target");
  });

  test("a visit is recorded with its pages, source, actions and reading time", async ({ page, admin }) => {
    const tag = `e2e-${uniq()}`;
    const first = await visit(page, `/villa?utm_source=${tag}&utm_medium=test&utm_campaign=e2e`);
    expect(first.pv).toBeGreaterThan(0);
    await visit(page, "/fr/rates");
    expect(await beacon(page, { t: "ev", n: "click_whatsapp", u: "/fr/rates", d: { where: "e2e" } })).toBe(204);
    expect(await beacon(page, { t: "en", pv: first.pv, e: 42, s: 80 })).toBe(204);

    await expect.poll(async () => (await visitOf(admin, tag))?.pages.length ?? 0).toBe(2);
    const session = await visitOf(admin, tag);
    expect(session).toMatchObject({ entryPath: "/villa", exitPath: "/rates", utmMedium: "test", utmCampaign: "e2e", device: "desktop", isNewVisitor: true });
    expect(session.pages.map((p: any) => [p.path, p.locale])).toEqual([["/villa", "en"], ["/rates", "fr"]]);
    expect(session.pages[0]).toMatchObject({ engagedSec: 42, scrollPct: 80 });
    expect(session.events.map((e: any) => e.name)).toContain("click_whatsapp");

    // the visitor is "live" and counted in the period's figures
    const live = (await admin.get("/api/admin/analytics/live")).body.live as any[];
    expect(live.some((l) => l.id === session.id)).toBe(true);
    const report = (await admin.get("/api/admin/analytics")).body.report;
    expect(report.kpis.sessions).toBeGreaterThan(0);
    expect(report.kpis.pageviews).toBeGreaterThanOrEqual(2);
    expect(report.pages.some((p: any) => p.key === "/villa" || p.path === "/villa")).toBe(true);
    expect((report.campaigns as any[]).length + (report.sources as any[]).length).toBeGreaterThan(0);
  });

  test("the team browsing the site while signed in to the back-office is not counted", async ({ browser, admin }) => {
    const tag = `e2e-${uniq()}`;
    const context = await adminContext(browser);
    const page = await context.newPage();
    const answered = page.waitForResponse((r) => r.url().endsWith("/api/analytics"));
    await page.goto(`/villa?utm_source=${tag}`);
    expect((await answered).status()).toBe(204);
    await context.close();
    expect(await visitOf(admin, tag)).toBeNull();
  });

  test("a visitor who opts out on the privacy page is no longer measured", async ({ page, admin }) => {
    const tag = `e2e-${uniq()}`;
    await page.goto("/privacy");
    const optOut = page.locator("main button").filter({ hasText: /measure/i });
    await optOut.click();
    await expect.poll(() => page.evaluate(() => document.cookie)).toContain("ov_optout=1");

    let calls = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/analytics")) calls++;
    });
    await page.goto(`/villa?utm_source=${tag}`);
    await page.waitForLoadState("networkidle");
    expect(calls, "the tracker stays silent").toBe(0);
    // and the server ignores anything sent anyway
    expect(await beacon(page, { t: "pv", u: `${page.url()}` })).toBe(204);
    expect(await visitOf(admin, tag)).toBeNull();

    // the switch works both ways
    await page.goto("/privacy");
    await page.locator("main button").filter({ hasText: /measure/i }).click();
    await expect.poll(() => page.evaluate(() => document.cookie)).not.toContain("ov_optout=1");
  });

  test("robots and malformed hits are dropped", async ({ admin, playwright, baseURL }) => {
    const tag = `e2e-${uniq()}`;
    const pv = { t: "pv", u: `${baseURL}/villa?utm_source=${tag}` };
    for (const userAgent of ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "curl/8.4.0", "short"]) {
      const robot = await playwright.request.newContext({ baseURL, userAgent });
      expect((await robot.post("/api/analytics", { data: JSON.stringify(pv), headers: { "content-type": "text/plain" } })).status(), userAgent).toBe(204);
      await robot.dispose();
    }
    const human = await playwright.request.newContext({
      baseURL,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    });
    const post = (data: string) => human.post("/api/analytics", { data, headers: { "content-type": "text/plain" } });
    expect((await post("not json")).status()).toBe(204);
    expect((await post(JSON.stringify({ t: "ev", n: "made_up_event" }))).status()).toBe(204);
    expect((await post(JSON.stringify({ t: "pv" }))).status()).toBe(204);
    // an action with no visit before it is not a visit
    expect((await post(JSON.stringify({ t: "ev", n: "click_phone", u: "/villa" }))).status()).toBe(204);
    await human.dispose();
    expect(await visitOf(admin, tag)).toBeNull();
  });

  test("search and AI crawlers are logged apart from visitors", async ({ admin, playwright, baseURL }) => {
    const hits = async () => {
      const bots = (await admin.get("/api/admin/analytics")).body.crawlers.bots as any[];
      return bots.filter((b) => /GPTBot/i.test(b.bot)).reduce((n, b) => n + b.hits, 0);
    };
    const before = await hits();
    const crawler = await playwright.request.newContext({
      baseURL,
      userAgent: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
    });
    expect((await crawler.get("/llms.txt")).status()).toBe(200);
    expect((await crawler.get("/villa")).status()).toBe(200);
    await crawler.dispose();
    await expect.poll(hits).toBeGreaterThanOrEqual(before + 2);
    const report = (await admin.get("/api/admin/analytics")).body.crawlers;
    expect((report.special as any[]).some((s) => s.path === "/llms.txt" && /GPTBot/i.test(s.bot))).toBe(true);
  });
});

test.describe("visitor analytics: back-office", () => {
  test("the figures are for the team only", async ({ visitor }) => {
    for (const path of ["/api/admin/analytics", "/api/admin/analytics/live", "/api/admin/analytics/visits"]) {
      expect((await visitor.get(path)).status, path).toBe(401);
    }
  });

  test("the report covers the period asked for and filters by segment", async ({ admin }) => {
    const res = await admin.get("/api/admin/analytics?from=2026-01-01&to=2026-01-31&device=mobile");
    expect(res.status).toBe(200);
    const { report, requests, crawlers } = res.body;
    expect(report.period).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(report.previous.to).toBe("2025-12-31");
    for (const key of ["kpis", "previousKpis", "series", "pages", "channels", "sources", "countries", "devices"]) expect(report, key).toHaveProperty(key);
    expect((report.devices as any[]).every((d) => d.key === "mobile")).toBe(true);
    expect(Array.isArray(requests)).toBe(true);
    expect(crawlers).toHaveProperty("bots");
    // a period given backwards falls back to the last 30 days
    const fallback = (await admin.get("/api/admin/analytics?from=2026-02-01&to=2026-01-01")).body.report.period;
    expect(fallback.to).toBe("2026-01-01");
    expect(fallback.from < fallback.to).toBe(true);
  });

  test("the analytics screen draws without errors", async ({ browser }) => {
    const context = await adminContext(browser);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const loaded = page.waitForResponse((r) => r.url().includes("/api/admin/analytics") && r.status() === 200);
    await page.goto("/admin/analytics");
    await loaded;
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/NaN|undefined/);
    expect(errors).toEqual([]);
    await context.close();
  });
});
