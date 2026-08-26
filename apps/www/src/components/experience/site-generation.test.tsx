import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type Page = () => React.ReactNode;
type HumanPageKey = "home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy";
type PageModule = { GLOBAL_PAGES?: Record<HumanPageKey, Page>; CHINA_PAGES?: Record<HumanPageKey, Page> };

const globalSubject = (await import("./global/global-pages").catch(() => undefined)) as PageModule | undefined;
const chinaSubject = (await import("./china/china-pages").catch(() => undefined)) as PageModule | undefined;

const globalPages: HumanPageKey[] = ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"];

const chinaScenes: Record<HumanPageKey, string> = {
	home: "ai-answer-flow",
	product: "brand-gap-console",
	approach: "service-route",
	geo: "global-market-bridge",
	company: "company-network",
	diagnostic: "consultation-brief",
	privacy: "privacy-path",
};

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
	generation: "site-06" | "zero-one",
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
			expect(markup).not.toMatch(internalEnglish);
			expect(markup).toContain(`href="${key === "home" ? "/agent" : `/agent/${key}`}"`);
		}
	});

	it("ships seven independently written China pages", () => {
		expect(chinaSubject?.CHINA_PAGES, "new China experience must exist").toBeDefined();
		if (!chinaSubject?.CHINA_PAGES) return;
		expect(Object.keys(chinaSubject.CHINA_PAGES)).toEqual(Object.keys(chinaScenes));
		for (const [key, scene] of Object.entries(chinaScenes) as [HumanPageKey, string][]) {
			const markup = renderToStaticMarkup(chinaSubject.CHINA_PAGES[key]());
			expectSharedHumanContract(markup, "zh-cn", "zero-one", scene);
			expect(markup).not.toMatch(internalChinese);
			expect(markup).toContain(`href="${key === "home" ? "/zh/agent" : `/zh/agent/${key}`}"`);
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
});
