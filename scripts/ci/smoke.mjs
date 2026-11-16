#!/usr/bin/env node
/**
 * Boot smoke test — run against the real production image, started on a
 * database that was upgraded from the previous schema (see the "Checks"
 * workflow). It answers one question before an image is published: does the
 * site start and serve its main pages, public and admin?
 *
 *   BASE_URL=http://localhost:3000 ADMIN_PASS=… node scripts/ci/smoke.mjs
 *
 * Read-only: it logs in and reads pages, it never creates or deletes data.
 * The full scenario suites (booking, contracts, payments…) are the E2E suites,
 * run on staging.
 */
import fs from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "onlyview2026";
const results = [];

async function get(path, { cookie, redirect = "manual" } = {}) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, { redirect, headers: cookie ? { cookie } : {} });
  const body = await res.text();
  return { status: res.status, body, ms: Date.now() - t0, location: res.headers.get("location") };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// a page that renders and isn't Next's error page
const page = (path, opts = {}) =>
  check(`GET ${path}`, async () => {
    const r = await get(path, opts);
    expect(r.status === 200, `status ${r.status}`);
    expect(!/Application error|Internal Server Error/i.test(r.body), "error page rendered");
    expect(/<html/i.test(r.body), "no HTML document");
    return `${r.ms} ms`;
  });

// ── wait for the container ───────────────────────────────────────────────
const deadline = Date.now() + Number(process.env.SMOKE_WAIT_MS ?? 120_000);
for (;;) {
  try {
    const r = await get("/api/availability");
    if (r.status === 200) break;
  } catch {}
  if (Date.now() > deadline) {
    console.error(`❌ ${BASE} did not answer /api/availability in time (the container's healthcheck).`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 2000));
}

// ── public site, EN + FR ────────────────────────────────────────────────
const PUBLIC = [
  "/", "/villa", "/gallery", "/rates", "/booking", "/map", "/guide", "/pointe-milou",
  "/why-book-direct", "/reviews", "/faq", "/contact", "/legal", "/privacy", "/tour",
];
for (const p of PUBLIC) await page(p);
for (const p of ["/fr", "/fr/villa", "/fr/rates", "/fr/booking", "/fr/map", "/fr/contact"]) await page(p);

await check("GET /api/availability returns JSON", async () => {
  const r = await get("/api/availability");
  JSON.parse(r.body);
});
for (const p of ["/sitemap.xml", "/robots.txt", "/llms.txt"]) {
  await check(`GET ${p}`, async () => {
    const r = await get(p);
    expect(r.status === 200 && r.body.length > 20, `status ${r.status}`);
  });
}
await check("unknown page answers 404", async () => {
  const r = await get("/this-page-does-not-exist-ci");
  expect(r.status === 404, `status ${r.status}`);
});
await check("legacy URL still redirects (SEO)", async () => {
  const r = await get("/pricing.php");
  expect([301, 307, 308].includes(r.status), `status ${r.status}`);
});

// ── admin ───────────────────────────────────────────────────────────────
await check("admin is gated", async () => {
  const r = await get("/admin");
  expect([302, 307].includes(r.status) && r.location?.includes("/admin/login"), `status ${r.status}`);
});
await page("/admin/login");

let cookie = "";
await check("admin login", async () => {
  const res = await fetch(BASE + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  expect(res.status === 200, `status ${res.status}`);
  cookie = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  expect(cookie.includes("ov_admin"), "no session cookie");
});
if (cookie) {
  const ADMIN = [
    "", "/reservations", "/calendar", "/clients", "/agencies", "/contracts", "/finance",
    // loyalty is left out: it 404s while the feature is switched off
    "/pricing", "/promotions", "/requests", "/concierge", "/concierge-requests", "/extras",
    "/map", "/guide", "/texts", "/site", "/analytics", "/users", "/settings",
  ];
  for (const p of ADMIN) await page(`/admin${p}`, { cookie });
}

// ── report ──────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
const lines = [
  "## Boot smoke test (production image, upgraded database)",
  `${results.length - failed.length}/${results.length} checks passed.`,
  ...(failed.length ? ["", "| ❌ check | detail |", "|---|---|", ...failed.map((r) => `| ${r.name} | ${r.detail} |`)] : []),
];
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
console.log("\n" + lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
process.exit(failed.length ? 1 : 0);
