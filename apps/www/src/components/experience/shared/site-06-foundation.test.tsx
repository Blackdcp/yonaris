import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrbitField } from "./orbit-field";
import { ReadingLens } from "./reading-lens";

describe("Site 06 shared foundation", () => {
	it("renders one meaningful orbit and an accessible dual reading", () => {
		const lens = renderToStaticMarkup(
			<ReadingLens
				locale="en"
				initialId="scope"
				records={[
					{
						id: "scope",
						prompt: "What is the scope?",
						human: "Human context",
						meaning: "Decision meaning",
						fact: "Canonical fact",
						evidence: "Public company statement",
						boundary: "No outcome guarantee",
						stableId: "yonaris.scope.martech-system",
					},
				]}
			/>,
		);
		const orbit = renderToStaticMarkup(
			<OrbitField label="Shared public fact">
				<p>Fact</p>
			</OrbitField>,
		);
		expect(lens).toContain('role="tablist"');
		expect(lens).toContain("For people");
		expect(lens).toContain("For agents");
		expect(lens).toContain("Fact");
		expect(lens).toContain("Evidence");
		expect(lens).toContain("Boundary");
		expect(lens).toContain("Stable ID");
		expect(orbit.match(/data-orbit-ring=/g) ?? []).toHaveLength(3);
	});
});
