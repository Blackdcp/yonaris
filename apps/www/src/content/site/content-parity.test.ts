import { describe, expect, it } from "vitest";
import {
	CORE_PAGE_KEYS,
	getApproachContent,
	getCompanyContent,
	getCoreFacts,
	getCorePageContent,
	getDiagnosticContent,
	getGeoContent,
	getGlobalContent,
	getProductContent,
	getResearchContent,
	getResourcesContent,
} from "./index";
import { deepFreeze } from "./types";

function structureOf(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(structureOf);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, nested]) => [key, structureOf(nested)]),
		);
	}
	return typeof value;
}

describe("core site content", () => {
	it("keeps every independently authored locale structurally compatible", () => {
		for (const key of CORE_PAGE_KEYS) {
			const english = getCorePageContent(key, "en");
			const chinese = getCorePageContent(key, "zh");

			expect(structureOf(chinese)).toEqual(structureOf(english));
			expect(chinese).not.toBe(english);
			expect(chinese.meta.title).not.toBe(english.meta.title);
		}
	});

	it("keeps stable claim identities and statuses across locales", () => {
		for (const key of CORE_PAGE_KEYS) {
			const english = getCoreFacts(key, "en");
			const chinese = getCoreFacts(key, "zh");

			expect(chinese.claims.map(({ id, status }) => ({ id, status }))).toEqual(
				english.claims.map(({ id, status }) => ({ id, status })),
			);
			expect(english.limitations.length).toBeGreaterThan(0);
			expect(chinese.limitations.length).toBeGreaterThan(0);
		}
	});

	it("keeps Resources structurally compatible with stable claim identities and statuses", () => {
		const english = getResourcesContent("en");
		const chinese = getResourcesContent("zh");

		expect(structureOf(chinese)).toEqual(structureOf(english));
		expect(chinese.claims.map(({ id, status }) => ({ id, status }))).toEqual(
			english.claims.map(({ id, status }) => ({ id, status })),
		);
		expect(english.limitations.length).toBeGreaterThan(0);
		expect(chinese.limitations.length).toBeGreaterThan(0);
	});

	it("expresses the English direction claim as future intent", () => {
		expect(getGlobalContent("en").claims.find(({ status }) => status === "direction")?.text).toBe(
			"Yonaris intends to build MarTech that serves human teams and software agents from a shared factual core.",
		);
	});

	it("expresses the Chinese direction claim as future intent", () => {
		expect(getGlobalContent("zh").claims.find(({ status }) => status === "direction")?.text).toBe(
			"Yonaris 计划构建一套让人类团队与软件智能体共享同一事实基础的 MarTech。",
		);
	});

	it("prevents nested page object mutations from changing later getter results", () => {
		const product = getProductContent("en");
		const originalSummary = product.activities[0].summary;
		let objectWriteThrew = false;
		try {
			(product.activities[0] as { summary: string }).summary = "corrupted summary";
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			objectWriteThrew = true;
		}
		const laterSummary = getProductContent("en").activities[0].summary;
		if (!objectWriteThrew) {
			(product.activities[0] as { summary: string }).summary = originalSummary;
		}

		expect({ objectWriteThrew, laterSummary }).toEqual({
			objectWriteThrew: true,
			laterSummary: originalSummary,
		});
	});

	it("keeps Product workbench identities and claim statuses aligned across independently authored locales", () => {
		const english = getProductContent("en");
		const chinese = getProductContent("zh");
		const shape = (content: typeof english | typeof chinese) => ({
			activities: content.activities.map((activity) => ({
				id: activity.id,
				claims: activity.claims.map(({ id, status }) => ({ id, status })),
			})),
			views: content.workbench.views.map((view) => ({
				id: view.id,
				claims: view.claims.map(({ id, status }) => ({ id, status })),
				fieldStates: view.fields.map(({ state }) => state),
			})),
			workspace: [content.workspaceBoundary.customer, content.workspaceBoundary.yonaris].map((section) =>
				section.claims.map(({ id, status }) => ({ id, status })),
			),
			coverage: content.coverage.claims.map(({ id, status }) => ({ id, status })),
			homePreview: content.homePreview.claims.map(({ id, status }) => ({ id, status })),
		});

		expect(shape(chinese)).toEqual(shape(english));
		expect(chinese.headline).not.toBe(english.headline);
		expect(chinese.workbench.ui.tabListLabel).not.toBe(english.workbench.ui.tabListLabel);
	});

	it("keeps Approach loop identities and claim references aligned across independently authored locales", () => {
		const english = getApproachContent("en");
		const chinese = getApproachContent("zh");
		const shape = (content: typeof english | typeof chinese) => ({
			claims: content.claims.map(({ id, status }) => ({ id, status })),
			currentScopeClaimIds: content.currentScopeClaimIds,
			methodClaimIds: content.method.claimIds,
			loopClaimIds: content.loop.claimIds,
			nonCausalityClaimIds: content.nonCausalityClaimIds,
			steps: content.loop.steps.map(({ id, claimIds }) => ({ id, claimIds })),
			homePreviewClaimIds: content.homePreview.claimIds,
		});

		expect(shape(chinese)).toEqual(shape(english));
		expect(chinese.headline).not.toBe(english.headline);
		expect(chinese.loop.ui.processLabel).not.toBe(english.loop.ui.processLabel);
	});

	it("keeps Research metric, evidence, and claim identities aligned across independently authored locales", () => {
		const english = getResearchContent("en");
		const chinese = getResearchContent("zh");
		const availabilityShape = <T>(
			availability: { state: "known"; value: readonly T[] } | { state: "unknown"; reason: string },
		) =>
			availability.state === "known"
				? { state: availability.state, itemIds: availability.value.map((item) => (item as { id: string }).id) }
				: { state: availability.state };
		const shape = (content: typeof english | typeof chinese) => ({
			claims: content.claims.map(({ id, status }) => ({ id, status })),
			currentScopeClaimIds: content.currentScopeClaimIds,
			measurementClaimIds: content.measurement.claimIds,
			measurementItemIds: content.measurement.scopeItems.map(({ id }) => id),
			metrics: content.metrics.map(({ id, claimIds }) => ({ id, claimIds })),
			comparisonClaimIds: content.comparison.claimIds,
			nonCausalityClaimIds: content.nonCausalityClaimIds,
			record: {
				id: content.record.id,
				status: content.record.status,
				claimIds: content.record.claimIds,
				citations: availabilityShape(content.record.citations),
				exposedQueries: availabilityShape(content.record.exposedQueries),
				findingIds: content.record.findings.map(({ id }) => id),
				unknownIds: content.record.unknowns.map(({ id }) => id),
			},
			homePreviewClaimIds: content.homePreview.claimIds,
		});

		expect(shape(chinese)).toEqual(shape(english));
		expect(chinese.headline).not.toBe(english.headline);
		expect(chinese.labels.known).not.toBe(english.labels.known);
	});

	it("keeps Company reader, principle, and claim references aligned across independently authored locales", () => {
		const english = getCompanyContent("en");
		const chinese = getCompanyContent("zh");
		const shape = (content: typeof english | typeof chinese) => ({
			claims: content.claims.map(({ id, status }) => ({ id, status })),
			visionClaimIds: content.vision.claimIds,
			marketShift: {
				claimIds: content.marketShift.claimIds,
				readerIds: content.marketShift.readers.map(({ id }) => id),
			},
			stageClaimIds: content.stage.claimIds,
			forestClaimIds: content.forest.claimIds,
			principleIds: content.principles.items.map(({ id }) => id),
			openSourceClaimIds: content.openSource.claimIds,
			currentScopeClaimIds: content.currentScopeClaimIds,
		});

		expect(shape(chinese)).toEqual(shape(english));
		expect(chinese.vision.headline).not.toBe(english.vision.headline);
		expect(chinese.marketShift.groupLabel).not.toBe(english.marketShift.groupLabel);
	});

	it("prevents nested page array mutations from changing later getter results", () => {
		const research = getResearchContent("en");
		const originalFindingCount = research.record.findings.length;
		let arrayWriteThrew = false;
		try {
			(research.record.findings as { id: string; text: string }[]).push({
				id: "corrupted-finding",
				text: "corrupted finding",
			});
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			arrayWriteThrew = true;
		}
		const laterFindingCount = getResearchContent("en").record.findings.length;
		if (!arrayWriteThrew) {
			(research.record.findings as { id: string; text: string }[]).pop();
		}

		expect({ arrayWriteThrew, laterFindingCount }).toEqual({
			arrayWriteThrew: true,
			laterFindingCount: originalFindingCount,
		});
	});

	it("makes the projected core facts object immutable", () => {
		const facts = getCoreFacts("product", "en");
		const originalScope = facts.currentScope;
		let scopeWriteThrew = false;
		try {
			(facts as { currentScope: string }).currentScope = "corrupted scope";
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			scopeWriteThrew = true;
		}

		expect(scopeWriteThrew).toBe(true);
		expect(getCoreFacts("product", "en").currentScope).toBe(originalScope);
	});

	it("prevents projected claim mutations from changing canonical claims", () => {
		const facts = getCoreFacts("product", "en");
		const originalClaimText = facts.claims[0].text;
		let claimWriteThrew = false;
		try {
			(facts.claims[0] as { text: string }).text = "corrupted claim";
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			claimWriteThrew = true;
		}
		const laterClaimText = getCoreFacts("product", "en").claims[0].text;
		if (!claimWriteThrew) {
			(facts.claims[0] as { text: string }).text = originalClaimText;
		}

		expect({ claimWriteThrew, laterClaimText }).toEqual({
			claimWriteThrew: true,
			laterClaimText: originalClaimText,
		});
	});

	it("prevents projected limitation mutations from changing canonical limitations", () => {
		const facts = getCoreFacts("product", "en");
		const originalLimitationCount = facts.limitations.length;
		let limitationWriteThrew = false;
		try {
			(facts.limitations as string[]).push("corrupted limitation");
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			limitationWriteThrew = true;
		}
		const laterLimitationCount = getCoreFacts("product", "en").limitations.length;
		if (!limitationWriteThrew) {
			(facts.limitations as string[]).pop();
		}

		expect({ limitationWriteThrew, laterLimitationCount }).toEqual({
			limitationWriteThrew: true,
			laterLimitationCount: originalLimitationCount,
		});
	});

	it("freezes mutable descendants of an already frozen wrapper", () => {
		const nested = { description: "mutable child" };
		const wrapper = Object.freeze({ nested });

		deepFreeze(wrapper);

		let nestedWriteThrew = false;
		try {
			nested.description = "corrupted child";
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			nestedWriteThrew = true;
		}

		expect({ nestedWriteThrew, description: nested.description }).toEqual({
			nestedWriteThrew: true,
			description: "mutable child",
		});
	});

	it("freezes cyclic descendants of an already frozen wrapper", () => {
		const nested: { wrapper?: object; description: string } = { description: "cyclic child" };
		const wrapper = Object.freeze({ nested });
		nested.wrapper = wrapper;

		expect(() => deepFreeze(wrapper)).not.toThrow();

		let nestedWriteThrew = false;
		try {
			nested.description = "corrupted child";
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			nestedWriteThrew = true;
		}

		expect({ nestedWriteThrew, description: nested.description }).toEqual({
			nestedWriteThrew: true,
			description: "cyclic child",
		});
	});

	it("describes the Chinese company stage as a company", () => {
		expect(getCompanyContent("zh").stage.summary).toBe(
			"Yonaris 是一家早期公司，正以服务驱动的方式交付一套真实可用的市场证据产品",
		);
	});

	it("uses the approved Chinese wording for branded and non-branded questions", () => {
		expect(getApproachContent("zh").loop.steps.find(({ id }) => id === "question-set")?.summary).toContain(
			"品牌相关与非品牌相关的问题",
		);
	});

	it("uses 查询改写 consistently for query rewrites", () => {
		expect(getApproachContent("zh").loop.steps.find(({ id }) => id === "compare")?.summary).toContain("查询改写");
		expect(getProductContent("zh").claims.find(({ id }) => id === "product-reviewable-evidence")?.text).toContain(
			"查询改写",
		);
	});

	it("models the approved present scope and evidence boundaries", () => {
		expect(getGlobalContent("en")).toMatchObject({
			category: "AI-native MarTech",
			vision: "MarTech, rebuilt. For humans and agents.",
		});
		expect(getProductContent("en").claims.map(({ id, status }) => ({ id, status }))).toEqual([
			{ id: "product-configured-scope", status: "current-software" },
			{ id: "product-configured-sampling", status: "managed-delivery" },
			{ id: "product-reviewable-evidence", status: "current-software" },
			{ id: "product-reviewed-opportunities", status: "managed-delivery" },
		]);
		expect(getApproachContent("en").limitations.join(" ")).toContain(
			"do not by themselves prove what caused the change",
		);
		expect(getResearchContent("en").record.label).toBe("Illustrative");
		expect(getResearchContent("en").claims.find(({ id }) => id === "research-illustrative-record")?.status).toBe(
			"illustrative",
		);
		expect(getCompanyContent("en").stage.summary).toContain("early company");
		expect(getCompanyContent("en").stage.summary).toContain("service-led model");
		expect(getGeoContent("en").boundary).toContain("first applied workflow");
		expect(getDiagnosticContent("en").confirmation).toContain(
			"confirms the measurement scope before collecting evidence",
		);
	});

	it("excludes prohibited claims from every core page", () => {
		const serialized = JSON.stringify(
			CORE_PAGE_KEYS.flatMap((key) => [getCorePageContent(key, "en"), getCorePageContent(key, "zh")]),
		);
		for (const banned of [
			"Product Truth Graph",
			"Commercial Feedback",
			"0% → 93.3%",
			"automatic optimization",
			"产品事实图谱",
			"商业反馈",
			"自动优化",
		]) {
			expect(serialized).not.toContain(banned);
		}
	});
});
