import { test, expect } from "../support/fixtures";
import { PUBLIC_PAGES, localized } from "../support/pages";

/**
 * What search engines and AI assistants read. A light guard for every run;
 * `scripts/seo-audit.mjs` remains the exhaustive crawl.
 *
 * Addresses in the pages (canonical, sitemap…) are built from the server's
 * SITE_URL, so they are compared by path, whatever the host under test.
 */
const pathOf = (url: string) => new URL(url, "http://x").pathname.replace(/\/$/, "") || "/";
// the guest portal is private; the legal and privacy pages are deliberately left out of search results
const UNLISTED = ["/account", "/legal", "/privacy"];
const INDEXED = PUBLIC_PAGES.filter((p) => !UNLISTED.includes(p));

async function sitemapUrls(get: (url: string) => Promise<{ status: number; body: any }>) {
  const res = await get("/sitemap.xml");
  expect(res.status).toBe(200);
  return [...String(res.body).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

test.describe("sitemap and robots", () => {
  test("the sitemap lists every public page in both languages, and only pages that exist", async ({ visitor }) => {
    const urls = await sitemapUrls((u) => visitor.get(u));
    const paths = urls.map(pathOf);
    for (const page of INDEXED) {
      expect(paths, `sitemap has ${page || "/"}`).toContain(page || "/");
      expect(paths, `sitemap has /fr${page}`).toContain(`/fr${page}`);
    }
    for (const closed of ["/admin", "/account", "/api", "/contracts"]) {
      expect(paths.filter((p) => p.startsWith(closed) || p.startsWith(`/fr${closed}`)), `${closed} stays out of the sitemap`).toEqual([]);
    }
    const dead: string[] = [];
    for (const path of new Set(paths)) {
      const res = await visitor.get(path, { maxRedirects: 0 });
      if (res.status !== 200) dead.push(`${path} → ${res.status}`);
    }
    expect(dead, "sitemap entries that do not answer 200").toEqual([]);
  });

  test("robots.txt opens the site, closes the private parts and names the sitemap", async ({ visitor }) => {
    const res = await visitor.get("/robots.txt");
    expect(res.status).toBe(200);
    const text = String(res.body);
    expect(text).toMatch(/User-Agent: \*\s+Allow: \//i);
    for (const closed of ["/admin", "/api/", "/account", "/contracts/"]) expect(text).toContain(`Disallow: ${closed}`);
    expect(text).toMatch(/Sitemap: \S+\/sitemap\.xml/i);
    // AI crawlers are welcomed by name
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) expect(text, bot).toContain(bot);
  });

  test("llms.txt and llms-full.txt give the site as text", async ({ visitor }) => {
    const short = await visitor.get("/llms.txt");
    expect(short.status).toBe(200);
    expect(String(short.body)).toMatch(/^# Villa ONLY VIEW/);
    const full = await visitor.get("/llms-full.txt");
    expect(full.status).toBe(200);
    expect(String(full.body).length).toBeGreaterThan(5000);
  });

  test("the web app manifests are served", async ({ visitor }) => {
    for (const url of ["/manifest.webmanifest", "/manifest-admin.webmanifest"]) {
      const res = await visitor.get(url);
      expect(res.status, url).toBe(200);
      expect(res.body.name ?? res.body.short_name, url).toBeTruthy();
      expect(res.body.icons.length, url).toBeGreaterThan(0);
    }
  });
});

test.describe("page metadata", () => {
  for (const locale of ["en", "fr"] as const) {
    test(`every page has its title, description, canonical, languages and sharing card (${locale})`, async ({ page }) => {
      test.slow();
      const titles = new Map<string, string>();
      for (const path of INDEXED) {
        const url = localized(path, locale);
        await page.goto(url);
        const head = await page.evaluate(() => {
          const attr = (sel: string, name: string) => document.querySelector(sel)?.getAttribute(name) ?? null;
          return {
            title: document.title,
            description: attr('meta[name="description"]', "content"),
            robots: attr('meta[name="robots"]', "content"),
            canonical: attr('link[rel="canonical"]', "href"),
            en: attr('link[rel="alternate"][hreflang="en"]', "href"),
            fr: attr('link[rel="alternate"][hreflang="fr"]', "href"),
            xDefault: attr('link[rel="alternate"][hreflang="x-default"]', "href"),
            ogTitle: attr('meta[property="og:title"]', "content"),
            ogImage: attr('meta[property="og:image"]', "content"),
            ogUrl: attr('meta[property="og:url"]', "content"),
            twitter: attr('meta[name="twitter:card"]', "content"),
          };
        });
        expect(head.title.length, `${url} title`).toBeGreaterThan(15);
        expect(head.description?.length ?? 0, `${url} description`).toBeGreaterThan(50);
        expect(head.robots ?? "", `${url} is indexable`).not.toContain("noindex");
        expect(pathOf(head.canonical!), `${url} canonical`).toBe(pathOf(url));
        expect(pathOf(head.en!), `${url} hreflang en`).toBe(pathOf(localized(path, "en")));
        expect(pathOf(head.fr!), `${url} hreflang fr`).toBe(pathOf(localized(path, "fr")));
        expect(pathOf(head.xDefault!), `${url} hreflang x-default`).toBe(pathOf(localized(path, "en")));
        expect(head.ogTitle, `${url} og:title`).toBeTruthy();
        expect(pathOf(head.ogUrl!), `${url} og:url`).toBe(pathOf(url));
        expect(head.twitter, `${url} twitter card`).toBe("summary_large_image");
        const image = await page.request.get(new URL(head.ogImage!).pathname);
        expect(image.status(), `${url} og:image loads`).toBe(200);
        expect(titles.has(head.title), `${url} shares its title with ${titles.get(head.title)}`).toBe(false);
        titles.set(head.title, url);
      }
    });
  }

  test("private and legal pages are kept out of search results", async ({ page }) => {
    for (const url of ["/account", "/fr/account", "/legal", "/fr/privacy", "/contracts/sign/not-a-real-token-0000"]) {
      await page.goto(url);
      await expect(page.locator('meta[name="robots"]').first(), url).toHaveAttribute("content", /noindex/);
    }
  });
});

test.describe("structured data", () => {
  const graphOf = async (page: import("@playwright/test").Page) => {
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    return blocks.flatMap((b) => {
      const data = JSON.parse(b); // a block that is not valid JSON fails here
      return Array.isArray(data) ? data : data["@graph"] ?? [data];
    });
  };
  const typesOf = (graph: any[]) => graph.flatMap((n) => n["@type"]);

  test("the home page describes the villa as a vacation rental", async ({ page }) => {
    await page.goto("/");
    const graph = await graphOf(page);
    const types = typesOf(graph);
    for (const type of ["VacationRental", "Organization", "WebSite", "FAQPage"]) expect(types, type).toContain(type);
    const villa = graph.find((n) => [n["@type"]].flat().includes("VacationRental"));
    expect(villa.name).toMatch(/ONLY VIEW/i);
    expect(villa.address).toBeTruthy();
    expect(villa.geo ?? villa.latitude).toBeTruthy();
  });

  test("each kind of page carries its own description", async ({ page }) => {
    const expected: Array<[string, string]> = [
      ["/faq", "FAQPage"],
      ["/gallery", "ImageGallery"],
      ["/map", "TouristDestination"],
      ["/contact", "ContactPage"],
      ["/pointe-milou", "Place"],
      ["/villa", "BreadcrumbList"],
      ["/fr/faq", "FAQPage"],
    ];
    for (const [url, type] of expected) {
      await page.goto(url);
      expect(typesOf(await graphOf(page)), `${type} on ${url}`).toContain(type);
    }
  });

  test("guide articles are dated articles", async ({ page }) => {
    await page.goto("/guide");
    const href = await page.locator('main a[href^="/guide/"]').first().getAttribute("href");
    await page.goto(href!);
    const article = (await graphOf(page)).find((n) => [n["@type"]].flat().some((t: string) => /Article/.test(t)));
    expect(article, `Article on ${href}`).toBeTruthy();
    expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(article.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
