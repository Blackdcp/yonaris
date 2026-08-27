import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	resolve: {
		alias: {
			"@/": `${path.resolve(dirname, "./src")}/`,
		},
		dedupe: ["react", "react-dom"],
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					env: {
						APP_URL: "http://localhost:3000",
					},
					include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
					exclude: [...configDefaults.exclude, "src/**/*.browser.test.tsx"],
				},
			},
			{
				extends: true,
				plugins: [tailwindcss()],
				resolve: {
					alias: {
						"@tanstack/react-start/server": path.resolve(dirname, "src/stories/_mocks/tanstack-start.ts"),
						"@tanstack/react-start": path.resolve(dirname, "src/stories/_mocks/tanstack-start.ts"),
					},
				},
				test: {
					name: "browser-runtime",
					include: ["src/**/*.browser.test.tsx"],
					browser: {
						commands: {
							emulateMedia: async (context, media: "screen" | "print") => {
								await context.page.emulateMedia({ media });
							},
						},
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [{ browser: "chromium" }],
					},
				},
			},
			{
				extends: true,
				plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
				test: {
					name: "storybook",
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
