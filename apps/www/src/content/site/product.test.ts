import { describe, expect, test } from "vitest";
import { getProductContent } from "./product";

const activityIds = ["define-scope", "observe-answer", "inspect-evidence", "choose-next-test"];
const viewIds = ["scope", "answer", "sources", "next-test"];

describe("Product content truth model", () => {
	test("presents the approved bilingual promise and four activities", () => {
		const english = getProductContent("en");
		const chinese = getProductContent("zh");

		expect(english.headline).toBe("Make AI market answers observable.");
		expect(chinese.headline).toBe("让 AI 形成的市场答案变得可观察");
		expect(english.activities.map((activity) => activity.id)).toEqual(activityIds);
		expect(chinese.activities.map((activity) => activity.id)).toEqual(activityIds);
		expect(english.workbench.views.map((view) => view.id)).toEqual(viewIds);
		expect(chinese.workbench.views.map((view) => view.id)).toEqual(viewIds);
		expect(english.workbench.ui.capabilityContextLabel).toBe("Capability context");
		expect(chinese.workbench.ui.capabilityContextLabel).toBe("能力说明");
		expect(english.workbench.ui.verifiedEvidenceLabel).toBe("Verified evidence");
		expect(chinese.workbench.ui.verifiedEvidenceLabel).toBe("已核验证据");
		expect(english.workbench.ui.directionLabel).toBe("Direction");
		expect(chinese.workbench.ui.directionLabel).toBe("方向");
		expect(english.heroClaimSeparator).toBe(" ");
		expect(chinese.heroClaimSeparator).toBe("");
		for (const content of [english, chinese]) {
			expect(content.heroClaims.map((claim) => claim.text).join(content.heroClaimSeparator)).toBe(content.currentScope);
			expect(content.heroClaims.map((claim) => claim.status)).toEqual(["current-software", "managed-delivery"]);
		}
	});

	test("backs every visible Product assertion with a status and explicit limitation", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getProductContent(locale);
			const claimGroups = [
				content.claims,
				content.heroClaims,
				...content.activities.map((activity) => activity.claims),
				content.workspaceBoundary.customer.claims,
				content.workspaceBoundary.yonaris.claims,
				content.coverage.claims,
				...content.workbench.views.map((view) => view.claims),
				content.homePreview.claims,
			];

			for (const claims of claimGroups) {
				expect(claims.length).toBeGreaterThan(0);
				expect(claims.every((claim) => claim.status && claim.limitation.trim().length > 0)).toBe(true);
			}

			expect(content.homePreview).toMatchObject({
				evidenceLabel: expect.any(String),
				limitation: expect.any(String),
			});
		}
	});

	test("keeps illustrative evidence separate from present capability status", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getProductContent(locale);

			expect(content.workbench.views.every((view) => view.status === "illustrative")).toBe(true);
			expect(
				content.workbench.views.every((view) => view.claims.some((claim) => claim.status === "illustrative")),
			).toBe(true);
			expect(content.claims.map((claim) => claim.status)).toEqual([
				"current-software",
				"managed-delivery",
				"current-software",
				"managed-delivery",
			]);
		}
	});

	test("models unavailable evidence as unknown without inventing a value or proving absence", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getProductContent(locale);
			const fields = content.workbench.views.flatMap((view) => view.fields);
			const unknownFields = fields.filter((field) => field.state === "unknown");

			expect(unknownFields.length).toBeGreaterThan(0);
			expect(unknownFields.some((field) => "value" in field)).toBe(false);
			expect(JSON.stringify(unknownFields)).toMatch(
				locale === "en" ? /does not establish that no search occurred/i : /不能证明.*没有.*搜索/,
			);
		}
	});

	test("bounds coverage to configured providers and consumer surfaces", () => {
		const english = JSON.stringify(getProductContent("en"));
		const chinese = JSON.stringify(getProductContent("zh"));

		expect(english).toContain("Coverage depends on the providers and consumer surfaces configured for the Program");
		expect(chinese).toContain("覆盖范围取决于 Program 中配置的服务商与消费端界面");
	});

	test("does not overstate product maturity or make prohibited claims", () => {
		const serialized = JSON.stringify([getProductContent("en"), getProductContent("zh")]);
		const englishClaims = getProductContent("en")
			.claims.map((claim) => claim.text)
			.join(" ");

		expect(serialized).toContain("unknown");
		expect(serialized).not.toContain("Product Evidence Graph");
		expect(serialized).not.toContain("产品事实图谱");
		expect(englishClaims).not.toMatch(/\breal[- ]time\b/i);
		expect(englishClaims).not.toMatch(/autonomous|causal|self-service|universal/i);
	});
});
