import { defineConfig, devices } from "@playwright/test";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rawPort = process.env.WWW_ANALYTICS_E2E_PORT ?? "3002";
if (!/^\d+$/.test(rawPort)) {
	throw new Error(`WWW_ANALYTICS_E2E_PORT must be an integer from 1 to 65535; received ${JSON.stringify(rawPort)}`);
}
const port = Number(rawPort);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
	throw new Error(`WWW_ANALYTICS_E2E_PORT must be an integer from 1 to 65535; received ${JSON.stringify(rawPort)}`);
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: "./www-tests",
	testMatch: "diagnostic-analytics.spec.ts",
	outputDir: "test-results-www/analytics",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: "list",
	timeout: 45_000,
	expect: { timeout: 12_000 },
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: `${pnpm} --filter @workspace/www exec vite dev --host 127.0.0.1 --port ${port} --strictPort`,
		env: {
			...process.env,
			VITE_PLAUSIBLE_DOMAIN: "analytics.yonaris.test",
			VITE_POSTHOG_KEY: "phc_diagnostic_privacy_test",
			VITE_POSTHOG_HOST: `${baseURL}/test-posthog`,
		},
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
