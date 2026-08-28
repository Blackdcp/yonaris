import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type Page = () => React.ReactNode;
type HumanPageKey = "home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy";
type PageModule = { GLOBAL_PAGES?: Record<HumanPageKey, Page>; CHINA_PAGES?: Record<HumanPageKey, Page> };

const globalSubject = (await import("./global/global-pages").catch(() => undefined)) as PageModule | undefined;
const chinaSubject = (await import("./china/china-pages").catch(() => undefined)) as PageModule | undefined;

const globalPages: HumanPageKey[] = ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"];

const expectedHeadings = {
	global: {
		home: "See what buyers are being told before the first conversation.",
		product: "See what shaped the shortlist.",
		approach: "Proof should be something your team can review.",
		geo: "Markets change the conditions around the decision.",
		company: "The same company should remain clear to people and agents.",
		diagnostic: "Tell us who to contact. We’ll begin with the buying decision.",
		privacy: "Your contact request takes one short route.",
	},
	china: {
		home: "AI 正在替客户认识你、比较你，也可能误解你。",
		product: "不是再做一层内容，而是重建品牌被理解的基础设施。",
		approach: "从一句 AI 答案，追到真正影响选择的那个断点。",
		geo: "换一个市场，先换判断条件，不是只换语言。",
		company: "同一家公司，应该让人和 Agent 都读得清楚。",
		diagnostic: "带一道你最不想让 AI 答错的问题来。",
		privacy: "姓名、电话、公司，只用于回复这次咨询。",
	},
} as const;

const retiredMarkers = [
	"global-cinematic",
	"zh-decision",
	"editorial-stage",
	"decision-canvas",
	"global-en__hero",
	"global-en__section",
	"global-en__close",
	"global-en__graphic",
	"zh-site__hero",
	"zh-site__section",
	"zh-site__decision",
	"zh-site__close",
	"zh-site__graphic",
	"evidence-boundary",
	"human-agent-parity",
	"repeat-observation-boundary",
	"verified-trust-slot",
	"unknown-boundary",
	"verified-boundary",
] as const;

const internalEnglish =
	/\b(denominator|managed delivery|configured scope|evidence boundary|interface demonstration|no customer data|causal proof)\b/i;
const internalChinese = /证据边界|有效分母|人工审核点|配置化观察|责任边界|当前软件|当前演示|因果证明/;
const roleSegmentation = /for (CMOs|marketers|founders|sales teams)|市场总监|品牌负责人|创始人|销售团队/i;

function expectSharedHumanContract(
	markup: string,
	edition: "global-en" | "zh-cn",
	generation: "site-06",
	scene?: string,
): void {
	expect(markup.match(/<main/g) ?? []).toHaveLength(1);
	expect(markup.match(/<h1/g) ?? []).toHaveLength(1);
	expect(markup).toContain(`data-generation="${generation}"`);
	expect(markup).toContain('data-human-surface="true"');
	expect(markup).toContain(`data-edition="${edition}"`);
	if (scene) expect(markup).toContain(`data-scene="${scene}"`);
	expect(markup).toContain("/brand/logos/yonaris-wordmark-");
	expect(markup).not.toMatch(roleSegmentation);
	expect(markup).not.toContain('href="/research"');
	expect(markup).not.toContain('href="/zh/research"');
	expect(markup).not.toContain('href="/resources"');
	expect(markup).not.toContain('href="/zh/resources"');
	for (const marker of retiredMarkers) expect(markup).not.toContain(marker);
}

describe("Human website generation", () => {
	it("ships seven independently composed Site 06 English pages", () => {
		expect(globalSubject?.GLOBAL_PAGES, "new global experience must exist").toBeDefined();
		if (!globalSubject?.GLOBAL_PAGES) return;
		expect(Object.keys(globalSubject.GLOBAL_PAGES)).toEqual(globalPages);
		for (const key of globalPages) {
			const markup = renderToStaticMarkup(globalSubject.GLOBAL_PAGES[key]());
			expectSharedHumanContract(markup, "global-en", "site-06");
			expect(markup).toContain(`<h1>${expectedHeadings.global[key]}</h1>`);
			expect(markup).not.toMatch(internalEnglish);
			expect(markup).toContain(`href="${key === "home" ? "/agent" : `/agent/${key}`}"`);
			expect(markup).not.toMatch(/[↗→↳]/);
			expect(markup).not.toMatch(/>\s*0[1-9]\s*</);
		}
	});

	it("ships seven independently written China pages", () => {
		expect(chinaSubject?.CHINA_PAGES, "new China experience must exist").toBeDefined();
		if (!chinaSubject?.CHINA_PAGES) return;
		expect(Object.keys(chinaSubject.CHINA_PAGES)).toEqual(globalPages);
		for (const key of globalPages) {
			const markup = renderToStaticMarkup(chinaSubject.CHINA_PAGES[key]());
			expectSharedHumanContract(markup, "zh-cn", "site-06");
			expect(markup).toContain(`<h1>${expectedHeadings.china[key]}</h1>`);
			expect(markup).not.toMatch(internalChinese);
			expect(markup).toContain(`href="${key === "home" ? "/zh/agent" : `/zh/agent/${key}`}"`);
			expect(markup).not.toMatch(/[↗→↳]/);
			expect(markup).not.toMatch(/>\s*0[1-9]\s*</);
		}
	});

	it("keeps each regional contact form to three visible fields", () => {
		expect(globalSubject?.GLOBAL_PAGES).toBeDefined();
		expect(chinaSubject?.CHINA_PAGES).toBeDefined();
		if (!globalSubject?.GLOBAL_PAGES || !chinaSubject?.CHINA_PAGES) return;

		const globalMarkup = renderToStaticMarkup(globalSubject.GLOBAL_PAGES.diagnostic());
		const chinaMarkup = renderToStaticMarkup(chinaSubject.CHINA_PAGES.diagnostic());
		expect(globalMarkup.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(globalMarkup).toContain('name="name"');
		expect(globalMarkup).toContain('name="email"');
		expect(globalMarkup).toContain('name="company"');
		expect(globalMarkup).not.toContain('name="phone"');
		expect(chinaMarkup.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(chinaMarkup).toContain('name="name"');
		expect(chinaMarkup).toContain('name="phone"');
		expect(chinaMarkup).toContain('name="company"');
		expect(chinaMarkup).not.toContain('name="email"');
	});

	it("does not repeat a visible section heading on the same page", () => {
		expect(globalSubject?.GLOBAL_PAGES).toBeDefined();
		expect(chinaSubject?.CHINA_PAGES).toBeDefined();
		if (!globalSubject?.GLOBAL_PAGES || !chinaSubject?.CHINA_PAGES) return;
		for (const pages of [globalSubject.GLOBAL_PAGES, chinaSubject.CHINA_PAGES]) {
			for (const key of globalPages) {
				const markup = renderToStaticMarkup(pages[key]());
				const visibleMarkup = markup.replace(/<section[^>]* hidden=""[^>]*>[\s\S]*?<\/section>/g, "");
				const headings = [...visibleMarkup.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((match) => match[1]);
				expect(new Set(headings).size, key).toBe(headings.length);
			}
		}
	});
});
