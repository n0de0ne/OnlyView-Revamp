#!/usr/bin/env node
/**
 * Schema safety gate — catches the schema changes that keep the production
 * container from booting (see the 2026-10-26 outage: an @unique added to an
 * existing table made the entrypoint's `prisma db push` refuse, and the site
 * stayed down).
 *
 * The entrypoint runs `prisma db push` WITHOUT --accept-data-loss on every
 * boot, so only additive, warning-free changes are safe to ship:
 * new tables, new nullable or defaulted columns, plain indexes.
 *
 *   node scripts/ci/schema-safety.mjs <base-git-ref> [--prepare-only]
 *
 * 1. Static check (always): diffs the base schema against this one with
 *    `prisma migrate diff` and fails on any statement that is not additive.
 * 2. Live check (when DATABASE_URL is set, CI's throwaway Postgres): builds a
 *    database on the BASE schema, seeds it with the base seed + demo data,
 *    then runs the exact `db push` the entrypoint runs with the new schema,
 *    then the new seed. Both must succeed.
 *
 * --prepare-only stops after seeding the base database, so the real image's
 * entrypoint can do the upgrade itself (the CI boot test).
 *
 * Point DATABASE_URL at an EMPTY throwaway database only (CI's service
 * container): the rehearsal writes demo data into it.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const SCHEMA = "prisma/schema.prisma";
const PRISMA = path.join(ROOT, "node_modules/prisma/build/index.js");
const baseRef = process.argv[2];
const prepareOnly = process.argv.includes("--prepare-only");
if (!baseRef) {
  console.error("usage: node scripts/ci/schema-safety.mjs <base-git-ref>");
  process.exit(2);
}

const summary = [];
const out = (line = "") => {
  console.log(line);
  summary.push(line);
};
const writeSummary = () => {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
};
const fail = (msg) => {
  out(`\n❌ ${msg}`);
  writeSummary();
  process.exit(1);
};

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const prisma = (args, opts = {}) =>
  spawnSync(process.execPath, [PRISMA, ...args], { cwd: ROOT, encoding: "utf8", ...opts });

// ── base schema ────────────────────────────────────────────────────────────
let baseSchema;
try {
  baseSchema = git("show", `${baseRef}:${SCHEMA}`);
} catch {
  out(`No ${SCHEMA} at ${baseRef}: nothing to compare, skipping.`);
  writeSummary();
  process.exit(0);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "schema-safety-"));
const basePath = path.join(tmp, "base.prisma");
fs.writeFileSync(basePath, baseSchema);

out("## Prisma schema safety");
out(`Compared with \`${baseRef}\`.`);

// ── 1. static diff ─────────────────────────────────────────────────────────
const diff = prisma([
  "migrate", "diff",
  "--from-schema-datamodel", basePath,
  "--to-schema-datamodel", SCHEMA,
  "--script",
]);
if (diff.status !== 0) fail(`prisma migrate diff failed:\n${diff.stderr}`);

const sql = diff.stdout
  .split("\n")
  .filter((l) => !l.startsWith("--") && l.trim() !== "")
  .join("\n");
if (!sql.trim()) {
  out("\nNo schema change. ✅");
} else {
  out("\n<details><summary>SQL the entrypoint's db push will apply</summary>\n\n```sql\n" + sql + "\n```\n</details>");
}

const statements = sql
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.replace(/\s+/g, " ").trim())
  .filter(Boolean);

const created = new Set(
  statements.map((s) => s.match(/^CREATE TABLE "([^"]+)"/)?.[1]).filter(Boolean)
);

const problems = [];
for (const s of statements) {
  const table = s.match(/^(?:ALTER TABLE|DROP TABLE|CREATE (?:UNIQUE )?INDEX "[^"]+" ON) "([^"]+)"/)?.[1];
  const isNew = table && created.has(table);
  const add = (why) => problems.push({ why, sql: s });

  if (/^DROP TABLE/.test(s)) add("drops a table (its rows would be lost)");
  else if (/^DROP TYPE/.test(s)) add("drops an enum");
  else if (/^ALTER TYPE .* RENAME/.test(s)) add("renames an enum value");
  else if (/^ALTER TYPE/.test(s) && !/ADD VALUE/.test(s)) add("changes an enum");
  else if (/^CREATE UNIQUE INDEX/.test(s) && !isNew)
    add("adds a unique constraint to an existing table (the 2026-10-26 outage)");
  else if (/^ALTER TABLE/.test(s) && !isNew) {
    if (/DROP COLUMN/.test(s)) add("drops a column (its data would be lost)");
    if (/RENAME/.test(s)) add("renames something (Prisma drops and re-creates it)");
    if (/ALTER COLUMN "[^"]+" SET DATA TYPE|ALTER COLUMN "[^"]+" TYPE /.test(s)) add("changes a column type");
    if (/SET NOT NULL/.test(s)) add("makes a column required");
    if (/ADD CONSTRAINT "[^"]+" (UNIQUE|PRIMARY KEY)/.test(s)) add("adds a unique/primary key constraint to an existing table");
    if (/DROP CONSTRAINT "[^"]+_pkey"/.test(s)) add("changes a primary key");
    // ADD COLUMN ... NOT NULL without DEFAULT fails on a table that has rows
    for (const col of s.matchAll(/ADD COLUMN\s+"([^"]+)"\s+([^,]+)/g)) {
      const def = col[2];
      if (/NOT NULL/.test(def) && !/DEFAULT/.test(def)) add(`adds required column "${col[1]}" without a default`);
    }
  }
}

if (problems.length) {
  out("\n### ❌ Changes the production boot would refuse or that lose data");
  for (const p of problems) out(`- **${p.why}**\n  \`${p.sql.slice(0, 300)}\``);
  out(
    "\nThe container runs `prisma db push` without `--accept-data-loss` at every boot, " +
      "so this change would keep the site down. Make it additive instead: a nullable or " +
      "defaulted column, a new table, a plain `@@index` (enforce uniqueness in code), " +
      "and keep old columns until a planned manual migration."
  );
  fail(`${problems.length} unsafe schema change(s).`);
}
if (sql.trim()) out("\nStatic check: every change is additive. ✅");

// ── 2. live upgrade rehearsal ──────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  out("\nLive upgrade rehearsal skipped (no DATABASE_URL).");
  writeSummary();
  process.exit(0);
}
if (!/localhost|127\.0\.0\.1|postgres:5432/.test(process.env.DATABASE_URL) && process.env.SCHEMA_SAFETY_ANY_DB !== "1") {
  fail("DATABASE_URL does not look like CI's throwaway database; refusing to write demo data into it.");
}

const run = (label, cmd, args, opts = {}) => {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status !== 0) {
    const tail = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim().split("\n").slice(-25).join("\n");
    fail(`${label} failed:\n\n\`\`\`\n${tail}\n\`\`\``);
  }
  return r;
};

// a base checkout for its seed (it must match the base schema's client)
const baseDir = path.join(tmp, "base");
git("worktree", "add", "--detach", baseDir, baseRef);
// fail() exits the process, which skips `finally`: clean up on exit too
process.on("exit", () => {
  try {
    execFileSync("git", ["worktree", "remove", "--force", baseDir], { cwd: ROOT, stdio: "ignore" });
  } catch {}
});
try {
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(baseDir, "node_modules"));
  const node = process.execPath;
  const basePrisma = ["--schema", path.join(baseDir, SCHEMA)];

  run("create the base schema on the empty database", node, [PRISMA, "db", "push", "--skip-generate", ...basePrisma]);
  run("generate the base client", node, [PRISMA, "generate", ...basePrisma]);
  run("seed with the base seed + demo data (stands in for production rows)", node, ["prisma/seed.mjs"], {
    cwd: baseDir,
    env: { ...process.env, SEED_DEMO: "1" },
  });

  if (prepareOnly) {
    out("\nDatabase ready on the base schema with demo data; the image's entrypoint does the upgrade. ✅");
  } else {
    // exactly what scripts/docker-entrypoint.sh runs on boot
    run("db push with the new schema, as the entrypoint does (no --accept-data-loss)", node, [PRISMA, "db", "push", "--skip-generate", "--schema", SCHEMA]);
    run("generate the new client", node, [PRISMA, "generate", "--schema", SCHEMA]);
    run("new seed on the upgraded database", node, ["prisma/seed.mjs"]);
    run("new seed again (it must stay idempotent across reboots)", node, ["prisma/seed.mjs"]);
    out("\nLive upgrade rehearsal (base schema + data → new schema, as on boot): ✅");
  }
} finally {
  // the base client was generated last in --prepare-only: put this branch's back
  if (prepareOnly) prisma(["generate", "--schema", SCHEMA]);
  try {
    git("worktree", "remove", "--force", baseDir);
  } catch {}
}
writeSummary();
