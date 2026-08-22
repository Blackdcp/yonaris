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
