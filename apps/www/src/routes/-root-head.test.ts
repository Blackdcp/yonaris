import { describe, expect, it } from "vitest";
import { Route } from "./__root";

describe("root document head", () => {
	it("uses the Site 06 paper color for browser chrome before a page-specific head resolves", () => {
		const head = (Route.options.head as () => { meta: Array<Record<string, string>> })();
		expect(head.meta).toContainEqual({ name: "theme-color", content: "#f2ede3" });
		expect(head.meta).not.toContainEqual({ name: "theme-color", content: "#f6f4f1" });
	});
});
