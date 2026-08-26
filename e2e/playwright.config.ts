import { defineConfig, devices } from "@playwright/test";
import { ADMIN_AUTH_STATE_PATH } from "./auth-setup";
import { CUSTOMER_AUTH_STATE_PATH } from "./customer-auth-setup";
import { LANGUAGE_SMOKE_AUTH_STATE_PATH } from "./language-auth-setup";

// Base URL can be overridden via environment variable.
// Default: http://localhost:1515 (Docker Compose maps web:3000 → host:1515)
const BASE_URL = process.env.BASE_URL || "http://localhost:1515";
const parsedBaseUrl = new URL(BASE_URL);
if (!["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname)) {
  throw new Error(`E2E BASE_URL must use a loopback host; refusing ${parsedBaseUrl.hostname}`);
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "on-failure" }]],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  maxFailures: process.env.CI ? 10 : 5,

  // CI invokes Playwright in three phases inside the same job. The first
  // phase creates the authenticated storage state; later phases explicitly
  // reuse it so they do not repeatedly hit Better Auth's sign-in rate limit.
  globalSetup: process.env.E2E_SKIP_AUTH_SETUP === "true" ? undefined : "./auth-setup.ts",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    storageState: CUSTOMER_AUTH_STATE_PATH,
  },

  projects: [
    {
      name: "fixtures",
      testIgnore: /(worker|sampling|portal-language)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "language-smoke",
      testMatch: /portal-language\.spec\.ts/,
      outputDir: "test-results-language-smoke",
      workers: 1,
      use: { ...devices["Desktop Chrome"], storageState: LANGUAGE_SMOKE_AUTH_STATE_PATH },
    },
    // Sampling mutates its own frozen delivery manifest and is intentionally
    // serialized after the read-only fixture suite. It never opens a real AI
    // surface or invokes a paid provider; the test proves the internal
    // evidence/ledger/analytics path only.
    {
      name: "sampling",
      testMatch: /sampling\.spec\.ts/,
      outputDir: "test-results-sampling",
      workers: 1,
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_AUTH_STATE_PATH },
    },
    // Run explicitly by CI phase 2 (--project=worker) once the worker
    // container is up; `pnpm test:e2e` stays worker-free so a bare local run
    // doesn't hang on (or feed a paid job to) whatever worker happens to be
    // running. Separate outputDir because Playwright wipes the output dir of
    // every project it runs — sharing test-results/ would delete phase 1's
    // traces and the Bruno reports before CI uploads them. The timeout leaves
    // room for the spec's 120s poll (worker startup + one pg-boss retry).
    {
      name: "worker",
      testMatch: /worker\.spec\.ts/,
      outputDir: "test-results-worker",
      timeout: 150_000,
      use: { ...devices["Desktop Chrome"], storageState: { cookies: [], origins: [] } },
    },
  ],
});
