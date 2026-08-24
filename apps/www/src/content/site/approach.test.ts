import { describe, expect, test } from "vitest";
import { getApproachContent } from "./approach";

const stepIds = ["frame", "question-set", "sample", "compare", "inspect", "repeat"] as const;

function referencedClaimIds(content: ReturnType<typeof getApproachContent>): string[] {
	return [
		...content.currentScopeClaimIds,
		...content.method.claimIds,
		...content.loop.claimIds,
		...content.loop.steps.flatMap((step) => step.claimIds),
		...content.nonCausalityClaimIds,
		...content.homePreview.claimIds,
	];
}

describe("Approach content truth model", () => {
	test("presents the approved bilingual evidence loop and six ordered steps", () => {
		const english = getApproachContent("en");
		const chinese = getApproachContent("zh");

		expect(english.headline).toBe("A repeatable evidence loop, not a generic score.");
		expect(chinese.headline).toBe("建立可重复的证据循环，而不是制造一个泛化分数");
		expect(english.loop.steps.map(({ id }) => id)).toEqual(stepIds);
		expect(chinese.loop.steps.map(({ id }) => id)).toEqual(stepIds);
		expect(english.homePreview.steps).toHaveLength(3);
		expect(chinese.homePreview.steps).toHaveLength(3);
		expect(english.nonCausalityNote).toBe(
			"Repeated observations show change over time; they do not by themselves prove what caused the change.",
		);
		expect(chinese.nonCausalityNote).toBe("重复观察能够呈现变化，但仅凭这些观察无法证明变化由什么造成");
	});

	test("keeps one canonical claim registry and backs every visible factual group", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getApproachContent(locale);
			const registryIds = content.claims.map(({ id }) => id);
			const references = referencedClaimIds(content);

			expect(new Set(registryIds).size).toBe(registryIds.length);
			expect(content.claims.every((claim) => claim.status && claim.limitation.trim().length > 0)).toBe(true);
			expect(content.currentScopeClaimIds.length).toBeGreaterThan(0);
			expect(content.method.claimIds.length).toBeGreaterThan(0);
			expect(content.loop.claimIds.length).toBeGreaterThan(0);
			expect(content.nonCausalityClaimIds.length).toBeGreaterThan(0);
			expect(content.homePreview.claimIds.length).toBeGreaterThan(0);
			expect(content.loop.steps.every((step) => step.claimIds.length > 0)).toBe(true);
			expect(new Set(references)).toEqual(new Set(registryIds));
			expect(references.every((id) => registryIds.includes(id))).toBe(true);
		}
	});

	test("aligns claim and step identities while localizing prose independently", () => {
		const english = getApproachContent("en");
		const chinese = getApproachContent("zh");
		const shape = (content: typeof english | typeof chinese) => ({
			claims: content.claims.map(({ id, status }) => ({ id, status })),
			steps: content.loop.steps.map(({ id, claimIds }) => ({ id, claimIds })),
		});

		expect(shape(chinese)).toEqual(shape(english));
		expect(chinese.loop.ui.processLabel).not.toBe(english.loop.ui.processLabel);
		expect(chinese.loop.ui.evidenceRecordLabel).not.toBe(english.loop.ui.evidenceRecordLabel);
		expect(chinese.loop.steps.map(({ title }) => title)).not.toEqual(english.loop.steps.map(({ title }) => title));
	});

	test("describes Evidence Framework only as a working method", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getApproachContent(locale);
			const serialized = JSON.stringify(content);
			const methodName = locale === "en" ? "Evidence Framework" : "递归森林";
			const occurrences = serialized.split(methodName).length - 1;

			expect(content.method.name).toBe(methodName);
			expect(content.method.boundary).toMatch(locale === "en" ? /working method/i : /工作方法/);
			expect(content.method.boundary).toMatch(locale === "en" ? /not .*product architecture/i : /不是.*产品架构/);
			expect(occurrences).toBeGreaterThanOrEqual(2);
			expect(serialized).not.toMatch(
				locale === "en" ? /Evidence Framework (product|module|system)/i : /递归森林(产品|模块|系统)/,
			);
		}
	});

	test("uses generic process artifacts without presenting customer evidence", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getApproachContent(locale);
			for (const step of content.loop.steps) {
				expect(step.evidenceLabel.trim().length).toBeGreaterThan(0);
				expect(step.evidenceValue.trim().length).toBeGreaterThan(0);
			}
			const evidence = JSON.stringify(content.loop.steps);
			expect(evidence).not.toMatch(/\b\d+(?:\.\d+)?%\b/);
			expect(evidence).not.toMatch(/Northstar|customer result|客户结果/i);
		}
	});

	test("does not overstate the method or smuggle in prohibited claims", () => {
		const content = [getApproachContent("en"), getApproachContent("zh")];
		const serialized = JSON.stringify(content);
		const claimText = content.flatMap(({ claims }) => claims.map(({ text }) => text)).join(" ");

		expect(serialized).not.toMatch(/Product Evidence Graph|产品事实图谱/);
		expect(serialized).not.toMatch(/0\s*(?:%|％)?\s*(?:→|->)\s*93\.3\s*(?:%|％)?/);
		expect(claimText).not.toMatch(/autonomous|real[- ]time|universal|causal lift|自主运行|实时|全量覆盖|因果提升/i);
	});
});
