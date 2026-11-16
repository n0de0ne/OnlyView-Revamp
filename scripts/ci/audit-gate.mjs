#!/usr/bin/env node
/**
 * Dependency audit gate. Fails on any HIGH or CRITICAL advisory affecting the
 * production dependencies, except the ones listed (with a reason and a review
 * date) in .github/audit-allowlist.json. An entry past its review date fails
 * too, so known issues get looked at again instead of being forgotten.
 *
 *   node scripts/ci/audit-gate.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const allow = JSON.parse(fs.readFileSync(path.join(ROOT, ".github/audit-allowlist.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);

const r = spawnSync("npm", ["audit", "--omit=dev", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
let report;
try {
  report = JSON.parse(r.stdout);
} catch {
  console.error("npm audit did not return JSON:\n" + r.stdout + r.stderr);
  process.exit(1);
}

const SEVERE = new Set(["high", "critical"]);
const found = new Map(); // advisory id -> {pkg, severity, title, url}
for (const [pkg, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via !== "object" || !SEVERE.has(via.severity)) continue;
    const id = via.url?.split("/").pop() ?? `${pkg}:${via.source}`;
    found.set(id, { pkg, severity: via.severity, title: via.title, url: via.url });
  }
}

const lines = ["## Dependency audit (production deps, high + critical)"];
const blocking = [];
const accepted = [];
for (const [id, a] of found) {
  const entry = allow.advisories?.[id];
  if (!entry) blocking.push({ id, ...a, why: "new advisory" });
  else if (entry.review && entry.review < today) blocking.push({ id, ...a, why: `allowlist entry expired on ${entry.review}` });
  else accepted.push({ id, ...a, reason: entry.reason });
}

const row = (a) => `| ${a.severity} | \`${a.pkg}\` | [${a.id}](${a.url}) ${a.title ?? ""} |`;
if (blocking.length) {
  lines.push("\n### ❌ Blocking", "| severity | package | advisory |", "|---|---|---|", ...blocking.map((a) => row(a) + ` ${a.why}`));
  lines.push("\nFix: `npm audit fix` (or upgrade the package). If it can't be fixed yet, add it to `.github/audit-allowlist.json` with a reason and a review date.");
}
if (accepted.length) {
  lines.push(`\n<details><summary>${accepted.length} known advisories accepted until their review date</summary>\n`, "| severity | package | advisory |", "|---|---|---|", ...accepted.map(row), "\n</details>");
}
const stale = Object.keys(allow.advisories ?? {}).filter((id) => !found.has(id));
if (stale.length) lines.push(`\nNo longer reported, can be removed from the allowlist: ${stale.join(", ")}`);
if (!blocking.length) lines.push("\nNo new high or critical advisory. ✅");

const text = lines.join("\n");
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
process.exit(blocking.length ? 1 : 0);
