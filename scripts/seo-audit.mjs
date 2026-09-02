/**
 * SEO / GEO audit of a running instance.
 *
 *   BASE_URL=http://localhost:3000 node scripts/seo-audit.mjs
 *
 * Crawls every URL in the sitemap (both languages), then every internal link
 * it finds, and checks what search engines and AI answer engines look at:
 * status, <html lang>, title and description (present, sized, unique),
 * a single H1, canonical + hreflang, Open Graph / Twitter cards, valid
 * JSON-LD with the expected types, image alt text, thin pages, broken links,
 * noindex leaks, sitemap ↔ crawl consistency, robots.txt, llms.txt.
 *
 * Exit code 1 when anything fails. Warnings don't fail the run.
 */
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const origin = new URL(BASE).origin;

const fails = [];
const warns = [];
const fail = (page, msg) => fails.push(`${page}  ${msg}`);
const warn = (page, msg) => warns.push(`${page}  ${msg}`);

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

/* ── tiny HTML helpers (head tags are regular enough for regex) ── */
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? decode(m[2] ?? m[3] ?? "") : null;
};
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
const meta = (html, key, val) =>
  tags(html, "meta").find((t) => (attr(t, key) ?? "").toLowerCase() === val.toLowerCase());
const metaContent = (html, key, val) => {
  const t = meta(html, key, val);
  return t ? attr(t, "content") : null;
};
const links = (html, rel) => tags(html, "link").filter((t) => (attr(t, "rel") ?? "").toLowerCase() === rel);
const textOf = (html) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

async function get(url) {
  const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "seo-audit/1.0" } });
  const body = await res.text();
  return { status: res.status, location: res.headers.get("location"), body, type: res.headers.get("content-type") ?? "" };
}

/* ── sitemap ── */
const sm = await get(`${BASE}/sitemap.xml`);
if (sm.status !== 200) {
  console.error(`sitemap.xml → ${sm.status}`);
  process.exit(1);
}
const sitemapUrls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
const sitemapAlternates = [...sm.body.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1]));
const sitemapSet = new Set([...sitemapUrls, ...sitemapAlternates].map((u) => new URL(u).pathname.replace(/\/$/, "") || "/"));
if (!/<lastmod>/.test(sm.body)) warn("sitemap.xml", "no <lastmod> entries");
if (!/xhtml:link/.test(sm.body)) warn("sitemap.xml", "no hreflang alternates");
console.log(`sitemap: ${sitemapUrls.length} urls, ${sitemapSet.size} distinct paths incl. alternates`);

/* ── crawl ── */
const seen = new Map(); // path → result
const foundOn = new Map(); // path → first page linking to it
const queue = [...sitemapSet];
const skip = (p) => /^\/(admin|api|account|contracts|_next)(\/|$)/.test(p) || /\.(png|jpe?g|webp|avif|svg|ico|mp4|webm|pdf|xml|txt|json)$/i.test(p);

