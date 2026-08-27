import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductProofScene } from "./product-proof-scene";

describe("ProductProofScene", () => {
	it("renders real product labels, safe values, and accessible views", () => {
		const html = renderToStaticMarkup(<ProductProofScene locale="en" />);
		expect(html).toContain('role="tablist"');
		expect(html).toContain("AI Visibility");
		expect(html).toContain("Share of Voice Leaderboard");
		expect(html).toContain("3,120");
		expect(html).toContain("Query Fan-Out");
		expect(html).toContain("Sample workspace");
		expect(html).not.toMatch(/customer result|guaranteed|benchmark/i);
	});
});
