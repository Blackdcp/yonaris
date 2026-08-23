import { describe, expect, test } from "vitest";
import { getResearchContent } from "./research";

const claimContract = [
	{ id: "research-declared-scope", status: "current-software" },
	{ id: "research-visibility-definition", status: "current-software" },
	{ id: "research-configured-sov-definition", status: "current-software" },
	{ id: "research-repeat-observation", status: "current-software" },
	{ id: "research-illustrative-record", status: "illustrative" },
] as const;

function referencedClaimIds(content: ReturnType<typeof getResearchContent>): string[] {
	return [
		...content.currentScopeClaimIds,
		...content.measurement.claimIds,
		...content.metrics.flatMap((metric) => metric.claimIds),
		...content.comparison.claimIds,
		...content.nonCausalityClaimIds,
		...content.record.claimIds,
		...content.homePreview.claimIds,
	];
}

describe("Research content truth model", () => {
	test("publishes the approved bilingual ledger with exact metric denominators", () => {
		const english = getResearchContent("en");
		const chinese = getResearchContent("zh");

		expect(english.headline).toBe("Every finding should show its scope.");
		expect(chinese.headline).toBe("每一项结论，都应说明它成立的范围");
		expect(english.metrics.map(({ id }) => id)).toEqual(["visibility", "share-of-voice"]);
		expect(chinese.metrics.map(({ id }) => id)).toEqual(["visibility", "share-of-voice"]);

		const visibility = english.metrics.find(({ id }) => id === "visibility");
		expect(visibility).toMatchObject({
			numerator: "Valid sampled answers that mention the tracked brand.",
			denominator: "All valid sampled answers in the active declared filter.",
		});
		const shareOfVoice = english.metrics.find(({ id }) => id === "share-of-voice");
		expect(shareOfVoice).toMatchObject({
			numerator: "Tracked-brand mentions in the declared cohort.",
			denominator:
				"Tracked-brand mentions plus configured-competitor mentions in the same declared cohort.",
		});

		for (const content of [english, chinese]) {
			expect(content.homePreview).toMatchObject({
				title: expect.any(String),
				scope: expect.any(String),
				denominator: expect.any(String),
				limitation: expect.any(String),
			});
			expect(content.measurement.scopeItems.length).toBeGreaterThanOrEqual(5);
			expect(content.nonCausalityNote).toMatch(
				content === english ? /does not independently establish causation/i : /不能独立证明因果关系/,
			);
		}
	});

	test("uses one canonical claim registry for every factual Research group", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getResearchContent(locale);
			const registry = content.claims.map(({ id, status }) => ({ id, status }));
			const registryIds = content.claims.map(({ id }) => id);
			const references = referencedClaimIds(content);

			expect(registry).toEqual(claimContract);
			expect(new Set(registryIds).size).toBe(registryIds.length);
			expect(content.claims.every((claim) => claim.limitation.trim().length > 0)).toBe(true);
			expect(content.claims.every(({ status }) => status !== "verified-evidence" && status !== "direction")).toBe(
				true,
			);
			expect(content.metrics.every(({ claimIds }) => claimIds.length > 0)).toBe(true);
			expect(content.currentScopeClaimIds.length).toBeGreaterThan(0);
			expect(content.measurement.claimIds.length).toBeGreaterThan(0);
			expect(content.comparison.claimIds.length).toBeGreaterThan(0);
			expect(content.record.claimIds.length).toBeGreaterThan(0);
			expect(content.homePreview.claimIds.length).toBeGreaterThan(0);
			expect(new Set(references)).toEqual(new Set(registryIds));
			expect(references.every((id) => registryIds.includes(id))).toBe(true);
		}
	});

	test("models one visibly illustrative fictional record with known and unknown evidence states", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getResearchContent(locale);
			const record = content.record;

			expect(record).toMatchObject({
				id: "illustrative-record-01",
				status: "illustrative",
				sampleCount: 1,
				question: expect.any(String),
				surface: expect.any(String),
				answer: expect.any(String),
			});
			expect(record.label).toBe(locale === "en" ? "Illustrative" : "示例");
			expect(record.observedAtIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(record.observedAtLabel).toContain("2026");
			expect(record.citations.state).toBe("known");
		if (record.citations.state === "known") {
			expect(record.citations.value.length).toBeGreaterThan(0);
			expect(record.citations.value.every(({ text }) => text.includes(".example"))).toBe(true);
		}
			expect(record.exposedQueries.state).toBe("unknown");
		if (record.exposedQueries.state === "unknown") {
			expect(record.exposedQueries.reason).toMatch(
				locale === "en" ? /does not establish that no search occurred/i : /不能证明.*没有发生搜索/,
			);
		}
			expect(record.findings.length).toBeGreaterThan(0);
			expect(record.unknowns.length).toBeGreaterThan(0);
		}
	});

	test("does not present a customer outcome, ranking, lift, percentage, or causal result", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getResearchContent(locale);
			const serialized = JSON.stringify(content);
			const assertions = [
				...content.claims.map(({ text }) => text),
				...content.metrics.map(({ definition }) => definition),
				...content.record.findings.map(({ text }) => text),
			].join(" ");

			expect(serialized).not.toMatch(/\d+(?:\.\d+)?\s*(?:%|％)/);
			expect(serialized).not.toMatch(/0\s*(?:→|->)\s*93\.3/);
			expect(assertions).not.toMatch(/\blift\b|\brank(?:ing)?\b|\bcaused\b|提升了|排名|导致了/i);
			expect(content.limitations.join(" ")).toMatch(
				locale === "en" ? /No customer outcome is published/i : /没有发布任何客户结果/,
			);
		}
	});
});
