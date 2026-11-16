import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { BASE_URL } from "./e2e/support/env";
import type { SuiteOptions } from "./e2e/support/fixtures";

type Project = NonNullable<PlaywrightTestConfig<SuiteOptions>["projects"]>[number];

/**
 * End-to-end suites, one Playwright project per area of the app, so a change
 * runs only what it touches:
 *
 *   E2E_BASE_URL=https://staging.example.com E2E_ADMIN_USER=… E2E_ADMIN_PASS=… npm run e2e
 *   npm run e2e -- --project=booking --project=contracts
 *   npm run e2e:changed          # the suites for the files changed against main
 *
 * See e2e/README.md.
 */

/** A suite = a folder of e2e/. `admin: true` opens its pages signed in to the back-office. */
const suite = (name: string, opts: { admin?: boolean } = {}): Project => ({
  name,
  testDir: `./e2e/${name}`,
  dependencies: ["setup"],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1366, height: 900 },
    signedIn: !!opts.admin,
  },
});

export default defineConfig<SuiteOptions>({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  // tests of one file share data (a stay, a contract…) and run in order
  fullyParallel: false,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }], ["junit", { outputFile: "e2e/.results/junit.xml" }]]
    : [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }]],
  use: {
    baseURL: BASE_URL,
    locale: "en-US",
    timezoneId: "America/St_Barthelemy",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // a staging behind HTTP basic auth: E2E_HTTP_USER / E2E_HTTP_PASS
    ...(process.env.E2E_HTTP_USER
      ? { httpCredentials: { username: process.env.E2E_HTTP_USER, password: process.env.E2E_HTTP_PASS ?? "" } }
      : {}),
  },
  projects: [
    // signs in to the back-office once; sweeps what earlier runs left behind when everything is done
    { name: "setup", testDir: "./e2e", testMatch: "auth.setup.ts", teardown: "cleanup" },
    { name: "cleanup", testDir: "./e2e", testMatch: "cleanup.teardown.ts" },

    suite("smoke"),
    suite("public"),
    suite("seo"),
    suite("gallery"),
    suite("map"),
    suite("booking"),
    suite("contracts"),
    suite("guest-portal"),
    suite("concierge-extras"),
    suite("analytics"),
    suite("admin-core", { admin: true }),
    suite("admin-reservations", { admin: true }),
    suite("admin-finance", { admin: true }),
    suite("admin-content", { admin: true }),
  ],
});
