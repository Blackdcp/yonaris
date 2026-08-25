import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type Page = () => React.ReactNode;
type ChinaPages = Record<"home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy", Page>;

const subject = (await import("./china-pages").catch(() => undefined)) as { CHINA_PAGES?: ChinaPages } | undefined;

function render(page: keyof ChinaPages): string {
	expect(subject?.CHINA_PAGES, "中国站页面必须完成实现").toBeDefined();
	return subject?.CHINA_PAGES ? renderToStaticMarkup(subject.CHINA_PAGES[page]()) : "";
}

describe("中国站客户体验", () => {
	it("让客户从四种真实处境进入，而不是按职位选择", () => {
		const markup = render("home");
		expect(markup.match(/data-situation-control=/g) ?? []).toHaveLength(4);
		expect(markup).toContain("没出现");
		expect(markup).toContain("说不准");
		expect(markup).toContain("竞品说得更多");
		expect(markup).toContain("出海后被说成两回事");
		expect(markup).not.toMatch(/市场总监|品牌负责人|创始人|销售团队/);
	});

	it("把中国市场与中国企业出海呈现为两条可选择的服务路径", () => {
		const markup = render("geo");
		expect(markup).toContain('data-market-track="china"');
		expect(markup).toContain('data-market-track="global"');
		expect(markup.match(/data-market-control=/g) ?? []).toHaveLength(2);
		expect(markup).toContain("服务中国市场");
		expect(markup).toContain("支持企业进入海外目标市场");
	});

	it("每个页面都有自己的视觉主角和清晰的下一步", () => {
		const expectedScenes: Record<keyof ChinaPages, string> = {
			home: "ai-answer-flow",
			product: "brand-gap-console",
			approach: "service-route",
			geo: "global-market-bridge",
			company: "company-network",
			diagnostic: "consultation-brief",
			privacy: "privacy-path",
		};

		for (const [page, scene] of Object.entries(expectedScenes) as [keyof ChinaPages, string][]) {
			const markup = render(page);
			expect(markup).toContain(`data-scene="${scene}"`);
			expect(markup).toContain("/brand/logos/yonaris-wordmark-");
			expect(markup).toContain(page === "diagnostic" ? "data-lead-state" : 'href="/zh/diagnostic"');
		}
	});

	it("把产品能力写成客户能直接理解的业务语言", () => {
		const home = render("home");
		const product = render("product");
		const company = render("company");
		const diagnostic = render("diagnostic");
		const rendered = [home, product, render("approach"), render("geo"), company].join("\n");

		expect(home).toContain("传统路径");
		expect(home).toContain("AI 参与的新路径");
		expect(product).toContain("客户怎么问，AI 怎么答，先看哪里");
		expect(company).toContain("品牌智能公司");
		expect(diagnostic).toContain("提交并预约沟通");
		expect(rendered).not.toMatch(/四个可核对结果|待核对信息|复查记录|确认范围|同一配置|在中国扎根|陪中国企业走向全球/);
	});
});
