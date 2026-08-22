import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getPrivacyContent } from "@/content/site";
import { PrivacyPage } from "./privacy-page";

function occurrences(markup: string, value: string): number {
	return markup.split(value).length - 1;
}

function textContent(markup: string): string {
	return markup.replace(/<[^>]+>/g, "");
}

describe("PrivacyPage", () => {
	it("renders the canonical disclosure as one bilingual SiteShell page", () => {
		const markup = renderToStaticMarkup(<PrivacyPage />);

		expect(occurrences(markup, "<main")).toBe(1);
		expect(occurrences(markup, "<header")).toBe(1);
		expect(occurrences(markup, "<footer")).toBe(1);
		expect(markup).toContain('class="privacy-page"');
		expect(markup).toContain('id="privacy-en" lang="en"');
		expect(markup).toContain('id="privacy-zh" lang="zh-CN"');
		expect(markup).toContain('aria-label="Language / 语言"');
		expect(markup).toContain('href="#privacy-en"');
		expect(markup).toContain('href="#privacy-zh"');
	});

	it("renders every approved Task 1 fact once per language without adding policy claims", () => {
		const markup = renderToStaticMarkup(<PrivacyPage />);
		const text = textContent(markup);
		const privacy = getPrivacyContent();

		for (const language of privacy.languages) {
			expect(text).toContain(language.title);
			expect(text).toContain(language.introduction);
			for (const section of language.sections) {
				expect(markup).toContain(`id="privacy-${language.id}-${section.id}"`);
				expect(text).toContain(section.title);
				expect(text).toContain(section.body[0]);
			}
		}

		expect(markup).not.toMatch(
			/retention period|retain for|GDPR|legal basis|jurisdiction|\bDPO\b|encrypted|encryption guarantee|never sell|never share|deletion SLA|delete within|保留期限|保留.*天|法律依据|司法管辖|数据保护官|加密保证|绝不出售|绝不共享|删除时限/i,
		);
	});

	it("provides contact and a return path for both diagnostic locales", () => {
		const markup = renderToStaticMarkup(<PrivacyPage />);
		const text = textContent(markup);

		expect(occurrences(markup, 'href="mailto:black.dcp@outlook.com"')).toBe(2);
		expect(markup).toContain('href="/diagnostic"');
		expect(text).toContain("Return to the diagnostic↗");
		expect(markup).toContain('href="/zh/diagnostic"');
		expect(text).toContain("返回诊断申请↗");
	});

	it("uses unique ids for language and section jump targets", () => {
		const markup = renderToStaticMarkup(<PrivacyPage />);
		const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
