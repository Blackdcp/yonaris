import { describe, expect, test } from "vitest";
import { getGeoContent } from "./geo";

const stageIds = ["discovery", "description", "comparison", "citation", "verification"] as const;

const claimContract = [
	{ id: "geo-first-applied-workflow", status: "managed-delivery" },
	{ id: "geo-configured-sampling", status: "managed-delivery" },
	{ id: "geo-reviewable-answers", status: "current-software" },
	{ id: "geo-configured-comparison", status: "current-software" },
	{ id: "geo-available-source-evidence", status: "current-software" },
	{ id: "geo-human-reviewed-verification", status: "managed-delivery" },
	{ id: "geo-diagnostic-scope-confirmation", status: "managed-delivery" },
	{ id: "geo-broader-martech-direction", status: "direction" },
] as const;

function referencedClaimIds(content: ReturnType<typeof getGeoContent>): string[] {
	return [
		...content.boundary.claimIds,
		...content.currentScopeClaimIds,
		...content.workflow.claimIds,
		...content.workflow.stages.flatMap((stage) => stage.claimIds),
		...content.evidenceBoundary.claimIds,
		...content.broaderCategory.claimIds,
		...content.diagnostic.claimIds,
	];
}

describe("GEO content truth model", () => {
	test("frames GEO as a five-lane applied workflow without making it the company category", () => {
		const english = getGeoContent("en");
		const chinese = getGeoContent("zh");

		expect(english.headline).toBe("GEO, grounded in evidence.");
		expect(chinese.headline).toBe("让 GEO 建立在证据之上");
		expect(english.boundary.summary).toBe(
			"GEO is the first applied workflow—not Yonaris's category ceiling.",
		);
		expect(english.workflow.stages.map(({ id }) => id)).toEqual(stageIds);
		expect(chinese.workflow.stages.map(({ id }) => id)).toEqual(stageIds);

		for (const content of [english, chinese]) {
			expect(content.category).toMatch(content === english ? /AI-native MarTech/ : /AI 原生营销科技/);
			expect(content.workflow.stages).toHaveLength(5);
			expect(
				content.workflow.stages.every(
					({ title, question, observedSignal, boundedAction, claimIds }) =>
						title.length > 0 &&
						question.length > 0 &&
						observedSignal.length > 0 &&
						boundedAction.length > 0 &&
						claimIds.length > 0,
				),
			).toBe(true);
			expect(content.broaderCategory.productLabel).toEqual(expect.any(String));
			expect(content.broaderCategory.companyLabel).toEqual(expect.any(String));
			expect(content.diagnostic.label).toEqual(expect.any(String));
		}
	});

	test("uses one canonical claim registry for every factual GEO section", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getGeoContent(locale);
			const registry = content.claims.map(({ id, status }) => ({ id, status }));
			const registryIds = content.claims.map(({ id }) => id);
			const references = referencedClaimIds(content);

			expect(registry).toEqual(claimContract);
			expect(new Set(registryIds).size).toBe(registryIds.length);
			expect(content.claims.every(({ limitation }) => limitation.trim().length > 0)).toBe(true);
			expect(
				content.claims.every(({ status }) => status !== "illustrative" && status !== "verified-evidence"),
			).toBe(true);
			expect(references.every((id) => registryIds.includes(id))).toBe(true);
			expect(new Set(references)).toEqual(new Set(registryIds));
		}
	});

	test("declares configured scope, evidence availability, unknowns, non-causality, and human review", () => {
		const english = getGeoContent("en");
		const chinese = getGeoContent("zh");
		const enTruth = [english.currentScope, ...english.claims.map(({ text, limitation }) => `${text} ${limitation}`)].join(
			" ",
		);
		const zhTruth = [chinese.currentScope, ...chinese.claims.map(({ text, limitation }) => `${text} ${limitation}`)].join(
			" ",
		);

		expect(enTruth).toMatch(/configured questions/i);
		expect(enTruth).toMatch(/configured competitor cohort/i);
		expect(enTruth).toMatch(/when (?:a supported surface|the surface) exposes/i);
		expect(enTruth).toMatch(/missing evidence remains unknown/i);
		expect(enTruth).toMatch(/does not (?:independently )?prove causation/i);
		expect(enTruth).toMatch(/human-reviewed/i);
		expect(enTruth).toMatch(/scope.*confirmed.*before collection/i);

		expect(zhTruth).toMatch(/已配置的问题/);
		expect(zhTruth).toMatch(/已配置的竞品集合/);
		expect(zhTruth).toMatch(/界面.*公开/);
		expect(zhTruth).toMatch(/证据缺失.*未知/);
		expect(zhTruth).toMatch(/不能.*证明因果关系/);
		expect(zhTruth).toMatch(/人工审核/);
		expect(zhTruth).toMatch(/采集前.*确认范围/);
	});

	test("makes diagnostic review timing and the absence of an immediate result visible", () => {
		const english = getGeoContent("en");
		const chinese = getGeoContent("zh");

		expect(english.diagnostic.disclosure).toMatch(/scope review.*before collection/i);
		expect(english.diagnostic.disclosure).toMatch(/does not produce an immediate evidence result/i);
		expect(chinese.diagnostic.disclosure).toMatch(/范围审核.*再开始采集/);
		expect(chinese.diagnostic.disclosure).toMatch(/不会立即产生证据结果/);
	});

	test("writes the direction claim as future intent rather than present activity", () => {
		const english = getGeoContent("en").claims.find(({ id }) => id === "geo-broader-martech-direction");
		const chinese = getGeoContent("zh").claims.find(({ id }) => id === "geo-broader-martech-direction");

		expect(english?.status).toBe("direction");
		expect(english?.text).toMatch(/Yonaris intends to build/i);
		expect(english?.text).not.toMatch(/Yonaris is (?:building|developing)/i);
		expect(chinese?.status).toBe("direction");
		expect(chinese?.text).toMatch(/Yonaris 计划构建/);
		expect(chinese?.text).not.toMatch(/Yonaris 正在/);
	});

	test("rejects maturity theatre, fake outcomes, and autonomous performance claims", () => {
		for (const locale of ["en", "zh"] as const) {
			const serialized = JSON.stringify(getGeoContent(locale));
			for (const prohibited of [
				/\brank(?:ing|ings)?\b/i,
				/\btraffic\b/i,
				/\bguarantee(?:d|s)?\b/i,
				/\ball[- ]model\b/i,
				/\breal[- ]time\b/i,
				/\bcontinuous coverage\b/i,
				/\binstant (?:scan|score)\b/i,
				/\bself[- ]service (?:run|runs)\b/i,
				/\bautomat(?:e|ed|ic) (?:fixes|publishing|optimization)\b/i,
				/\bcausal lift\b/i,
				/Product Truth Graph/i,
				/0\s*(?:→|->)\s*93\.3\s*%?/,
				/\blive sample(?:s)?\b/i,
				/\bbefore\s*\/\s*after result(?:s)?\b/i,
				/排名|流量|保证|所有模型|实时覆盖|持续覆盖|即时(?:扫描|评分)|自助运行|自动(?:修复|发布|优化)|因果提升|产品事实图谱|真实客户样本|前后结果/,
			]) {
				expect(serialized).not.toMatch(prohibited);
			}
		}
	});
});
