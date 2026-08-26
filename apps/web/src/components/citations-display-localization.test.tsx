import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import type { CitationData } from "./citations-display";

function hrefFor(to: string, params?: Record<string, string>) {
	let href = to;
	for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
	return href;
}

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, params }: { children: ReactNode; to: string; params?: Record<string, string> }) => (
		<a href={hrefFor(to, params)}>{children}</a>
	),
}));
vi.mock("recharts", async (importOriginal) => ({
	...(await importOriginal<typeof import("recharts")>()),
	Area: () => null,
	AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CartesianGrid: () => null,
	XAxis: () => null,
	YAxis: () => null,
}));
vi.mock("@/server/brands", () => ({
	addDomainToBrandFn: vi.fn(),
	addDomainToCompetitorFn: vi.fn(),
	createCompetitorFromDomainFn: vi.fn(),
}));

import { CitationsDisplay } from "./citations-display";

const rawPrompt = "Which CRM works in 中国?";
const rawUrl = "https://reddit.com/r/RawCommunity/comments/abc?market=CN";
const rawQuery = "best CRM 中国 2026";

const citationData: CitationData = {
	totalCitations: 7,
	uniqueDomains: 4,
	categoryCounts: {
		brand: 3,
		competitor: 2,
		editorial: 1,
		reviews: 0,
		ecommerce: 0,
		social: 1,
		developer: 0,
		pr: 0,
		reference: 0,
		institutional: 0,
		other: 0,
	},
	domainDistribution: [
		{ domain: "stepfun.example", count: 3, category: "brand" },
		{ domain: "rival.example", count: 2, category: "competitor" },
		{ domain: "reddit.com", count: 1, category: "social" },
	],
	specificUrls: [
		{
			url: rawUrl,
			title: "Raw Reddit title 原文",
			domain: "reddit.com",
			count: 1,
			category: "social",
			pageType: "forum",
			isNew: true,
		},
	],
	pageTypeDistribution: [{ pageType: "forum", count: 1 }],
	citationTimeSeries: [{ date: "2026-08-15", brand: 50, competitor: 33, social: 17 }],
	pageTypeTimeSeries: [{ date: "2026-08-15", forum: 100 }],
	competitors: [{ id: "competitor-raw-id", name: "DeepSeek 原名", domains: ["rival.example"] }],
	competitorOnlyPrompts: [{ id: "prompt-raw-id", value: rawPrompt, competitorCitationCount: 2, uniqueCompetitors: 1 }],
	whatsChanged: {
		newUrls: [{ url: rawUrl, domain: "reddit.com", count: 1, promptCount: 1, category: "social" }],
		droppedUrls: [],
		titleChanges: [],
		newDomains: [],
		droppedDomains: [],
	},
	googleModule: {
		shopping: {
			totalCitations: 1,
			brandCount: 1,
			competitorCount: 0,
			products: [
				{
					name: "Raw Product 名称",
					count: 1,
					attribution: "brand",
					prompts: [{ id: "prompt-raw-id", value: rawPrompt, count: 1 }],
					urls: [{ url: "https://shop.example/raw-product", count: 1 }],
				},
			],
		},
		search: {
			totalCitations: 1,
			queries: [{ query: rawQuery, count: 1, prompts: [{ id: "prompt-raw-id", value: rawPrompt, count: 1 }] }],
		},
	},
};

describe("CitationsDisplay localization", () => {
	it("localizes every citation child-card family while keeping evidence and deep links literal", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<CitationsDisplay
					citationData={citationData}
					brandId="brand-raw-id"
					brandName="StepFun 原名"
					showStats
					days={30}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("品牌引用份额");
		expect(markup).toContain("引用类别");
		expect(markup).toContain("引用页面类型");
		expect(markup).toContain("最近变化");
		expect(markup).toContain("内容缺口");
		expect(markup).toContain("热门引用域名");
		expect(markup).toContain("热门引用网址");
		expect(markup).toContain("Google 购物");
		expect(markup).toContain("搜索查询");
		expect(markup).toContain("热门引用的 Subreddit");
		expect(markup).toContain(rawPrompt);
		expect(markup).toContain(rawQuery);
		expect(markup).toContain("Raw Product 名称");
		expect(markup).toContain("Raw Reddit title 原文");
		expect(markup).toContain(`href="${rawUrl.replaceAll("&", "&amp;")}"`);
		expect(markup).toContain('href="/app/brand-raw-id/prompts/prompt-raw-id"');
		expect(markup).not.toContain("Content Gaps");
		expect(markup).not.toContain("Recent Changes");
	});
});
