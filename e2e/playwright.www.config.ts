import { defineConfig, devices } from "@playwright/test";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export default defineConfig({
	testDir: "./www-tests",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	timeout: 30_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: "http://127.0.0.1:3001",
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
		command: `${pnpm} --filter @workspace/www dev --host 127.0.0.1`,
		url: "http://127.0.0.1:3001",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
