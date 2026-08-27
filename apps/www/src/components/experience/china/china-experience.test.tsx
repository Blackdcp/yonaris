import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type Page = () => React.ReactNode;
type PageKey = "home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy";
type ChinaPages = Record<PageKey, Page>;
type ChinaModule = {
	CHINA_PAGES?: ChinaPages;
	ChinaDiagnosticPage?: (props: { requestType?: "consultation" | "privacy" }) => React.ReactNode;
};

const compositions = {
	home: "cinematic-anxiety",
	product: "system-field",
	approach: "breakdown-replay",
	company: "dual-reading-field-zh",
	geo: "market-editorial-zh",
	diagnostic: "contact-cinematic-zh",
	privacy: "privacy-editorial-zh",
} as const satisfies Record<PageKey, string>;

const subject = (await import("./china-pages").catch(() => undefined)) as ChinaModule | undefined;
const siteCss = readFileSync(new URL("../../../styles/experience/site-06.css", import.meta.url), "utf8");

function cssRule(source: string, selector: string): string {
	for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectors = (match[1] ?? "").split(",").map((item) => item.trim());
		if (selectors.includes(selector)) return match[2] ?? "";
	}
	return "";
}

function render(page: PageKey): string {
	expect(subject?.CHINA_PAGES, "中国站页面必须完成实现").toBeDefined();
	return subject?.CHINA_PAGES ? renderToStaticMarkup(subject.CHINA_PAGES[page]()) : "";
}

function scene(markup: string, object: string): string {
	return markup.match(new RegExp(`data-scene-object="${object}"[\\s\\S]*?<\\/section>`))?.[0] ?? "";
}

function orbit(markup: string, label: string): string {
	return markup.match(new RegExp(`<figure[^>]*aria-label="${label}"[\\s\\S]*?<\\/figure>`))?.[0] ?? "";
}

