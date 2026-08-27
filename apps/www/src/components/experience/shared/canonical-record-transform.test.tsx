import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanonicalRecordTransform } from "./canonical-record-transform";

describe("CanonicalRecordTransform", () => {
	it("renders the canonical fact once and attaches source, boundary, identity and review metadata", () => {
		const html = renderToStaticMarkup(<CanonicalRecordTransform locale="en" />);
		const fact = "AI-native MarTech infrastructure built for decisions made by people and shaped by agents.";
		expect(html.split(fact)).toHaveLength(2);
		for (const label of ["Public basis", "Boundary", "Stable identity", "Review date"]) expect(html).toContain(label);
		expect(html).toContain('type="range"');
		expect(html).not.toContain("token reduction");
	});
});
