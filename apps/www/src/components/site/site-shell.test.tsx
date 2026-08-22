import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import type { Locale } from "@/content/site/types";
import { PORTAL_URL } from "@/lib/site-navigation";
import { LegacyArchiveContext } from "./legacy-archive-context";
import { PublicationShell } from "./publication-shell";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SiteShell } from "./site-shell";
import { UtilityShell } from "./utility-shell";

function navMarkup(markup: string, label: string): string {
	const match = markup.match(new RegExp(`<nav[^>]*aria-label="${label}"[^>]*>(.*?)</nav>`, "s"));
	expect(match, `navigation labelled ${label}`).not.toBeNull();
	return match?.[1] ?? "";
}

function hrefs(markup: string): string[] {
	return [...markup.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/g)].map((match) => match[1]);
}

function occurrences(markup: string, value: string): number {
	return markup.split(value).length - 1;
}

describe.each([
	{
		locale: "en" as const,
		primaryLabel: "Primary navigation",
		mobileLabel: "Mobile navigation",
		paths: ["/product", "/approach", "/research", "/company"],
		labels: ["Product", "Approach", "Research", "Company"],
		diagnostic: "Get a Free Diagnostic",
	},
	{
		locale: "zh" as const,
		primaryLabel: "主导航",
		mobileLabel: "移动端导航",
		paths: ["/zh/product", "/zh/approach", "/zh/research", "/zh/company"],
		labels: ["产品", "方法", "研究", "公司"],
		diagnostic: "获取免费诊断",
	},
])("SiteHeader ($locale)", ({ locale, primaryLabel, mobileLabel, paths, labels, diagnostic }) => {
	it("renders manifest-derived primary navigation in canonical order", () => {
		const markup = renderToStaticMarkup(<SiteHeader locale={locale} activeKey="approach" />);

		const primary = navMarkup(markup, primaryLabel);
		expect(hrefs(primary)).toEqual(paths);
		for (const label of labels) expect(primary).toContain(`>${label}</a>`);
		expect(primary).toContain(`href="${paths[1]}" aria-current="page"`);
		expect(markup).not.toContain("/platform");
		expect(markup).not.toContain("/methodology");
		expect(markup).not.toContain("/results");
	});

	it("renders one diagnostic action and Portal link in each responsive presentation", () => {
		const markup = renderToStaticMarkup(<SiteHeader locale={locale} />);

		expect(occurrences(markup, 'data-site-diagnostic-action="desktop"')).toBe(1);
		expect(occurrences(markup, 'data-site-diagnostic-action="mobile"')).toBe(1);
		expect(occurrences(markup, `>${diagnostic}</a>`)).toBe(2);
		expect(occurrences(markup, `href="${PORTAL_URL}"`)).toBe(2);
		expect(navMarkup(markup, mobileLabel)).toContain(`href="${PORTAL_URL}"`);
	});
});

describe("shared public shells", () => {
	it("marks the active page and preserves it across the locale switch", () => {
		const markup = renderToStaticMarkup(<SiteHeader locale="en" activeKey="research" />);

		expect(markup).toContain('href="/research" aria-current="page"');
		expect(markup).toContain('href="/zh/research" lang="zh-CN"');
	});

	it("renders footer destinations from canonical site paths", () => {
		for (const locale of ["en", "zh"] satisfies Locale[]) {
			const markup = renderToStaticMarkup(<SiteFooter locale={locale} />);
			const expected = [
				locale === "zh" ? "/zh/geo" : "/geo",
				"/resources",
				"/open-source",
				"/status",
				"/privacy",
				"/agent",
				"/llms.txt",
			];

			for (const path of expected) expect(hrefs(markup)).toContain(path);
			expect(markup).not.toContain("Provider Status");
			expect(markup).not.toContain("Get Started");
		}
	});

	it("keeps the compatibility Navbar and Footer independent of router context", () => {
		const markup = renderToStaticMarkup(
			<>
				<Navbar />
				<Footer />
			</>,
		);

		expect(markup).toContain('aria-label="Primary navigation"');
		expect(markup).toContain('href="/product"');
		expect(markup).toContain('href="/resources"');
	});

	it("lets SiteShell own the only main landmark", () => {
		const markup = renderToStaticMarkup(
			<SiteShell locale="en" activeKey="product" mainClassName="page-main">
				<h1>Product</h1>
			</SiteShell>,
		);

		expect(occurrences(markup, "<main")).toBe(1);
		expect(markup).toContain('<main class="page-main"><h1>Product</h1></main>');
	});

	it("composes publication and utility context through the shared shell", () => {
		const publication = renderToStaticMarkup(
			<PublicationShell section="ai-search" archiveContext="legacy-research">
				<article>Archived note</article>
			</PublicationShell>,
		);
		const utility = renderToStaticMarkup(
			<UtilityShell section="docs">
				<article>Documentation</article>
			</UtilityShell>,
		);
		const upstream = renderToStaticMarkup(<LegacyArchiveContext kind="upstream-comparison" />);

		expect(occurrences(publication, "<main")).toBe(1);
		expect(publication).toContain("Legacy research archive");
		expect(utility).toContain("Open-source Documentation");
		expect(upstream).toContain("upstream Elmo comparison archive");
	});
});
