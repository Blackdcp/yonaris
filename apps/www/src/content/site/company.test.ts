import { describe, expect, test } from "vitest";
import { getCompanyContent } from "./company";

const readerIds = ["human", "agent"] as const;
const principleIds = ["evidence", "scope", "review", "truth"] as const;
const claimContract = [
	{ id: "company-human-agent-direction", status: "direction" },
	{ id: "company-service-led-stage", status: "managed-delivery" },
	{ id: "company-evidence-platform", status: "current-software" },
	{ id: "company-recursive-forest-method", status: "managed-delivery" },
] as const;

function referencedClaimIds(content: ReturnType<typeof getCompanyContent>): string[] {
	return [
		...content.vision.claimIds,
		...content.marketShift.claimIds,
		...content.stage.claimIds,
		...content.forest.claimIds,
		...content.currentScopeClaimIds,
	];
}

describe("Company content truth model", () => {
	test("states the approved global category thesis in independently authored English and Chinese", () => {
		const english = getCompanyContent("en");
		const chinese = getCompanyContent("zh");

		expect(english.category).toBe("AI-native MarTech");
		expect(english.vision.headline).toBe("MarTech, rebuilt. For humans and agents.");
		expect(english.marketShift.title).toBe("The market now has two readers.");
		expect(english.stage.title).toBe("A real platform. A service-led beginning.");
		expect(english.forest.title).toBe("Don’t enumerate every question. Build what generates the answers.");
		expect(english.contact.title).toBe("Start with one question that matters.");

		expect(chinese.category).toBe("AI 原生营销科技");
		expect(chinese.vision.headline).toBe("重构 MarTech，同时面向人，也面向智能体");
		expect(chinese.marketShift.title).toBe("市场现在有两类读者");
		expect(chinese.stage.title).toBe("真实的平台，服务驱动的起点");
		expect(chinese.forest.title).toBe("不穷举每一个问题，构建答案生长的根系");
		expect(chinese.contact.title).toBe("从一个真正重要的问题开始");
		expect(chinese.vision.headline).not.toBe(english.vision.headline);
		expect(chinese.marketShift.title).not.toBe(english.marketShift.title);
	});

	test("keeps one canonical claim registry and resolves every visible factual reference", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getCompanyContent(locale);
			const registry = content.claims.map(({ id, status }) => ({ id, status }));
			const registryIds = content.claims.map(({ id }) => id);
			const references = referencedClaimIds(content);

			expect(registry).toEqual(claimContract);
			expect(new Set(registryIds).size).toBe(registryIds.length);
			expect(content.claims.every((claim) => claim.limitation.trim().length > 0)).toBe(true);
			expect(references.length).toBeGreaterThan(0);
			expect(references.every((id) => registryIds.includes(id))).toBe(true);
			expect(new Set(references)).toEqual(new Set(registryIds));
		}
	});

	test("aligns stable reader, principle, and claim identities across locales", () => {
		const english = getCompanyContent("en");
		const chinese = getCompanyContent("zh");
		const shape = (content: typeof english | typeof chinese) => ({
			readers: content.marketShift.readers.map(({ id }) => id),
			principles: content.principles.items.map(({ id }) => id),
			claims: content.claims.map(({ id, status }) => ({ id, status })),
			visionClaimIds: content.vision.claimIds,
			marketShiftClaimIds: content.marketShift.claimIds,
			stageClaimIds: content.stage.claimIds,
			forestClaimIds: content.forest.claimIds,
			currentScopeClaimIds: content.currentScopeClaimIds,
		});

		expect(shape(chinese)).toEqual(shape(english));
		expect(english.marketShift.readers.map(({ id }) => id)).toEqual(readerIds);
		expect(english.principles.items.map(({ id }) => id)).toEqual(principleIds);
		expect(chinese.marketShift.readers.map(({ summary }) => summary)).not.toEqual(
			english.marketShift.readers.map(({ summary }) => summary),
		);
	});

	test("discloses an early service-led stage and the present operating boundary", () => {
		const english = getCompanyContent("en");
		const chinese = getCompanyContent("zh");

		expect(english.stage.summary).toMatch(/early company/i);
		expect(english.stage.summary).toMatch(/service-led/i);
		expect(english.currentScope).toMatch(/customer-visible/i);
		expect(english.currentScope).toMatch(/Yonaris-operated/i);
		expect(english.currentScope).toMatch(/human-reviewed/i);
		expect(chinese.stage.summary).toMatch(/早期公司/);
		expect(chinese.stage.summary).toMatch(/服务驱动/);
		expect(chinese.currentScope).toMatch(/客户可见/);
		expect(chinese.currentScope).toMatch(/Yonaris 团队执行/);
		expect(chinese.currentScope).toMatch(/人工审核/);
	});

	test("describes Recursive Forest as a bounded working method", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getCompanyContent(locale);
			expect(content.forest.summary).toMatch(locale === "en" ? /working method/i : /工作方法/);
			expect(content.forest.boundary).toMatch(
				locale === "en" ? /not an implemented graph architecture/i : /不是已经实现的图谱架构/,
			);
		}
	});

	test("uses principles as commitments and keeps the contact close exact", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getCompanyContent(locale);
			expect(content.principles.items).toHaveLength(4);
			expect(content.principles.items.every(({ description }) => description.trim().length > 0)).toBe(true);
			expect(content.contact.email).toBe("black.dcp@outlook.com");
			expect(content.contact.diagnosticLabel).toBe(locale === "en" ? "Get a Free Diagnostic" : "获取免费诊断");
		}
	});

	test("does not narrow the company or overstate maturity and proof", () => {
		const content = [getCompanyContent("en"), getCompanyContent("zh")];
		const serialized = JSON.stringify(content);
		const publicClaims = content.flatMap(({ claims }) => claims.map(({ text }) => text)).join(" ");

		expect(serialized).not.toMatch(/\bB2B[- ]only\b|仅限 B2B|只做 B2B/i);
		expect(serialized).not.toMatch(/GEO company|GEO 公司|只做 GEO/i);
		expect(serialized).not.toMatch(/Product Truth Graph|Commercial Feedback|产品事实图谱|商业反馈/);
		expect(serialized).not.toMatch(/0\s*(?:%|％)?\s*(?:→|->)\s*93\.3\s*(?:%|％)?/);
		expect(serialized).not.toMatch(/\belmo\b|elmohq|open[- ]source|upstream|开源|上游/i);
		expect(publicClaims).not.toMatch(
			/mature SaaS|autonomous|real[- ]time|universal|customer logos?|investors?|funding|certification|成熟 SaaS|自主运行|实时|无边界|客户标识|投资人|融资|认证/i,
		);
	});
});
