import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/lib/marketing-content.test.ts"],
		environment: "node",
	},
});
