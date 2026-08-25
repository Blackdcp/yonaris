import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiAnswerFlow, BrandGapConsole, GlobalMarketBridge, ServiceRoute } from "./china-scenes";

type Page = () => React.ReactNode;
type ChinaPages = Record<"home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy", Page>;

const subject = (await import("./china-pages").catch(() => undefined)) as { CHINA_PAGES?: ChinaPages } | undefined;
const chinaCss = readFileSync(new URL("../../../styles/experience/china.css", import.meta.url), "utf8").replace(
	/\r\n/g,
	"\n",
);

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
	const panels = [...markup.matchAll(/<(?:article|div|section)[^>]*role="tabpanel"[^>]*>/g)].map(([panel]) => panel);

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
			expect(mobileMenu).toContain(page === "diagnostic" ? 'href="#china-contact-form"' : 'href="/zh/diagnostic"');
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
		const heading = home.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
		expect(heading.replace(/<[^>]+>/g, "")).toBe("客户开始问 AI，品牌的第一解释权还在你手里吗？");
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

	it("把所有通用诊断画面明确标成示意内容，而不是客户证据", () => {
		for (const [name, Scene] of [
			["AI 答案画面", AiAnswerFlow],
			["品牌差距记录", BrandGapConsole],
			["服务路径", ServiceRoute],
			["市场对照", GlobalMarketBridge],
		] as const) {
			const markup = renderToStaticMarkup(<Scene />);
			expect(markup, `${name} 需要机器可读的示意标记`).toContain('data-evidence-kind="illustrative"');
			expect(markup, `${name} 需要可见的非客户数据说明`).toContain("不含客户数据");
			expect(markup, `${name} 不应把通用示意写成一次真实观察`).not.toMatch(
				/当次观察|范围已确认|复查记录显示|当次(?:中文|当地语言|当地)?答案/,
			);
		}
	});

	it("移动端让每个诊断输出值使用正文排版", () => {
		const mobileStart = chinaCss.indexOf("@media (max-width: 800px)");
		const narrowStart = chinaCss.indexOf("@media (max-width: 520px)", mobileStart);
		expect(mobileStart).toBeGreaterThan(-1);
		expect(narrowStart).toBeGreaterThan(mobileStart);
		const mobileCss = chinaCss.slice(mobileStart, narrowStart);

		expect(mobileCss).toMatch(
			/\.china-command \[data-diagnostic-state\] \[data-output-field\]\s*\{\s*font-size:\s*var\(--text-body-mobile\);\s*line-height:\s*1\.5;\s*\}/,
		);
	});

	it("首页标题保留完整可读文案并防止第一被拆行", () => {
		const markup = render("home");
		const headingMatch = markup.match(/<h1([^>]*)>([\s\S]*?)<\/h1>/);
		const headingAttributes = headingMatch?.[1] ?? "";
		const heading = headingMatch?.[2] ?? "";
		const readableHeading = heading.replace(/<[^>]+>/g, "");

		expect(readableHeading).toBe("客户开始问 AI，品牌的第一解释权还在你手里吗？");
		expect(headingAttributes).toContain('aria-label="客户开始问 AI，品牌的第一解释权还在你手里吗？"');
		expect(heading).toContain('<span class="china-home-title__lexeme">第一解释权</span>');
		expect(chinaCss).toMatch(/\.china-home-title__lexeme\s*\{[^}]*white-space:\s*nowrap;[^}]*\}/s);
	});

	it("首页决策路径把两组标签和判断放在完整可读的行内", () => {
		const markup = render("home");

		expect(markup.match(/class="china-home-hero__shift-row"/g) ?? []).toHaveLength(2);
		expect(chinaCss).toMatch(
			/\.china-home-hero__shift-row\s*\{[^}]*grid-template-columns:\s*minmax\(6rem, auto\) minmax\(0, 1fr\);[^}]*\}/s,
		);
	});

	it("移动端访问方式和语言切换使用可触达的字号与四十四像素目标", () => {
		const mobileStart = chinaCss.indexOf("@media (max-width: 800px)");
		const narrowStart = chinaCss.indexOf("@media (max-width: 520px)", mobileStart);
		expect(mobileStart).toBeGreaterThan(-1);
		expect(narrowStart).toBeGreaterThan(mobileStart);
		const mobileCss = chinaCss.slice(mobileStart, narrowStart);

		expect(mobileCss).toMatch(
			/\.china-command \.mode-link a,\s*\.china-command \.locale-switch\s*\{[^}]*min-width:\s*var\(--target-mobile\);[^}]*min-height:\s*var\(--target-mobile\);[^}]*font-size:\s*var\(--text-functional-mobile\);[^}]*\}/s,
		);
		expect(mobileCss).toMatch(
			/\.china-footer__brand a\s*\{[^}]*min-width:\s*var\(--target-mobile\);[^}]*min-height:\s*var\(--target-mobile\);[^}]*\}/s,
		);
	});

	it("服务优先级在橙色底上强制使用高对比深色文字", () => {
		expect(chinaCss).toMatch(
			/\.china-service-route__detail > \.china-service-route__priority\s*\{[^}]*background:\s*var\(--y-orange\);[^}]*color:\s*var\(--y-ink\);[^}]*\}/s,
		);
	});

	it("服务首屏在解释 GEO 后用普通业务语言说明下一步", () => {
		const markup = render("approach");
		const hero = markup.match(/<section class="china-approach-intro">([\s\S]*?)<\/section>/)?.[1] ?? "";

		expect(hero).toContain("先做品牌体检，再定 GEO 打法。");
		expect(hero).toContain("这里的 GEO，指生成式搜索和 AI 答案中的品牌表现。");
		expect(hero).toContain("出现偏差");
		expect(hero).toContain("不同市场的定位");
		expect(hero).not.toMatch(/掉点|出海本地化/);
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

	it("预约页导航按钮直达明确表单锚点且不再使用遮挡内容的固定按钮", () => {
		const markup = render("diagnostic");
		const header = markup.match(/<header class="china-nav">([\s\S]*?)<\/header>/)?.[1] ?? "";

		expect(markup).toContain('<section class="china-diagnostic-form" id="china-contact-form"');
		expect(header.match(/href="#china-contact-form"/g) ?? []).toHaveLength(2);
		expect(markup).not.toContain('class="china-mobile-action"');
	});

	it("公开托管式复核的真实边界、记录入口与人工兜底", () => {
		const product = render("product");
		const company = render("company");
		const privacy = render("privacy");

		expect(product).toContain('data-public-trust="managed-review"');
		expect(product).toContain("Yonaris 团队负责采集与核对，客户在同一工作空间查看问题范围、完整答案和下一步优先级");
		expect(product).toContain("不是只给一个分数");
		expect(product).toContain("完整答案快照");
		expect(product).toContain("仅记录答案明确展示的引用");
		expect(product).toContain("指定对标对象的比较");
		expect(product).toContain("下一次优先复核项");
		expect(product).toContain("复查记录");
		expect(product).toContain("按项目节奏围绕约定问题复盘，不包装成实时监控");
		expect(company).toContain('data-public-trust="first-party-records"');
		expect(company).toContain('href="/zh/agent/product.md"');
		expect(company).toContain('href="/zh/agent/company.md"');
		expect(company).toContain('href="/zh/agent/catalog.json"');
		expect(company).toContain("最近核对：2026-08-25");
		expect(company).toContain("不证明客户结果、排名、范围外覆盖或实时 AI 观察");
		expect(company).toContain('href="mailto:black.dcp@outlook.com"');
		expect(company).toContain("对公开记录或隐私有疑问？");
		expect(company).not.toContain("如果表单无法确认投递");
		expect(privacy).toContain("只有投递服务接受申请后，页面才显示已送出");
		expect(privacy).toContain('href="mailto:black.dcp@outlook.com"');
	});
});
