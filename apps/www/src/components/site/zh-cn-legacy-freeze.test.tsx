import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApproachPage } from "./pages/approach-page";
import { CompanyPage } from "./pages/company-page";
import { DiagnosticPage } from "./pages/diagnostic-page";
import { GeoPage } from "./pages/geo-page";
import { HomePage } from "./pages/home-page";
import { ProductPage } from "./pages/product-page";
import { ResearchPage } from "./pages/research-page";

const BASELINE_REVISION = "36ecb7ce14af2cdd589a2fd23b8cf91fc882e9bd";
const RETIRED_PUBLIC_LINKS = new Set(["/status"]);
const ROUTES = [
	{ key: "home", path: "/zh", mainClass: "home-page", render: () => <HomePage locale="zh" /> },
	{ key: "product", path: "/zh/product", mainClass: "product-page", render: () => <ProductPage locale="zh" /> },
	{ key: "approach", path: "/zh/approach", mainClass: "approach-page", render: () => <ApproachPage locale="zh" /> },
	{ key: "research", path: "/zh/research", mainClass: "research-page", render: () => <ResearchPage locale="zh" /> },
	{ key: "company", path: "/zh/company", mainClass: "company-page", render: () => <CompanyPage locale="zh" /> },
	{ key: "geo", path: "/zh/geo", mainClass: "geo-page", render: () => <GeoPage locale="zh" /> },
	{
		key: "diagnostic",
		path: "/zh/diagnostic",
		mainClass: "diagnostic-page",
		render: () => <DiagnosticPage locale="zh" />,
	},
] as const;

interface RouteBaseline {
	path: string;
	lang: string;
	mainClass: string;
	mainText: string;
	headings: Array<{ level: number; id: string; text: string; ariaLabel: string }>;
	sections: Array<{ path: string; id: string; className: string; ariaLabel: string; ariaLabelledby: string }>;
	links: Array<{ scope: "header" | "main" | "footer"; text: string; href: string; ariaLabel: string; lang: string }>;
	forms: Array<{
		controls: Array<{ tag: string; type: string; name: string; id: string }>;
	}>;
	dataAttributes: Array<{ path: string; attributes: Array<{ name: string; value: string }> }>;
}

interface Baseline {
	revision: string;
	routes: Record<(typeof ROUTES)[number]["key"], RouteBaseline>;
}

function readJson(relativePath: string): unknown {
	return JSON.parse(
		readFileSync(
			new URL(`../../../../../e2e/www-tests/fixtures/zh-cn-legacy/${relativePath}`, import.meta.url),
			"utf8",
		),
	);
}

function decodeHtml(value: string): string {
	return value
		.replace(/&#x([0-9a-f]+);/giu, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 16)))
		.replace(/&#([0-9]+);/gu, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
		.replace(/&quot;/gu, '"')
		.replace(/&#x27;/gu, "'")
		.replace(/&lt;/gu, "<")
		.replace(/&gt;/gu, ">")
		.replace(/&amp;/gu, "&");
}

function attribute(attributes: string, name: string): string {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	const match = attributes.match(new RegExp(`(?:^|\\s)${escaped}(?:="([^"]*)")?(?=\\s|$)`, "u"));
	return decodeHtml(match?.[1] ?? "");
}

function compactText(markup: string): string {
	return decodeHtml(markup.replace(/<[^>]+>/gu, ""))
		.normalize("NFKC")
		.replace(/\s+/gu, "");
}

function enclosed(markup: string, tag: "header" | "main" | "footer"): string {
	const match = markup.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "u"));
	if (!match) throw new Error(`Missing ${tag} in frozen component markup`);
	return match[0];
}

function headings(main: string): RouteBaseline["headings"] {
	return Array.from(main.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gu)).map((match) => ({
		level: Number(match[1]),
		id: attribute(match[2], "id"),
		text: compactText(match[3]),
		ariaLabel: attribute(match[2], "aria-label"),
	}));
}

function sections(main: string): Array<Omit<RouteBaseline["sections"][number], "path">> {
	return Array.from(main.matchAll(/<section\b([^>]*)>/gu)).map((match) => ({
		id: attribute(match[1], "id"),
		className: attribute(match[1], "class"),
		ariaLabel: attribute(match[1], "aria-label"),
		ariaLabelledby: attribute(match[1], "aria-labelledby"),
	}));
}

