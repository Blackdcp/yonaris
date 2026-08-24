import { defineConfig, devices } from "@playwright/test";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rawPort = process.env.WWW_E2E_PORT ?? "3001";
if (!/^\d+$/.test(rawPort)) {
	throw new Error(`WWW_E2E_PORT must be an integer from 1 to 65535; received ${JSON.stringify(rawPort)}`);
}
const port = Number(rawPort);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
	throw new Error(`WWW_E2E_PORT must be an integer from 1 to 65535; received ${JSON.stringify(rawPort)}`);
}
const baseURL = `http://127.0.0.1:${port}`;
const supersededBilingualPageSpecs = [
	"homepage.spec.ts",
	"product.spec.ts",
	"approach.spec.ts",
	"research.spec.ts",
	"company.spec.ts",
	"geo.spec.ts",
	"diagnostic.spec.ts",
] as const;

export default defineConfig({
	testDir: "./www-tests",
	// These specs describe the retired shared English/Chinese presentation. The two
	// independent regional editions are guarded by dual-region-release.spec.ts.
	testIgnore: ["diagnostic-analytics.spec.ts", ...supersededBilingualPageSpecs],
	outputDir: "test-results-www",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	timeout: 30_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: `${pnpm} --filter @workspace/www exec vite dev --host 127.0.0.1 --port ${port} --strictPort`,
		env: {
			...process.env,
			VITE_PLAUSIBLE_DOMAIN: "",
			VITE_POSTHOG_KEY: "",
			VITE_POSTHOG_HOST: "",
			WWW_E2E_OFFLINE: "true",
		},
		url: baseURL,
		reuseExistingServer: process.env.WWW_E2E_REUSE_SERVER === "true",
		timeout: 120_000,
	},
});
