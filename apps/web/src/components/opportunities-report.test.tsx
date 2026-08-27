import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, params }: { children: ReactNode; params: { brand: string; promptId: string } }) => (
		<a href={`/app/${params.brand}/prompts/${params.promptId}`}>{children}</a>
	),
}));

vi.mock("@/i18n/catalog", async () => {
	const actual = await vi.importActual<typeof import("@/i18n/catalog")>("@/i18n/catalog");
	return {
		...actual,
		formatNumber: (locale: UiLanguage, value: number) => `${locale}:${value}`,
	};
});

import { OpportunitiesReport } from "./opportunities-report";

const rawPrompt = "Prompt RAW::Best AI IDE for 中国 & Singapore?";
const rawCitationTitle = "Rival <Roundup> & 原文";
const rawCitationUrl = "https://rival.example/raw?q=CN&model=gpt-5.6";
const report = {
	summary: ["MODEL_SUMMARY_RAW::保持 unchanged"],
	opportunities: [
		{
			category: "creation" as const,
			title: "MODEL_TITLE_RAW::保持 unchanged",
			why: "MODEL_WHY_RAW::keep byte identity",
			relatedPrompts: [{ text: rawPrompt, promptId: "prompt/raw-id" }],
			yourCitations: [],
			competitorCitations: [{ title: rawCitationTitle, domain: "Rival 原名", url: rawCitationUrl }],
		},
	],
	risks: ["MODEL_RISK_RAW::保持 unchanged"],
};

function renderReport(uiLanguage: UiLanguage, outputLanguage: UiLanguage) {
	return renderToStaticMarkup(
		<I18nProvider locale={uiLanguage}>
			<OpportunitiesReport report={report} brandId="brand/raw-id" outputLanguage={outputLanguage} />
		</I18nProvider>,
	);
}

describe("OpportunitiesReport output language", () => {
	it("renders English artifact copy and numbers under an English root despite Chinese page UI", () => {
		const markup = renderReport("zh-CN", "en");

		expect(markup).toContain('data-slot="opportunities-report"');
		expect(markup).toContain('lang="en"');
		expect(markup).toContain("Summary");
		expect(markup).toContain("Content Creation");
		expect(markup).toContain("Related Prompts");
		expect(markup).toContain("en:1");
		expect(markup).not.toContain("内容创作");
	});

	it("renders Simplified Chinese artifact copy and numbers under a Chinese root despite English page UI", () => {
		const markup = renderReport("en", "zh-CN");

		expect(markup).toContain('data-slot="opportunities-report"');
		expect(markup).toContain('lang="zh-CN"');
		expect(markup).toContain("摘要");
		expect(markup).toContain("内容创作");
		expect(markup).toContain("相关提示词");
		expect(markup).toContain("zh-CN:1");
		expect(markup).not.toContain("Content Creation");
	});

	it.each([
		["zh-CN", "en"],
		["en", "zh-CN"],
	] as const)(
		"preserves model, Prompt, citation, URL, brand, and competitor bytes for UI %s / artifact %s",
		(ui, output) => {
			const markup = renderReport(ui, output);

			for (const raw of [
				"MODEL_SUMMARY_RAW::保持 unchanged",
				"MODEL_TITLE_RAW::保持 unchanged",
				"MODEL_WHY_RAW::keep byte identity",
				"MODEL_RISK_RAW::保持 unchanged",
				rawPrompt,
				"Rival 原名",
			]) {
				expect(markup).toContain(raw.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
			}
			expect(markup).toContain(
				rawCitationTitle.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
			);
			expect(markup).toContain(`href="${rawCitationUrl.replaceAll("&", "&amp;")}"`);
			expect(markup).toContain('href="/app/brand/raw-id/prompts/prompt/raw-id"');
		},
	);
});
