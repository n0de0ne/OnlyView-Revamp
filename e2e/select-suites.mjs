#!/usr/bin/env node
/**
 * Which E2E suites does a change call for?
 *
 *   node e2e/select-suites.mjs                 suites for the files changed against origin/main (+ uncommitted work)
 *   node e2e/select-suites.mjs --base=v1.4     …against another ref
 *   node e2e/select-suites.mjs src/lib/pricing.ts src/app/api/quote/route.ts
 *   node e2e/select-suites.mjs --run [-- playwright options]     run them (npm run e2e:changed)
 *   node e2e/select-suites.mjs --json          machine-readable, for a CI step
 *
 * The map of files to suites is e2e/suites.json. Prints `--project=…` flags
 * for `playwright test`, or nothing when no suite is concerned (docs only).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(path.join(here, "suites.json"), "utf8"));
const ALL = Object.keys(map.suites);

/** Glob → RegExp: `**` any depth, `*` within a folder, `{a,b}` alternatives, `[[]` a literal bracket. */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (glob.startsWith("[[]", i)) (re += "\\["), (i += 2);
    else if (glob.startsWith("**/", i)) (re += "(?:.*/)?"), (i += 2);
    else if (glob.startsWith("**", i)) (re += ".*"), (i += 1);
    else if (c === "*") re += "[^/]*";
    else if (c === "{") re += "(?:";
    else if (c === "}") re += ")";
    else if (c === ",") re += "|";
    else re += c.replace(/[.+?^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
const matcher = (globs) => {
  const res = globs.map(globToRegExp);
  return (file) => res.some((r) => r.test(file));
};
const isEverything = matcher(map.everything);
const suiteMatchers = Object.entries(map.suites).map(([name, globs]) => [name, matcher(globs)]);

export function suitesFor(files) {
  const picked = new Set();
  const reasons = {};
  const note = (suite, file) => (reasons[suite] ??= []).push(file);
  for (const file of files) {
    if (isEverything(file)) {
      for (const s of ALL) picked.add(s), note(s, file);
      continue;
    }
    const hits = suiteMatchers.filter(([, m]) => m(file)).map(([name]) => name);
    if (hits.length) for (const s of hits) picked.add(s), note(s, file);
    // application code nobody listed: run everything rather than nothing
    else if (/^(src|prisma)\//.test(file)) for (const s of ALL) picked.add(s), note(s, `${file} (not in suites.json)`);
  }
  const suites = ALL.filter((s) => picked.has(s));
  return { suites: suites.length ? ["smoke", ...suites.filter((s) => s !== "smoke")] : [], reasons };
}

function changedFiles(base) {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
  const out = new Set();
  try {
    for (const f of git("diff", "--name-only", `${base}...HEAD`)) out.add(f);
  } catch {
    console.error(`select-suites: cannot compare with "${base}" (fetch it, or pass --base=<ref>); using uncommitted changes only`);
  }
  for (const f of git("diff", "--name-only", "HEAD")) out.add(f);
  for (const f of git("ls-files", "--others", "--exclude-standard")) out.add(f);
  return [...out];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const split = argv.indexOf("--");
  const own = split >= 0 ? argv.slice(0, split) : argv;
  const passThrough = split >= 0 ? argv.slice(split + 1) : [];
  const flag = (name) => own.includes(`--${name}`);
  const base = own.find((a) => a.startsWith("--base="))?.slice(7) ?? process.env.E2E_BASE_REF ?? "origin/main";
  const given = own.filter((a) => !a.startsWith("--"));
  const files = given.length ? given : changedFiles(base);
  const { suites, reasons } = suitesFor(files);

  if (flag("json")) {
    console.log(JSON.stringify({ suites, reasons, files }, null, 2));
  } else if (flag("run")) {
    if (!suites.length) {
      console.log("No E2E suite is concerned by these changes.");
      process.exit(0);
    }
    console.log(`E2E suites for this change: ${suites.join(", ")}`);
    const res = spawnSync("npx", ["playwright", "test", ...suites.map((s) => `--project=${s}`), ...passThrough], { stdio: "inherit" });
    process.exit(res.status ?? 1);
  } else {
    if (flag("why")) for (const s of suites) console.error(`${s}: ${[...new Set(reasons[s] ?? ["always"])].slice(0, 5).join(", ")}`);
    console.log(suites.map((s) => `--project=${s}`).join(" "));
  }
}
