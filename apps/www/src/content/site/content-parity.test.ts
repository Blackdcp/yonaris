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
		const originalDescription = product.activities[0].description;
		let objectWriteThrew = false;
		try {
			(product.activities[0] as { description: string }).description = "corrupted description";
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			objectWriteThrew = true;
		}
		const laterDescription = getProductContent("en").activities[0].description;
		if (!objectWriteThrew) {
			(product.activities[0] as { description: string }).description = originalDescription;
		}

		expect({ objectWriteThrew, laterDescription }).toEqual({
			objectWriteThrew: true,
			laterDescription: originalDescription,
		});
	});

	it("prevents nested page array mutations from changing later getter results", () => {
		const research = getResearchContent("en");
		const originalCitationCount = research.record.citations.length;
		let arrayWriteThrew = false;
		try {
			(research.record.citations as string[]).push("corrupted citation");
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			arrayWriteThrew = true;
		}
		const laterCitationCount = getResearchContent("en").record.citations.length;
		if (!arrayWriteThrew) {
			(research.record.citations as string[]).pop();
		}

		expect({ arrayWriteThrew, laterCitationCount }).toEqual({
			arrayWriteThrew: true,
			laterCitationCount: originalCitationCount,
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

	it("describes the Chinese company stage as a company", () => {
		expect(getCompanyContent("zh").stage).toBe(
			"Yonaris 目前是一家处于早期、以服务驱动的公司，拥有真实可用的证据平台。",
		);
	});

	it("uses the approved Chinese wording for branded and non-branded questions", () => {
		expect(getApproachContent("zh").steps.find(({ id }) => id === "questions")?.description).toContain(
			"品牌相关与非品牌相关的问题",
		);
	});

	it("uses 查询改写 consistently for query rewrites", () => {
		expect(getApproachContent("zh").steps.find(({ id }) => id === "compare")?.description).toContain("查询改写");
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
		expect(getApproachContent("en").limitations.join(" ")).toContain("does not independently prove causation");
		expect(getResearchContent("en").record.label).toBe("Illustrative");
		expect(getResearchContent("en").claims.every((claim) => claim.status === "illustrative")).toBe(true);
		expect(getCompanyContent("en").stage).toContain("early, service-led product");
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
