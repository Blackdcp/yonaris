import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalEnglishShell } from "./global-english-shell";

describe("GlobalEnglishShell", () => {
	it("owns one main and only approved commercial destinations", () => {
		const markup = renderToStaticMarkup(
			<GlobalEnglishShell activeKey="product">
				<h1>Test</h1>
			</GlobalEnglishShell>,
		);
		expect(markup.match(/<main/g) ?? []).toHaveLength(1);
		expect(markup).toContain('href="#main-content"');
		expect(markup).toContain('href="/product" aria-current="page"');
		expect(markup).toContain('href="https://portal.yonaris.com"');
		expect(markup).toContain('href="/zh" lang="zh-CN"');
		expect(markup).toContain('href="/diagnostic"');
		for (const retiredPath of ["/status", "/brand", "/agent", "/llms.txt"])
			expect(markup).not.toContain(`href="${retiredPath}"`);
	});
});
