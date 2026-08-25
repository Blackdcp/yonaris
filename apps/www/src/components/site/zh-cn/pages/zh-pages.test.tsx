import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type SubjectModule = typeof import("./index");
const subject = (await import("./index").catch(() => undefined)) as SubjectModule | undefined;

const expectedSections = {
	home: [
		"hero",
		"market-change",
		"core-questions",
		"product-capability",
		"service-process",
		"global-capability",
		"human-agent",
		"diagnostic-close",
	],
	product: ["hero", "product-workbench", "module-flow", "responsibility", "diagnostic-close"],
	approach: ["hero", "delivery-path", "delivery-artifacts", "review-boundary", "diagnostic-close"],
	research: ["hero", "evidence-record", "measurement-definitions", "unknown-boundary", "diagnostic-close"],
	geo: ["hero", "answer-map", "market-context", "applied-process", "diagnostic-close"],
	company: ["hero", "purpose", "global-service", "responsibility", "verified-boundary", "diagnostic-close"],
	diagnostic: ["hero", "what-happens", "lead-form", "delivery-privacy"],
	privacy: ["hero", "submitted-data", "delivery", "purpose"],
} as const;

describe("中国区域完整页面", () => {
	for (const [key, sectionIds] of Object.entries(expectedSections)) {
		it(`${key} 使用中国区域外壳、品牌资产和完整结构`, () => {
			expect(subject, "中国区域页面必须存在").toBeDefined();
			if (!subject) return;
			const Page = subject.ZH_PAGES[key as keyof typeof subject.ZH_PAGES];
			const markup = renderToStaticMarkup(<Page />);
			expect(markup).toContain('data-edition="zh-cn"');
			expect(markup).toContain("/brand/logos/yonaris-wordmark-navy.png");
			expect(markup).toContain("data-graphic");
			expect(markup).toContain('href="/zh/agent');
			const positions = sectionIds.map((id) => markup.indexOf(`id="${id}"`));
			expect(positions.every((position) => position >= 0)).toBe(true);
			expect(positions).toEqual([...positions].sort((a, b) => a - b));
			expect(markup).not.toContain('class="site-shell marketing-site');
		});
	}

	it("首页采用中国式结论先行叙事和五问交互", () => {
		expect(subject, "中国区域页面必须存在").toBeDefined();
		if (!subject) return;
		const markup = renderToStaticMarkup(<subject.ZhHomePage />);
		expect(markup).toContain("客户正在先问 AI，再认识你的品牌。");
		expect(markup).toContain('data-graphic="zh-answer-scene"');
		expect(markup).toContain('data-visual-system="zh-decision"');
		expect(markup).toContain('data-stage="market-command"');
		expect(markup).toContain('data-stage="service-system"');
		expect(markup).toContain('data-stage="delivery-proof"');
		expect(markup).toContain('data-stage="global-capability"');
		expect(markup).not.toContain('class="zh-site__section-head"');
		expect(markup).toContain("看见");
		expect(markup).toContain("判断");
		expect(markup).toContain("行动");
		expect(markup).toContain("验证");
	});

	it("每个中文页面都有独立的业务主视觉", () => {
		expect(subject, "中国区域页面必须存在").toBeDefined();
		if (!subject) return;
		const protagonists = {
			home: "anxiety-command",
			product: "service-system",
			approach: "delivery-roadmap",
			research: "evidence-cabinet",
			geo: "market-answer-map",
			company: "global-service-field",
			diagnostic: "contact-brief",
			privacy: "privacy-guardrail",
		} as const;
		for (const [key, protagonist] of Object.entries(protagonists)) {
			const Page = subject.ZH_PAGES[key as keyof typeof subject.ZH_PAGES];
			const markup = renderToStaticMarkup(<Page />);
			expect(markup).toContain(`data-protagonist="${protagonist}"`);
		}
	});

	it("诊断页只显示姓名、电话、公司", () => {
		expect(subject, "中国区域页面必须存在").toBeDefined();
		if (!subject) return;
		const markup = renderToStaticMarkup(<subject.ZhDiagnosticPage />);
		expect(markup).toContain('name="name"');
		expect(markup).toContain('name="phone"');
		expect(markup).toContain('name="company"');
		expect(markup).not.toContain('name="email"');
		expect(markup).not.toContain('name="website"');
		expect(markup).not.toContain("mailto:");
	});
});