function links(markup: string): Array<Omit<RouteBaseline["links"][number], "scope">> {
	return Array.from(markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gu)).map((match) => ({
		text: compactText(match[2]),
		href: attribute(match[1], "href"),
		ariaLabel: attribute(match[1], "aria-label"),
		lang: attribute(match[1], "lang"),
	}));
}

function controls(main: string): Array<{ tag: string; type: string; id: string }> {
	return Array.from(main.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gu)).flatMap((form) =>
		Array.from(form[1].matchAll(/<(input|textarea|select|button)\b([^>]*)>/gu)).map((match) => ({
			tag: match[1],
			type: attribute(match[2], "type"),
			id: attribute(match[2], "id"),
		})),
	);
}

function dataAttributes(main: string): Array<{ tag: string; attributes: Array<{ name: string; value: string }> }> {
	return Array.from(main.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/giu)).flatMap((match) => {
		const attributes = Array.from(match[2].matchAll(/\b(data-[a-z0-9-]+)(?:="([^"]*)")?/giu))
			.map((dataMatch) => ({ name: dataMatch[1], value: decodeHtml(dataMatch[2] ?? "") }))
			.sort((left, right) => left.name.localeCompare(right.name));
		return attributes.length > 0 ? [{ tag: match[1].toLowerCase(), attributes }] : [];
	});
}

function tagFromPath(path: string): string {
	const segment = path.split(">").at(-1) ?? "";
	return segment.match(/^[a-z0-9-]+/u)?.[0] ?? "";
}

const baseline = readJson("dom-text.v1.json") as Baseline;

describe("frozen zh-CN legacy baseline", () => {
	it("was captured from the pinned pre-release revision", () => {
		expect(baseline.revision).toBe(BASELINE_REVISION);
		expect(Object.keys(baseline.routes)).toEqual(ROUTES.map(({ key }) => key));
	});

	for (const route of ROUTES) {
		it(`preserves ${route.path} component structure and ordering`, () => {
			const expected = baseline.routes[route.key];
			const markup = renderToStaticMarkup(route.render());
			const main = enclosed(markup, "main");
			expect(expected.path).toBe(route.path);
			expect(expected.lang).toBe("zh-CN");
			expect(expected.mainClass).toBe(route.mainClass);
			expect(expected.mainText.length).toBeGreaterThan(0);
			expect(markup).toContain('lang="zh-CN"');
			expect(markup.match(/<main\b/gu)).toHaveLength(1);
			expect(main).toMatch(new RegExp(`<main class="${route.mainClass}">`, "u"));
			expect(main.match(/<h1\b/gu)).toHaveLength(1);
			expect(headings(main)).toEqual(
				expected.headings.map((heading) => ({ ...heading, text: heading.text.replace(/\s+/gu, "") })),
			);
			expect(sections(main)).toEqual(expected.sections.map(({ path: _, ...section }) => section));
			expect(links(markup)).toEqual(
				expected.links
					.filter((link) => !RETIRED_PUBLIC_LINKS.has(link.href))
					.map(({ scope: _, ...link }) => ({ ...link, text: link.text.replace(/\s+/gu, "") })),
			);
			expect(controls(main)).toEqual(
				expected.forms.flatMap((form) => form.controls.map(({ tag, type, id }) => ({ tag, type, id }))),
			);
			expect(dataAttributes(main)).toEqual(
				expected.dataAttributes.map(({ path, attributes }) => ({ tag: tagFromPath(path), attributes })),
			);
		});
	}

	it("keeps the allowed-difference registry closed to the reviewed takedown", () => {
		expect(readJson("allowed-differences.v1.json")).toEqual([
			{ id: "runtime-build-hash", reviewerRole: "release-owner", targets: [] },
			{ id: "footer-current-year", reviewerRole: "release-owner", targets: [] },
			{ id: "shared-security-change", reviewerRole: "release-owner", targets: [] },
			{
				id: "retired-public-link-removal",
				reviewerRole: "release-owner",
				targets: ROUTES.map(({ path }) => `${path} footer /status`),
			},
			{ id: "reviewed-hreflang-removal", reviewerRole: "release-owner", targets: [] },
			{
				id: "retired-positioning-language-removal",
				reviewerRole: "release-owner",
				targets: ["/zh main illustrative category label"],
			},
		]);
	});
});
