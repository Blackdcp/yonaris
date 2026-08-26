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

describe("Human site locale navigation", () => {
	test("maps all seven English and Chinese topics in both directions", () => {
		for (const pair of localePairs) {
			expect(getLocaleSwitchPath("en", pair.key)).toBe(pair.zh);
			expect(getLocaleSwitchPath("zh", pair.key)).toBe(pair.en);
		}
	});

	test("keeps the people and Agent control beside the primary navigation", () => {
		const english = renderToStaticMarkup(
			Site06Shell({
				locale: "en",
				pageKey: "product",
				children: "Content",
			}),
		);
		const chinese = renderToStaticMarkup(
			Site06Shell({
				locale: "zh",
				pageKey: "product",
				children: "内容",
			}),
		);

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
});
