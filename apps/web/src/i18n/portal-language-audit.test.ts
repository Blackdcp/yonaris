import { describe, expect, it } from "vitest";
import {
	CROSS_PLAN_OWNERSHIP,
	type CrossPlanOwnership,
	collectPortalLanguageCandidatesFromSource,
	runPortalLanguageAudit,
	validateCrossPlanOwnership,
	validateExactClassifications,
} from "../../scripts/portal-language-audit";
import type { LiteralClassification } from "../../scripts/portal-language-audit-manifest";

describe("portal UI-language literal audit", () => {
	it("collects every contracted visible-literal family from syntax rather than English-only matching", () => {
		const source = `
			export function Sample({ error, rawValue }: { error: Error; rawValue: string }) {
				const status = "pending".charAt(0).toUpperCase();
				toast.error("Could not save");
				return <section title="Visible title" aria-label={\`Raw value \${rawValue}\`}>
					<h1>Plain heading</h1>
					<p>{\`Template \${rawValue}\`}</p>
					<span>{"Joined " + rawValue}</span>
					<time>{new Date().toLocaleDateString("en-US")}</time>
					<pre>{error.message}</pre>
				</section>;
			}
		`;

		const candidates = collectPortalLanguageCandidatesFromSource("sample.tsx", source);

		expect(candidates.map(({ kind }) => kind)).toEqual(
			expect.arrayContaining([
				"jsx-text",
				"text-prop",
				"toast-dialog-copy",
				"template-prose",
				"concatenated-prose",
				"display-locale",
				"status-capitalization",
				"raw-error-interpolation",
			]),
		);
		expect(candidates).toContainEqual(
			expect.objectContaining({ kind: "text-prop", value: `\`Raw value \${rawValue}\`` }),
		);
	});

	it("rejects unclassified candidates, stale entries, and broad matchers", () => {
		const candidates = collectPortalLanguageCandidatesFromSource("sample.tsx", "export const x = <p>Visible copy</p>;");
		const exact: LiteralClassification = {
			file: "sample.tsx",
			kind: "jsx-text",
			value: "Visible copy",
			occurrence: 1,
			category: "proper-noun",
			reason: "Controlled exact fixture.",
		};

		expect(validateExactClassifications(candidates, [])).toEqual(
			expect.arrayContaining([expect.stringContaining("unclassified")]),
		);
		expect(validateExactClassifications([], [exact])).toEqual(
			expect.arrayContaining([expect.stringContaining("stale")]),
		);
		expect(validateExactClassifications(candidates, [{ ...exact, file: "apps/web/src/**" }])).toEqual(
			expect.arrayContaining([expect.stringContaining("broad matcher")]),
		);

		const proseWithEquals = collectPortalLanguageCandidatesFromSource(
			"sample.tsx",
			"export const x = <p>Status = Ready</p>;",
		);
		expect(validateExactClassifications(proseWithEquals, [])).toEqual(
			expect.arrayContaining([expect.stringContaining("unclassified")]),
		);
	});

	it("keeps every deferred output-language surface assigned to an exact owner and task", () => {
		const repositoryRoot = new URL("../../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
		expect(validateCrossPlanOwnership(repositoryRoot)).toEqual([]);
		expect(CROSS_PLAN_OWNERSHIP).toHaveLength(12);
		expect(CROSS_PLAN_OWNERSHIP).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: "apps/web/src/components/base-chart-print.tsx",
					owner: "portal-output-languages",
					task: "Task 4",
				}),
				expect.objectContaining({
					file: "apps/web/src/components/chart-export-preview.tsx",
					owner: "portal-output-languages",
					task: "Task 4",
				}),
			]),
		);

		const incomplete = [
			{
				file: "apps/web/src/components/missing-output-surface.tsx",
				owner: "",
				task: "",
				reason: "",
			} as unknown as CrossPlanOwnership,
		];
		const errors = validateCrossPlanOwnership(repositoryRoot, incomplete);
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("cross-plan owner is empty")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("cross-plan task is empty")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("stale cross-plan ownership")]));
		expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("missing cross-plan ownership")]));
	});

	it("keeps the current portal tree, route headers, and shared compatibility call sites classified", () => {
		const result = runPortalLanguageAudit();
		const categoryCounts = result.classifications.reduce<Record<string, number>>((counts, entry) => {
			counts[entry.category] = (counts[entry.category] ?? 0) + 1;
			return counts;
		}, {});
		console.info(
			`[portal-language-audit] files=${result.filesAudited} candidates=${result.candidates.length} classifications=${result.classifications.length} categories=${JSON.stringify(categoryCounts)}`,
		);

		expect(result.errors, result.errors.join("\n")).toEqual([]);
		expect(result.filesAudited).toBeGreaterThan(100);
		expect(result.candidates.length).toBeGreaterThan(100);
		expect(result.classifications.length).toBeGreaterThan(0);
	});
});
