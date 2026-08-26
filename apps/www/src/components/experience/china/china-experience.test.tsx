import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type Page = () => React.ReactNode;
type PageKey = "home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy";
type ChinaPages = Record<PageKey, Page>;

const subject = (await import("./china-pages").catch(() => undefined)) as { CHINA_PAGES?: ChinaPages } | undefined;

function render(page: PageKey): string {
	expect(subject?.CHINA_PAGES, "中国站页面必须完成实现").toBeDefined();
	return subject?.CHINA_PAGES ? renderToStaticMarkup(subject.CHINA_PAGES[page]()) : "";
}

function expectAccessibleTabs(markup: string, count: number): void {
	const tabs = [...markup.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tab]) => tab);
	expect(tabs).toHaveLength(count);
	expect(tabs.filter((tab) => tab.includes('tabindex="0"'))).toHaveLength(1);
	expect(tabs.filter((tab) => tab.includes('tabindex="-1"'))).toHaveLength(count - 1);
	for (const tab of tabs) {
		const panelId = tab.match(/aria-controls="([^"]+)"/)?.[1];
		expect(panelId).toBeDefined();
		expect(markup).toContain(`id="${panelId}"`);
	}
}

describe("Site 06 中国站", () => {
	it("starts from Chinese business anxiety instead of roles", () => {
		const home = render("home");
		expect(home).toContain("AI 正在替客户认识你、比较你，也可能误解你。");
		for (const phrase of ["没进备选", "核心优势被说偏", "竞品先被推荐", "预算不知道该投哪里", "结论失效"])
			expect(home).toContain(phrase);
		expect(home).not.toMatch(/市场总监|品牌负责人|创始人|销售团队/);
		expectAccessibleTabs(home.match(/data-anxiety-selector[\s\S]*?<\/section>/)?.[0] ?? "", 5);
	});

	it("renders the system and public breakdown contracts", () => {
		const system = render("product");
		for (const node of ["市场问题", "品牌事实", "内容与渠道", "AI 与市场观测", "客户行为", "行动与复核"])
			expect(system).toContain(node);
		expectAccessibleTabs(system.match(/data-system-map[\s\S]*?<\/section>/)?.[0] ?? "", 6);
		const breakdown = render("approach");
		expect(breakdown).toContain("公开方法演示 · 示例场景，不代表客户结果。");
		for (const state of ["基线", "断点", "行动", "复核", "已变化", "未变化", "无法归因"])
			expect(breakdown).toContain(state);
		expectAccessibleTabs(breakdown.match(/class="site-06-review"[\s\S]*?<\/section>/)?.[0] ?? "", 4);
	});

	it("shows one canonical fact through human and Agent readings", () => {
		const home = render("home");
		const company = render("company");
		for (const markup of [home, company]) {
			expect(markup).toContain("人类阅读");
			expect(markup).toContain("Agent 阅读");
			expect(markup).toContain("事实");
			expect(markup).toContain("证据");
			expect(markup).toContain("边界");
			expect(markup).toContain("稳定 ID");
		}
	});

	it("changes market conditions without defining an origin or destination service", () => {
		const geo = render("geo");
		for (const condition of ["市场", "语言", "当地品类表述", "替代选择", "证据条件"]) expect(geo).toContain(condition);
		expect(geo).not.toMatch(/中国市场基线|目标市场|目标国家|海外目标|出海|进入海外|服务中国市场/);
	});

	it("keeps canonical navigation, locale and machine-readable topic links", () => {
		const expectedNav = [
			["为什么现在", "/zh"],
			["系统怎么运转", "/zh/product"],
			["看一次拆解", "/zh/approach"],
			["预约沟通", "/zh/diagnostic"],
		] as const;
		for (const page of ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"] as const) {
			const markup = render(page);
			for (const [label, href] of expectedNav) {
				expect(markup).toContain(label);
				expect(markup).toContain(`href="${href}"`);
			}
			const humanPath = page === "home" ? "/zh" : `/zh/${page}`;
			const agentPath = page === "home" ? "/zh/agent" : `/zh/agent/${page}`;
			expect(markup).toContain(`href="${agentPath}"`);
			expect(markup).toContain(`href="${humanPath}"`);
		}
	});

	it("uses the local contact invitation and exactly three visible fields", () => {
		const diagnostic = render("diagnostic");
		expect(diagnostic).toContain("带一道你最不想让 AI 答错的问题来。");
		const form = diagnostic.match(/<form[\s\S]*?<\/form>/)?.[0] ?? "";
		expect(form.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		for (const field of ["姓名", "电话", "公司"]) expect(form).toContain(field);
		expect(form).toContain('name="companyUrl"');
		expect(form).not.toMatch(/工作邮箱|name="email"|type="email"/);
	});

	it("rejects the retired visual and narrative grammar", () => {
		const rendered = (["home", "product", "approach", "geo", "company", "diagnostic", "privacy"] as const)
			.map(render)
			.join("\n");
		expect(rendered).not.toMatch(/[→↗↓]/);
		expect(rendered).not.toMatch(/>0[1-9]</);
		expect(rendered).not.toMatch(/(?<!不)保证(?:排名|推荐)|自动改变|实时监控|客户结果提升|排名提升|流量增长/);
		expect(rendered).not.toMatch(/中国市场基线|海外目标|出海|进入海外|服务中国市场/);
		expect(rendered).not.toContain('data-generation="zero-one"');
		expect(rendered).toContain('data-generation="site-06"');
	});
});
