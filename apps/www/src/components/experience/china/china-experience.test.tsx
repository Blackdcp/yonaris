import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiAnswerFlow, BrandGapConsole, GlobalMarketBridge, ServiceRoute } from "./china-scenes";

type Page = () => React.ReactNode;
type ChinaPages = Record<"home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy", Page>;

const subject = (await import("./china-pages").catch(() => undefined)) as { CHINA_PAGES?: ChinaPages } | undefined;

function render(page: keyof ChinaPages): string {
	expect(subject?.CHINA_PAGES, "中国站页面必须完成实现").toBeDefined();
	return subject?.CHINA_PAGES ? renderToStaticMarkup(subject.CHINA_PAGES[page]()) : "";
}

function attribute(markup: string, name: string): string | undefined {
	return markup.match(new RegExp(`${name}="([^"]+)"`))?.[1];
}

function expectDiagnosticTabSet(Scene: () => React.ReactNode, expectedCount: number) {
	const markup = renderToStaticMarkup(<Scene />);
	const tabs = [...markup.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tab]) => tab);
	const panels = [...markup.matchAll(/<(?:article|div|section)[^>]*role="tabpanel"[^>]*>/g)].map(
		([panel]) => panel,
	);

	expect(tabs).toHaveLength(expectedCount);
	expect(panels).toHaveLength(expectedCount);
	expect(tabs.filter((tab) => attribute(tab, "tabindex") === "0")).toHaveLength(1);
	expect(tabs.filter((tab) => attribute(tab, "tabindex") === "-1")).toHaveLength(expectedCount - 1);

	const tabIds = tabs.map((tab) => attribute(tab, "id"));
	for (const panel of panels) {
		const panelId = attribute(panel, "id");
		const labelledBy = attribute(panel, "aria-labelledby");
		expect(panelId).toBeDefined();
		expect(tabIds).toContain(labelledBy);
		expect(tabs.some((tab) => attribute(tab, "aria-controls") === panelId)).toBe(true);
	}

	for (const field of ["scope", "answer", "gap", "priority"] as const) {
		expect(markup.match(new RegExp(`data-output-field="${field}"`, "g")) ?? []).toHaveLength(expectedCount);
	}

	const observedResults = [...markup.matchAll(/data-output-field="answer">([^<]+)/g)].map((match) => match[1]);
	const priorities = [...markup.matchAll(/data-output-field="priority">([^<]+)/g)].map((match) => match[1]);
	expect(new Set(observedResults).size).toBe(expectedCount);
	expect(new Set(priorities).size).toBe(expectedCount);
}

