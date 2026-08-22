import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@/": new URL("./src/", import.meta.url).pathname,
		},
	},
	test: {
		include: ["src/lib/marketing-content.test.ts", "src/components/marketing/diagnostic-form.test.tsx"],
		environment: "node",
	},
});
