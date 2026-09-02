/**
 * Mobile audit of a running instance, on a real phone viewport.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_USER=admin ADMIN_PASS=… node scripts/mobile-audit.mjs
 *
 * Renders every public page (both languages) and the main admin screens at
 * 390×844 (iPhone 15/16) with Chromium, and reports what breaks on a phone:
 *   - horizontal overflow (the page is wider than the screen) and which
 *     elements cause it
 *   - tap targets under 40 px (links, buttons, inputs)
 *   - text under 13 px that is not decorative
 *   - fixed elements covering each other (header / tab bar collisions)
 *   - inputs whose font-size is under 16 px (iOS zooms into them)
 * and saves a screenshot of the top of each page plus a full-page capture
 * under ./mobile-audit/ so the layout can be eyeballed.
 *
 * Exit code 1 on any overflow. Needs Playwright (npm i -D playwright, or a
 * global install) and its Chromium.
 */
import { mkdirSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = process.env.OUT_DIR ?? "mobile-audit";
const ADMIN_USER = process.env.ADMIN_USER ?? "";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = (await import("/opt/node22/lib/node_modules/playwright/index.js")).default ?? {});
}
if (!chromium) {
  console.error("playwright not found");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

/* ── which pages ── */
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const pages = [...new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname))].sort();
const adminPages = ADMIN_USER
  ? ["/admin", "/admin/calendar", "/admin/reservations", "/admin/reservations/new", "/admin/clients", "/admin/finance", "/admin/contracts", "/admin/settings", "/admin/requests", "/admin/agencies"]
  : [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();

if (ADMIN_USER) {
  await page.goto(`${BASE}/admin/login`);
  await page.fill("input#username", ADMIN_USER);
  await page.fill("input#password", ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 }).catch(() => {});
}

