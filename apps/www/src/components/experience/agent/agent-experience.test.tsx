import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { AgentPage } from "./agent-pages";

const humanPath = (locale: "en" | "zh", pageKey: HumanPageKey): string => {
	if (locale === "en") return pageKey === "home" ? "/" : `/${pageKey}`;
	return pageKey === "home" ? "/zh" : `/zh/${pageKey}`;
};

const agentPath = (locale: "en" | "zh", pageKey: HumanPageKey): string => {
	if (locale === "en") return pageKey === "home" ? "/agent" : `/agent/${pageKey}`;
	return pageKey === "home" ? "/zh/agent" : `/zh/agent/${pageKey}`;
};

const retiredRoutes = /href="\/(?:zh\/)?(?:research|resources)(?:[/#"])/i;
const internalNarration =
	/managed delivery|configured scope|evidence boundary|interface demonstration|no customer data|causal proof|draft|supply chain|implementation detail|配置化观察|证据边界|当前演示|非客户数据|内部策略|实现细节|供应链/i;
const retiredVisuals = /global-cinematic|zh-decision|editorial-stage|decision-canvas|global-en__|zh-site__/i;

describe("zero-to-one Agent experience", () => {
	it("publishes the seven approved topics for both regional fact sets", () => {
		expect(Object.keys(AGENT_FACTS)).toEqual(["global", "zh"]);
		expect(Object.keys(AGENT_FACTS.global)).toEqual([...HUMAN_PAGE_KEYS]);
		expect(Object.keys(AGENT_FACTS.zh)).toEqual([...HUMAN_PAGE_KEYS]);

		for (const edition of ["global", "zh"] as const) {
			const locale = edition === "global" ? "en" : "zh";
			for (const pageKey of HUMAN_PAGE_KEYS) {
				const topic = AGENT_FACTS[edition][pageKey];
				expect(topic.title).toBeTruthy();
				expect(topic.summary).toBeTruthy();
				expect(topic.humanPath).toBe(humanPath(locale, pageKey));
				expect(topic.groups.length).toBeGreaterThan(0);
				expect(topic.groups.every((group) => group.title && group.items.length > 0)).toBe(true);
			}
		}

		const serialized = JSON.stringify(AGENT_FACTS);
		expect(serialized).not.toMatch(/\/(?:zh\/)?(?:research|resources)/i);
		expect(serialized).not.toMatch(internalNarration);
		expect(serialized).not.toMatch(/sources that shape|help brands become|影响答案|持续改善后|获得改善/iu);
	});

	it("renders a machine-first page with an unmistakable return to its Human canonical", () => {
		for (const locale of ["en", "zh"] as const) {
			for (const pageKey of HUMAN_PAGE_KEYS) {
				const markup = renderToStaticMarkup(<AgentPage locale={locale} pageKey={pageKey} />);
				const otherLocale = locale === "en" ? "zh" : "en";
				expect(markup.match(/<main/g) ?? []).toHaveLength(1);
				expect(markup.match(/<h1/g) ?? []).toHaveLength(1);
				expect(markup).toContain('data-agent-surface="true"');
				expect(markup).toContain(`data-agent-locale="${locale}"`);
				expect(markup).toContain(`data-page-key="${pageKey}"`);
				expect(markup).toContain('src="/brand/logos/yonaris-wordmark-white.png"');
				expect(markup).toContain(`href="${humanPath(locale, pageKey)}" data-human-canonical="true"`);
				expect(markup).toContain(`href="${agentPath(locale, pageKey)}" aria-current="page"`);
				expect(markup).toContain(`href="${agentPath(otherLocale, pageKey)}" data-locale-switch="${otherLocale}"`);
				expect(markup).toContain(locale === "en" ? "Return to the Human site" : "返回官网");
				expect(markup).toContain("data-fact-group");
				expect(markup).toContain("data-fact-item");
				expect(markup).not.toMatch(retiredRoutes);
				expect(markup).not.toMatch(internalNarration);
				expect(markup).not.toMatch(retiredVisuals);
			}
		}
	});

	it("makes the Agent home a complete topic directory", () => {
		for (const locale of ["en", "zh"] as const) {
			const markup = renderToStaticMarkup(<AgentPage locale={locale} pageKey="home" />);
			for (const pageKey of HUMAN_PAGE_KEYS) {
				expect(markup).toContain(`href="${agentPath(locale, pageKey)}"`);
			}
		}
	});
});