describe("中国站客户体验", () => {
	it("在每个页面提供可跳过导航、移动主导航与人机双入口", () => {
		for (const page of ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"] as const) {
			const markup = render(page);
			const mobileMenu = markup.match(/<details class="china-menu">([\s\S]*?)<\/details>/)?.[1] ?? "";
			const humanPath = page === "home" ? "/zh" : `/zh/${page}`;
			const agentPath = page === "home" ? "/zh/agent" : `/zh/agent/${page}`;

			expect(markup).toContain('class="china-skip-link" href="#main-content"');
			expect(markup).toContain('<main id="main-content" tabindex="-1"');
			expect(mobileMenu).toContain('aria-label="中国站移动导航"');
			expect(mobileMenu).toContain(`href="${humanPath}"`);
			expect(mobileMenu).toContain(`href="${agentPath}"`);
			expect(mobileMenu).toContain('href="/zh/diagnostic"');
		}
	});

	it("区域切换始终进入英文站的同主题页面", () => {
		const englishPaths: Record<keyof ChinaPages, string> = {
			home: "/",
			product: "/product",
			approach: "/approach",
			geo: "/geo",
			company: "/company",
			diagnostic: "/diagnostic",
			privacy: "/privacy",
		};

		for (const [page, path] of Object.entries(englishPaths) as [keyof ChinaPages, string][]) {
			expect(render(page)).toContain(`href="${path}" data-locale-switch="en"`);
		}
	});

	it("让客户从四种真实处境进入，而不是按职位选择", () => {
		const markup = render("home");
		expect(markup.match(/data-situation-control=/g) ?? []).toHaveLength(4);
		expect(markup).toContain("没进候选池");
		expect(markup).toContain("核心卖点被说偏");
		expect(markup).toContain("竞品占了答案位");
		expect(markup).toContain("出海后定位漂移");
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

	it("按中国 ToB 决策顺序呈现首页风险、证据与摸底输出", () => {
		const home = render("home");
		expect(home).toContain("客户开始问 AI，品牌的第一解释权还在你手里吗？");
		for (const risk of ["没进候选池", "核心卖点被说偏", "竞品占了答案位", "出海后定位漂移"]) {
			expect(home).toContain(risk);
		}
		for (const output of ["问题范围", "答案快照", "竞品差距", "优先级清单"]) {
			expect(home).toContain(output);
		}
		expect(home).toContain("出海不是翻译官网，而是重做一遍当地品类心智。");
		expect(home).toContain("预约一次 AI 品牌摸底");
		expect(home.indexOf("没进候选池")).toBeLessThan(home.indexOf("问题范围"));
		expect(home.indexOf("问题范围")).toBeLessThan(home.indexOf("出海不是翻译官网"));
		expect(home.lastIndexOf("预约一次 AI 品牌摸底")).toBeGreaterThan(home.indexOf("出海不是翻译官网"));
	});

	it("把产品、服务、市场与公司写成可执行的本土业务判断", () => {
		const home = render("home");
		const product = render("product");
		const approach = render("approach");
		const geo = render("geo");
		const company = render("company");
		const diagnostic = render("diagnostic");
		const privacy = render("privacy");
		const rendered = [home, product, approach, geo, company, diagnostic, privacy].join("\n");

		for (const stage of ["圈定问题", "拆答案", "找掉点", "做复盘"]) expect(product).toContain(stage);
		expect(product).toContain("一份能带进会议的品牌摸底记录");
		expect(approach).toContain("先做品牌体检，再定 GEO 打法");
		expect(approach).toContain("生成式搜索和 AI 答案中的品牌表现");
		expect(approach.indexOf("GEO")).toBeLessThan(approach.indexOf("生成式搜索和 AI 答案中的品牌表现"));
		expect(geo).toContain("中国市场基线");
		expect(geo).toContain("目标国家");
		expect(geo).toContain("目标语言");
		expect(geo).toContain("当地购买角色");
		expect(geo).toContain("出海不是翻译官网，而是重做一遍当地品类心智。");
		expect(company).toContain("不卖玄学排名，先把 AI 怎么说你查清楚");
		expect(company.indexOf("不卖玄学排名，先把 AI 怎么说你查清楚")).toBeLessThan(
			company.indexOf("已确认的市场、语言、购买问题和对标品牌"),
		);
		expect(diagnostic).toContain("第一次沟通只确认摸底范围");
		expect(privacy).not.toMatch(/增长黑客|私域|裂变|转化漏斗/);
		expect(rendered).not.toMatch(/保证排名|保证推荐|自动改变|全网覆盖|流量承诺/);
	});

	it("四个中国诊断场景都使用完整键盘标签关系并同步结果与优先级", () => {
		expectDiagnosticTabSet(AiAnswerFlow, 4);
		expectDiagnosticTabSet(BrandGapConsole, 4);
		expectDiagnosticTabSet(ServiceRoute, 4);
		expectDiagnosticTabSet(GlobalMarketBridge, 2);
	});

	it("预约表单只呈现姓名、电话、公司三个字段，不要求邮箱", () => {
		const markup = render("diagnostic");
		const form = markup.match(/<form[\s\S]*?<\/form>/)?.[0] ?? "";

		expect(form.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(form).toContain("姓名");
		expect(form).toContain("电话");
		expect(form).toContain("公司");
		expect(form).toContain('name="phone"');
		expect(form).toContain('type="tel"');
		expect(form).not.toMatch(/name="email"|type="email"|工作邮箱/);
	});
});