/** everything measured in the page, in one evaluate */
const MEASURE = () => {
  const vw = window.innerWidth;
  const sel = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    const txt = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` “${txt}”` : ""}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };

  // 1. overflow
  // scrollWidth misses content clipped by overflow-x:hidden — measure the
  // widest visible element too, since a clipped button is just as unusable
  let maxRight = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" && cs.pointerEvents === "none") continue;
    const scroller = el.parentElement?.closest(".overflow-x-auto, .overflow-auto, .scroll-thin, [style*='overflow']");
    if (scroller && getComputedStyle(scroller).overflowX !== "visible") continue;
    const r = el.getBoundingClientRect();
    if (r.width > 8 && r.width < vw * 3 && r.top < window.innerHeight * 6) maxRight = Math.max(maxRight, r.right);
  }
  const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, Math.round(maxRight));
  const wide = [];
  if (docW > vw + 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 8 && visible(el)) {
        // skip children of an already-listed offender
        if (wide.some((w) => w.el.contains(el))) continue;
        const cs = getComputedStyle(el);
        // scrollable containers are fine — they're meant to scroll
        const scroller = el.closest("[style*='overflow'], .overflow-x-auto, .overflow-auto, .scroll-thin");
        if (scroller && scroller !== el && getComputedStyle(scroller).overflowX !== "visible") continue;
        if (cs.position === "fixed" && r.left >= vw) continue; // off-screen panels
        wide.push({ el, s: `${sel(el)} right=${Math.round(r.right)} w=${Math.round(r.width)}` });
      }
    }
  }

  // 2. tap targets
  const small = [];
  for (const el of document.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, [role=button]")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight * 6) continue;
    if (Math.min(r.width, r.height) < 40 && r.width < 200) {
      // inline links inside a paragraph are exempt (they're text)
      if (el.tagName === "A" && el.closest("p, li, td, dd, figcaption")) continue;
      // a checkbox/radio inside its <label> — the label is the hit area
      if (el.tagName === "INPUT" && /checkbox|radio/.test(el.type) && el.closest("label")) continue;
      small.push(`${sel(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }

  // 3. tiny text
  const tiny = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();
    if (t.length < 3) continue;
    const el = n.parentElement;
    if (!el || !visible(el) || el.closest("script, style, .sr-only, [aria-hidden=true]")) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 13) tiny.add(`${sel(el)} ${fs.toFixed(1)}px`);
  }

  // 4. inputs iOS zooms into
  const zoomy = [];
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")) {
    if (!visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) zoomy.push(`${sel(el)} ${fs.toFixed(1)}px`);
  }

  // 5. fixed elements overlapping each other
  const fixed = [...document.querySelectorAll("body *")].filter(
    (el) => getComputedStyle(el).position === "fixed" && visible(el) && getComputedStyle(el).pointerEvents !== "none"
  );
  const overlaps = [];
  for (let i = 0; i < fixed.length; i++)
    for (let j = i + 1; j < fixed.length; j++) {
      if (fixed[i].contains(fixed[j]) || fixed[j].contains(fixed[i])) continue;
      const a = fixed[i].getBoundingClientRect(), b = fixed[j].getBoundingClientRect();
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 20 && y > 20 && a.width < vw * 1.5 && b.width < vw * 1.5) overlaps.push(`${sel(fixed[i])} × ${sel(fixed[j])}`);
    }

  return {
    vw,
    docW,
    wide: wide.map((w) => w.s).slice(0, 8),
    small: small.slice(0, 12),
    tiny: [...tiny].slice(0, 10),
    zoomy: zoomy.slice(0, 8),
    overlaps: overlaps.slice(0, 6),
    h: document.documentElement.scrollHeight,
  };
};

const results = [];
let failures = 0;
for (const path of [...pages, ...adminPages]) {
  const url = `${BASE}${path}`;
  const errors = [];
  const onErr = (e) => errors.push(String(e).slice(0, 120));
  page.on("pageerror", onErr);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    results.push({ path, error: String(e).slice(0, 80) });
    page.off("pageerror", onErr);
    continue;
  }
  await page.waitForTimeout(400);
  const m = await page.evaluate(MEASURE);
  const slug = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "home";
  await page.screenshot({ path: `${OUT}/${slug}.png` });
  await page.screenshot({ path: `${OUT}/${slug}.full.png`, fullPage: true });
  // also the scrolled state (bars collapsed) for the public site
  page.off("pageerror", onErr);
  const overflow = m.docW > m.vw + 1;
  if (overflow) failures++;
  results.push({ path, ...m, errors, overflow });
}

/* ── report ── */
console.log(`viewport 390×844 · ${results.length} pages · screenshots in ./${OUT}/\n`);
for (const r of results) {
  if (r.error) {
    console.log(`✗ ${r.path}  could not load: ${r.error}`);
    continue;
  }
  const flags = [
    r.overflow ? `OVERFLOW ${r.docW}px` : null,
    r.small.length ? `${r.small.length} small taps` : null,
    r.tiny.length ? `${r.tiny.length} tiny text` : null,
    r.zoomy.length ? `${r.zoomy.length} zoom inputs` : null,
    r.overlaps.length ? `${r.overlaps.length} fixed overlaps` : null,
    r.errors.length ? `${r.errors.length} js errors` : null,
  ].filter(Boolean);
  console.log(`${r.overflow ? "✗" : flags.length ? "⚠" : "✓"} ${r.path.padEnd(30)} ${String(r.h).padStart(6)}px tall  ${flags.join(" · ")}`);
  for (const w of r.wide) console.log(`     ↔ ${w}`);
  for (const s of r.small) console.log(`     ◦ tap ${s}`);
  for (const s of r.tiny) console.log(`     ◦ text ${s}`);
  for (const s of r.zoomy) console.log(`     ◦ zoom ${s}`);
  for (const s of r.overlaps) console.log(`     ◦ overlap ${s}`);
  for (const s of r.errors) console.log(`     ◦ js ${s}`);
}
await browser.close();
if (failures) {
  console.log(`\n${failures} page(s) overflow the screen`);
  process.exit(1);
}
console.log("\n✅ nothing overflows");
