import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { newClient } from "./support/api";
import { ADMIN_PASS, ADMIN_USER, AUTH_FILE, BASE_URL, HAS_ADMIN } from "./support/env";

/**
 * Signs in to the back-office once and keeps the session for every suite.
 * Without credentials the suites still run: tests that need the back-office
 * are skipped, the public read-only ones go ahead.
 */
setup("target is up", async () => {
  const visitor = await newClient();
  const res = await visitor.get("/api/availability");
  await visitor.dispose();
  expect(res.status, `${BASE_URL} does not answer: is E2E_BASE_URL right and the site started?`).toBe(200);
});

setup("sign in to the back-office", async () => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.rmSync(AUTH_FILE, { force: true });
  setup.skip(!HAS_ADMIN, "no E2E_ADMIN_PASS: back-office tests will be skipped");

  const client = await newClient();
  const res = await client.post("/api/admin/login", { username: ADMIN_USER, password: ADMIN_PASS });
  expect(
    res.status,
    res.status === 429
      ? "too many failed sign-ins from this address: wait 15 minutes"
      : `sign-in as "${ADMIN_USER}" on ${BASE_URL} was refused: check E2E_ADMIN_USER / E2E_ADMIN_PASS`
  ).toBe(200);
  expect(
    res.body.mustChangePassword,
    `"${ADMIN_USER}" still has its first password: sign in once by hand and change it (the back-office blocks every screen until then)`
  ).toBe(false);
  expect(res.body.user.role, "the suites need an owner account (finance, settings and users are owner-only)").toBe("owner");
  await client.ctx.storageState({ path: AUTH_FILE });
  await client.dispose();
});