while (queue.length) {
  const path = queue.shift();
  if (seen.has(path) || skip(path)) continue;
  const url = `${BASE}${path}`;
  const r = await get(url);
  const info = { status: r.status, location: r.location, indexable: false, title: "", description: "", h1: [] };
  seen.set(path, info);

  if (r.status >= 300 && r.status < 400) {
    // redirects are fine as long as their target is fine
    const target = new URL(r.location ?? "/", url);
    if (target.origin === origin) queue.push(target.pathname.replace(/\/$/, "") || "/");
    continue;
  }
  if (r.status !== 200) {
    fail(path, `HTTP ${r.status}${foundOn.has(path) ? ` — linked from ${foundOn.get(path)}` : ""}`);
    continue;
  }
  if (!r.type.includes("text/html")) continue;
  const html = r.body;

  // language + basics
  const langTag = tags(html, "html")[0] ?? "";
  const lang = attr(langTag, "lang");
  const expectedLang = path === "/fr" || path.startsWith("/fr/") ? "fr" : "en";
  if (lang !== expectedLang) fail(path, `<html lang> is "${lang}", expected "${expectedLang}"`);
  if (!meta(html, "name", "viewport")) fail(path, "no viewport meta");

  const robots = (metaContent(html, "name", "robots") ?? "").toLowerCase();
  info.indexable = !robots.includes("noindex");

  // title
  const tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  info.title = tm ? decode(tm[1]).replace(/\s+/g, " ").trim() : "";
  if (!info.title) fail(path, "no <title>");
  else if (info.title.length > 70) warn(path, `title is ${info.title.length} chars (>70 gets cut): "${info.title}"`);
  else if (info.title.length < 25) warn(path, `title is short (${info.title.length}): "${info.title}"`);

  // description
  info.description = metaContent(html, "name", "description") ?? "";
  if (info.indexable) {
    if (!info.description) fail(path, "no meta description");
    else if (info.description.length > 165) warn(path, `description is ${info.description.length} chars (>165 gets cut)`);
    else if (info.description.length < 60) warn(path, `description is short (${info.description.length})`);
  }

  // canonical + hreflang
  const canon = links(html, "canonical").map((t) => attr(t, "href"))[0];
  if (info.indexable) {
    if (!canon) fail(path, "no canonical");
    else {
      const c = new URL(canon);
      if (c.search) fail(path, `canonical carries a query string: ${canon}`);
      const cp = c.pathname.replace(/\/$/, "") || "/";
      if (cp !== path) fail(path, `canonical points elsewhere: ${canon}`);
    }
    const alts = Object.fromEntries(
      links(html, "alternate")
        .filter((t) => attr(t, "hreflang"))
        .map((t) => [attr(t, "hreflang"), attr(t, "href")])
    );
    for (const l of ["en", "fr", "x-default"]) if (!alts[l]) fail(path, `missing hreflang ${l}`);
  }

  // open graph / twitter
  if (info.indexable) {
    for (const p of ["og:title", "og:description", "og:image", "og:url", "og:type"]) {
      if (!metaContent(html, "property", p)) fail(path, `missing ${p}`);
    }
    const ogImg = metaContent(html, "property", "og:image");
    if (ogImg && !/^https?:\/\//.test(ogImg)) fail(path, `og:image is not absolute: ${ogImg}`);
    if (!metaContent(html, "name", "twitter:card")) fail(path, "missing twitter:card");
  }

  // headings
  info.h1 = (html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? []).map((h) => textOf(h));
  if (info.h1.length === 0) fail(path, "no <h1>");
  else if (info.h1.length > 1) fail(path, `${info.h1.length} <h1> elements: ${info.h1.map((h) => `"${h}"`).join(", ")}`);

  // images
  const imgs = tags(html, "img");
  const noAlt = imgs.filter((t) => attr(t, "alt") == null);
  if (noAlt.length) fail(path, `${noAlt.length} <img> without alt`);
  const emptyAlt = imgs.filter((t) => attr(t, "alt") === "" && !/aria-hidden="true"/.test(t));
  if (emptyAlt.length > 2) warn(path, `${emptyAlt.length} decorative images (empty alt) — fine if truly decorative`);

  // JSON-LD
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const types = [];
  for (const block of ld) {
    try {
      const j = JSON.parse(block);
      for (const node of Array.isArray(j) ? j : [j]) types.push(node["@type"]);
    } catch (e) {
      fail(path, `invalid JSON-LD: ${String(e).slice(0, 80)}`);
    }
  }
  info.ldTypes = types;
  if (info.indexable && types.length === 0) warn(path, "no JSON-LD");

  // words (thin content)
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  const words = textOf(mainMatch ? mainMatch[1] : html).split(" ").filter(Boolean).length;
  info.words = words;
  if (info.indexable && words < 200) warn(path, `thin page: ${words} words in <main>`);

  // links
  for (const a of tags(html, "a")) {
    const href = attr(a, "href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/.test(href)) continue;
    let u;
    try {
      u = new URL(href, url);
    } catch {
      fail(path, `unparsable href ${href}`);
      continue;
    }
    if (u.origin !== origin) continue;
    const p = u.pathname.replace(/\/$/, "") || "/";
    // the internal locale prefix must never reach the HTML
    if (/^\/(fr\/)?en(\/|$)/.test(p)) fail(path, `links to the internal /en/ path: ${href}`);
    if (!seen.has(p) && !skip(p)) {
      if (!foundOn.has(p)) foundOn.set(p, `${path} (href="${href}")`);
      queue.push(p);
    }
  }

  // sitemap membership
  if (info.indexable && !sitemapSet.has(path)) fail(path, "indexable page missing from sitemap.xml");
}

/* ── cross-page uniqueness ── */
const byTitle = new Map();
const byDesc = new Map();
const byH1 = new Map();
for (const [path, i] of seen) {
  if (i.status !== 200 || !i.indexable) continue;
  const lang = path === "/fr" || path.startsWith("/fr/") ? "fr" : "en";
  for (const [map, key] of [
    [byTitle, i.title],
    [byDesc, i.description],
    [byH1, i.h1[0]],
  ]) {
    if (!key) continue;
    const k = `${lang}::${key}`;
    map.set(k, [...(map.get(k) ?? []), path]);
  }
}
for (const [label, map] of [
  ["title", byTitle],
  ["description", byDesc],
  ["h1", byH1],
]) {
  for (const [key, paths] of map) {
    if (paths.length > 1) fail(paths.join(" + "), `duplicate ${label}: "${key.split("::")[1]}"`);
  }
}

/* ── sitemap entries that don't resolve ── */
for (const p of sitemapSet) {
  const i = seen.get(p);
  if (!i) continue;
  if (i.status !== 200) fail(p, `listed in sitemap but returns ${i.status}`);
  else if (!i.indexable) fail(p, "listed in sitemap but noindex");
}

/* ── robots.txt, llms.txt, manifest ── */
const rb = await get(`${BASE}/robots.txt`);
if (rb.status !== 200) fail("/robots.txt", `HTTP ${rb.status}`);
else {
  if (!/sitemap:/i.test(rb.body)) fail("/robots.txt", "no Sitemap: line");
  for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "OAI-SearchBot", "Google-Extended"]) {
    if (!rb.body.includes(bot)) warn("/robots.txt", `no explicit rule for ${bot}`);
  }
}
const llms = await get(`${BASE}/llms.txt`);
if (llms.status !== 200) warn("/llms.txt", "missing (AI answer engines read it when present)");
const mf = await get(`${BASE}/manifest.webmanifest`);
if (mf.status !== 200) warn("/manifest.webmanifest", `HTTP ${mf.status}`);

