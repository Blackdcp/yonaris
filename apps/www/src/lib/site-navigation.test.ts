import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Site06Shell } from "@/components/experience/shared/site-06-shell";
import type { HumanPageKey } from "@/content/experience/types";
import { getLocaleSwitchPath } from "./locale-paths";

const localePairs: readonly { key: HumanPageKey; en: string; zh: string }[] = [
	{ key: "home", en: "/", zh: "/zh" },
	{ key: "product", en: "/product", zh: "/zh/product" },
	{ key: "approach", en: "/approach", zh: "/zh/approach" },
	{ key: "geo", en: "/geo", zh: "/zh/geo" },
	{ key: "company", en: "/company", zh: "/zh/company" },
	{ key: "diagnostic", en: "/diagnostic", zh: "/zh/diagnostic" },
	{ key: "privacy", en: "/privacy", zh: "/zh/privacy" },
];

function renderedShell(locale: "en" | "zh"): string {
	return renderToStaticMarkup(
		Site06Shell({
			locale,
			pageKey: "product",
			children: locale === "en" ? "Content" : "内容",
		}),
	);
}

function navigationLinks(markup: string, className: "site-06-primary-nav" | "site-06-mobile-nav") {
	const navigation = markup.match(new RegExp(`<nav class="${className}"[^>]*>([\\s\\S]*?)<\\/nav>`, "u"))?.[1] ?? "";
	return [...navigation.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gu)].map((match) => ({
		label: match[2],
		href: match[1],
	}));
}

describe("Human site locale navigation", () => {
	test("maps all seven English and Chinese topics in both directions", () => {
		for (const pair of localePairs) {
			expect(getLocaleSwitchPath("en", pair.key)).toBe(pair.zh);
			expect(getLocaleSwitchPath("zh", pair.key)).toBe(pair.en);
		}
	});

	test("keeps the people and Agent control beside the primary navigation", () => {
		const english = renderedShell("en");
		const chinese = renderedShell("zh");

		expect(english).toContain('class="site-06-header__actions"');
		expect(english).toContain('aria-label="Choose reading mode"');
		expect(english).toContain('href="/agent/product"');
		expect(english).toContain("For people");
		expect(english).toContain("For agents");
		expect(chinese).toContain('aria-label="选择阅读方式"');
		expect(chinese).toContain('href="/zh/agent/product"');
		expect(chinese).toContain("人类阅读");
		expect(chinese).toContain("Agent 阅读");
	});

	test("keeps a shared Human and Agent mode rail visible in the mobile header before the menu", () => {
		for (const locale of ["en", "zh"] as const) {
			const markup = renderedShell(locale);
			const header = markup.match(/<header[^>]*>[\s\S]*?<\/header>/u)?.[0] ?? "";
			const mobileMode = header.indexOf('class="site-06-header__mobile-mode"');
			const mobileLocale = header.indexOf('class="site-06-header__mobile-locale site-06-locale"');
			const menu = header.indexOf('class="site-06-menu"');
			expect(mobileMode).toBeGreaterThan(-1);
			expect(mobileLocale).toBeGreaterThan(mobileMode);
			expect(menu).toBeGreaterThan(mobileLocale);
			expect(header.slice(mobileMode, mobileLocale)).toContain('data-mode-switch="true"');
			expect(header.slice(mobileMode, mobileLocale)).toContain(
				locale === "en" ? 'href="/agent/product"' : 'href="/zh/agent/product"',
			);
			expect(header.slice(mobileLocale, menu)).toContain(locale === "en" ? 'href="/zh/product"' : 'href="/product"');
		}
	});

	test("links all seven locale-matched Human canonicals from every Human footer", () => {
		for (const locale of ["en", "zh"] as const) {
			const markup = renderedShell(locale);
			const footerNavigation = markup.match(/<nav class="site-06-footer__links"[^>]*>([\s\S]*?)<\/nav>/u)?.[1] ?? "";
			const links = [...footerNavigation.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/gu)].map((match) => match[1]);
			expect(links).toEqual(localePairs.map((pair) => (locale === "en" ? pair.en : pair.zh)));
			expect(links).toHaveLength(7);
		}
	});

	test("keeps exact localized primary and mobile navigation labels, order, and paths", () => {
		const expected = {
			en: [
				{ label: "Platform", href: "/product" },
				{ label: "Evidence", href: "/approach" },
				{ label: "Human + Agent", href: "/company" },
				{ label: "Contact", href: "/diagnostic" },
			],
			zh: [
				{ label: "为什么现在", href: "/zh" },
				{ label: "系统怎么运转", href: "/zh/product" },
				{ label: "看一次拆解", href: "/zh/approach" },
				{ label: "预约沟通", href: "/zh/diagnostic" },
			],
		} as const;

		for (const locale of ["en", "zh"] as const) {
			const markup = renderedShell(locale);
			expect(navigationLinks(markup, "site-06-primary-nav")).toEqual(expected[locale]);
			expect(navigationLinks(markup, "site-06-mobile-nav")).toEqual(expected[locale]);
		}
	});
});
