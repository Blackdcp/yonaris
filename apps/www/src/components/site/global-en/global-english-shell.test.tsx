import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlobalEnglishShell } from "./global-english-shell";

describe("GlobalEnglishShell", () => {
	it("uses approved wordmarks and preserves the product topic across reading modes", () => {
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
		expect(markup).toContain('src="/brand/logos/yonaris-wordmark-navy.png"');
		expect(markup).toContain('src="/brand/logos/yonaris-wordmark-white.png"');
		expect(markup).not.toContain("YONARIS<span");
		expect(markup).toContain('aria-label="Reading mode"');
		expect(markup).toContain('href="/agent/product"');
		for (const retiredPath of ["/status", "/brand", "/llms.txt"])
			expect(markup).not.toContain(`href="${retiredPath}"`);
	});
});