/* ── expected structured data on key pages ── */
const expectLd = {
  "/": ["VacationRental"],
  "/faq": ["FAQPage"],
  "/reviews": ["Review"],
  "/rates": ["AggregateOffer", "Offer", "Product", "VacationRental"],
  "/location": ["LodgingBusiness", "VacationRental"],
};
for (const [p, wanted] of Object.entries(expectLd)) {
  const i = seen.get(p);
  if (!i?.ldTypes) continue;
  if (!wanted.some((t) => i.ldTypes.flat().includes(t))) fail(p, `JSON-LD has ${JSON.stringify(i.ldTypes)}, expected one of ${wanted.join("/")}`);
}

/* ── report ── */
console.log(`crawled: ${seen.size} paths (${[...seen.values()].filter((i) => i.indexable).length} indexable)\n`);
console.log("── pages ──");
for (const [path, i] of [...seen].sort()) {
  if (i.status !== 200) continue;
  console.log(
    `${i.indexable ? "●" : "○"} ${path.padEnd(28)} ${String(i.words ?? "").padStart(5)}w  ${String(i.title.length).padStart(3)}t ${String(i.description.length).padStart(3)}d  ${(i.ldTypes ?? []).flat().join(",")}`
  );
}
if (warns.length) {
  console.log(`\n── ${warns.length} warning(s) ──`);
  for (const w of warns) console.log("  ⚠ " + w);
}
if (fails.length) {
  console.log(`\n── ${fails.length} failure(s) ──`);
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("\n✅ no failures");
