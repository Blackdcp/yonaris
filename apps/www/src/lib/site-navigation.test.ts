import { describe, expect, test } from "vitest";
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
});
