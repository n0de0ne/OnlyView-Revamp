import { test as teardown } from "@playwright/test";
import fs from "node:fs";
import { newAdminClient } from "./support/api";
import { AUTH_FILE, HAS_ADMIN, WRITES_ALLOWED } from "./support/env";
import { sweep } from "./support/sweep";

/**
 * Runs after the suites (and alone with `npm run e2e:cleanup`): removes the
 * "E2E …" records a failed or interrupted test left on the target.
 */
teardown("remove leftover test records", async () => {
  teardown.skip(!HAS_ADMIN || !WRITES_ALLOWED || !fs.existsSync(AUTH_FILE), "nothing was created");
  const admin = await newAdminClient();
  const removed = await sweep(admin);
  await admin.dispose();
  const summary = Object.entries(removed).map(([kind, n]) => `${n} ${kind}`).join(", ");
  if (summary) console.log(`  leftovers removed: ${summary}`);
});