function duplicateIds(markup: string): string[] {
	const counts = new Map<string, number>();
	for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) {
		if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
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
	for (const [page, composition] of Object.entries(compositions) as [PageKey, string][]) {
		it(`${page} preserves its approved Chinese composition`, () => {
			expect(render(page)).toContain(`data-page-composition="${composition}"`);
		});
	}

	it("does not route the Chinese pages through the old generic hero", () => {
		const pages = (Object.keys(compositions) as PageKey[]).map(render);
		expect(pages.filter((markup) => markup.includes("site-06-hero__media"))).toHaveLength(0);
		expect(pages.filter((markup) => markup.includes("site-06-hero__copy"))).toHaveLength(0);
	});

	it("starts from Chinese business anxiety instead of roles", () => {
		const home = render("home");
		expect(home).toContain("面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。");
		expect(home).toContain("AI 正在替客户认识你、比较你，也可能误解你。");
		for (const phrase of ["没进备选", "核心优势被说偏", "竞品先被推荐", "预算不知道该投哪里", "结论失效"])
			expect(home).toContain(phrase);
		expect(home).not.toMatch(/市场总监|品牌负责人|创始人|销售团队/);
		expect(home).toContain('data-scene-object="cinematic-field"');
		expect(home).toContain("--site-06-focal-position:center center");
		expect(home).not.toContain("--site-06-focal-position:center 72%");
		expect(home).toContain('data-scene-object="anxiety-selector"');
		expect(home.indexOf('data-scene-object="cinematic-field"')).toBeLessThan(
			home.indexOf('data-scene-object="anxiety-selector"'),
		);
		expectAccessibleTabs(home.match(/data-anxiety-selector[\s\S]*?<\/section>/)?.[0] ?? "", 5);
		expect(home).toContain('data-scene-object="fact-disclosure"');
		expect(home.match(/<details[^>]*data-public-fact=/g) ?? []).toHaveLength(3);
		for (const label of ["事实", "证据", "边界", "稳定 ID"]) expect(home).toContain(label);
	});

	it("keeps orbit geometry without a second center label behind each overlaid record", () => {
		const home = render("home");
		const product = render("product");
		for (const [markup, label] of [
			[home, "同一条公开事实的人类与 Agent 双阅读"],
			[home, "当前问题怎样影响客户选择"],
			[product, "围绕同一道业务问题连接的六个节点"],
		] as const) {
			const field = orbit(markup, label);
			expect(field).toContain('class="site-06-orbit__rings"');
			expect(field).not.toContain("site-06-orbit__content");
		}
	});

	it("exposes every Home DOM id exactly once", () => {
		expect(duplicateIds(render("home"))).toEqual([]);
	});

	it("keeps the relationship preview before the six-node system field", () => {
		const system = render("product");
		expect(system).toContain('data-page-composition="system-field"');
		expect(system).toContain('data-scene-object="relationship-preview"');
		expect(system).toContain('data-scene-object="system-field"');
		expect(system).toContain("data-system-map");
		expect(system).toContain("市场问题");
		expect(system).toContain("行动与复核");
		expect(system.indexOf('data-scene-object="relationship-preview"')).toBeLessThan(
			system.indexOf('data-scene-object="system-field"'),
		);
		expect(system.match(/data-preview-relation=/g) ?? []).toHaveLength(5);
		expect(system.match(/data-system-node=/g) ?? []).toHaveLength(6);
		expectAccessibleTabs(system.match(/data-scene-object="system-field"[\s\S]*?<\/section>/)?.[0] ?? "", 6);
	});

	it("keeps one example through 基线、断点、行动、复核", () => {
		const breakdown = render("approach");
		expect(breakdown).toContain('data-page-composition="breakdown-replay"');
		expect(breakdown).toContain('data-scene-object="replay-stage"');
		expect(breakdown).toContain('class="site-06-zh-replay site-06-review"');
		for (const label of ["基线", "断点", "行动", "复核"]) expect(breakdown).toContain(label);
		expect(breakdown).toContain("无法归因");
		expect(breakdown.match(/data-replay-state=/g) ?? []).toHaveLength(4);
		expectAccessibleTabs(breakdown.match(/data-scene-object="replay-stage"[\s\S]*?<\/section>/)?.[0] ?? "", 4);
	});

	it("adds one short entry response to each Anxiety, System, and Replay panel", () => {
		for (const [markup, object, count] of [
			[render("home"), "anxiety-selector", 5],
			[render("product"), "system-field", 6],
			[render("approach"), "replay-stage", 4],
		] as const) {
			expect(scene(markup, object).match(/<article[^>]*site-06-motion-swap/g) ?? []).toHaveLength(count);
		}

		const normal = cssRule(siteCss, ".site-06-motion-swap");
		expect(normal).toContain("animation: site-06-panel-enter 180ms ease both");
		expect(siteCss).toMatch(/@keyframes site-06-panel-enter\s*\{[\s\S]*?opacity:\s*0\.72;[\s\S]*?translateY\(3px\)/);

		const reduced = siteCss.slice(siteCss.indexOf("@media (prefers-reduced-motion: reduce)"));
		expect(cssRule(reduced, ".site-06-motion-swap")).toContain("animation: none");
		expect(cssRule(reduced, ".site-06-motion-swap")).toContain("transform: none");
	});

	it("gives the Chinese anxiety, system, and replay distinct responsive geometry", () => {
		expect(cssRule(siteCss, ".site-06-zh-anxiety")).toContain("display: grid");
		expect(cssRule(siteCss, ".site-06-zh-route-lead")).toContain("min-width: 0");
		expect(cssRule(siteCss, ".site-06-zh-route-lead h1")).toContain("overflow-wrap: anywhere");
		expect(cssRule(siteCss, ".site-06-zh-route-lead h1")).toContain("width: 100%");
		expect(cssRule(siteCss, ".site-06-zh-system-field")).toContain("position: relative");
		expect(cssRule(siteCss, ".site-06-zh-system-field")).toContain("min-height: 690px");
		expect(cssRule(siteCss, ".site-06-zh-system-field__nodes button")).toContain("position: absolute");
		expect(cssRule(siteCss, ".site-06-zh-replay")).toContain("display: grid");
		const mobile = siteCss.slice(siteCss.indexOf("@media (max-width: 720px)"));
		expect(cssRule(mobile, ".site-06-zh-system-field__nodes button")).toContain("position: static");
	});

	it("preserves exact Chinese category casing, source credit, and disclosure affordance", () => {
		expect(cssRule(siteCss, ".site-06-zh-home__lead > .site-06-kicker")).toContain("text-transform: none");
		expect(render("approach")).toContain("Photo: Scott Graham / Unsplash");
		expect(render("home")).toContain("Photo: Pavel Danilyuk / Pexels");

		const closed = cssRule(siteCss, ".site-06-zh-public-truth__records summary::after");
		expect(closed).toContain('content: "查看事实"');
		expect(closed).not.toMatch(/border-radius|background/);
		expect(cssRule(siteCss, ".site-06-zh-public-truth__records details[open] summary::after")).toContain(
			'content: "收起事实"',
		);
	});

	it("用中文说明联系信息处理者、用途、保存期和删除路径", () => {
		const privacy = render("privacy");
		expect(privacy).toContain("Resend");
		expect(privacy).toContain("邮件处理者");
		expect(privacy).toContain("理解并回复这次咨询");
		expect(privacy).toContain("人工核对并处理");
		expect(privacy).toContain("相同的联系信息和公司信息");
		expect(privacy).toContain("不会自动删除");
		expect(privacy).toContain("美国处理和存储");
		expect(privacy).toContain('href="https://resend.com/docs/dashboard/domains/regions"');
		expect(privacy).toContain('href="https://resend.com/legal/dpa"');
		expect(privacy).toContain('href="/zh/diagnostic?intent=privacy"');
		expect(privacy).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
	});

	it("在服务端首帧呈现经过校验的隐私请求目的", () => {
		expect(subject?.ChinaDiagnosticPage).toBeDefined();
		if (!subject?.ChinaDiagnosticPage) return;
		const markup = renderToStaticMarkup(subject.ChinaDiagnosticPage({ requestType: "privacy" }));
		const main = markup.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
		const form = markup.match(/<form[\s\S]*?<\/form>/)?.[0] ?? "";
		expect(main).toContain("请 Yonaris 核对此前的联系申请。");
		expect(main).toContain("人工识别对应记录");
		expect(main).not.toContain("最不想让 AI 答错");
		expect(main).not.toContain("申请围绕所填问题与公司的后续沟通");
		expect(form).toContain("请 Yonaris 核对你的联系记录。");
		expect(form).toContain("启动人工隐私核对");
		expect(form).toContain('name="requestType" value="privacy"');
		expect(form.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(form).not.toContain("预约沟通");
	});

	it("retains the system labels and public breakdown boundaries", () => {
		const system = render("product");
		for (const node of ["市场问题", "品牌事实", "内容与渠道", "AI 与市场观测", "客户行为", "行动与复核"])
			expect(system).toContain(node);
		const breakdown = render("approach");
		expect(breakdown).toContain("公开方法演示 · 示例场景，不代表客户结果。");
		for (const state of ["基线", "断点", "行动", "复核", "已变化", "未变化", "无法归因"])
			expect(breakdown).toContain(state);
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
		expect(company).toContain('data-page-composition="dual-reading-field-zh"');
		expect(company.indexOf('aria-label="选择阅读方式"')).toBeLessThan(company.indexOf("机器可读，不等于机器写作"));
		expect(company).toContain('data-scene-object="canonical-fact-record"');
		expect(company).toContain('data-scene-object="company-close"');
		expect(company.indexOf('data-scene-object="canonical-fact-record"')).toBeLessThan(
			company.indexOf('data-scene-object="company-close"'),
		);
	});

	it("changes market conditions without defining an origin or destination service", () => {
		const geo = render("geo");
		for (const condition of ["市场", "语言", "当地品类表述", "替代选择", "证据条件"]) expect(geo).toContain(condition);
		expect(geo).not.toMatch(/中国市场基线|目标市场|目标国家|海外目标|出海|进入海外|服务中国市场/);
		for (const scene of ["market-condition-ledger", "market-evidence-lines", "geo-close"])
			expect(geo).toContain(`data-scene-object="${scene}"`);
		expect(geo.indexOf('data-scene-object="market-condition-ledger"')).toBeLessThan(
			geo.indexOf('data-scene-object="market-evidence-lines"'),
		);
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
		expect(diagnostic).toContain('data-contact-fact="true"');
		expect(diagnostic).not.toContain("site-06-contact-scene__record");
	});

	it("keeps anti-abuse implementation details out of public Chinese copy", () => {
		const rendered = (["home", "product", "approach", "geo", "company", "diagnostic", "privacy"] as const)
			.map(render)
			.join("\n");

		expect(rendered).not.toMatch(/隐藏字段|蜜罐|honeypot|反滥用字段/i);
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
