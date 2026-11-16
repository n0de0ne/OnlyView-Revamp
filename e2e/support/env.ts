import path from "node:path";

/**
 * Where the suites run. Nothing here points at production by default: the
 * target is always given by E2E_BASE_URL (a staging, or a local server).
 */
export const BASE_URL = (process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** Back-office account the suites sign in with: an owner, with its password already changed. */
export const ADMIN_USER = process.env.E2E_ADMIN_USER ?? process.env.ADMIN_USER ?? "admin";
export const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? process.env.ADMIN_PASS ?? "";
export const HAS_ADMIN = ADMIN_PASS !== "";

/** Saved back-office session (written by auth.setup.ts, never committed). */
export const AUTH_FILE = path.join(__dirname, "..", ".auth", "admin.json");

/**
 * The live site: tests that create, change or send anything never run there.
 * Read-only tests (pages render, SEO, map, gallery…) still can.
 */
const PROD_HOSTS = (process.env.E2E_PROD_HOSTS ?? "onlyviewstbarth.com,www.onlyviewstbarth.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
export const IS_PRODUCTION = PROD_HOSTS.includes(new URL(BASE_URL).hostname.toLowerCase());
export const WRITES_ALLOWED = !IS_PRODUCTION;

/** Every record a test creates carries this prefix: it is how leftovers are found and removed. */
export const MARK = "E2E";
