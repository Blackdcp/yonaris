import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { agentCatalogPath, getAgentTopic } from "@/lib/machine-documents";
import { agentPageHead, machineDiscoveryLinks, siteHref } from "@/lib/seo";
import { Route as agentApproachRoute } from "@/routes/agent/approach";
import { Route as agentCompanyRoute } from "@/routes/agent/company";
import { Route as agentDiagnosticRoute } from "@/routes/agent/diagnostic";
import { Route as agentGeoRoute } from "@/routes/agent/geo";
import { Route as agentHomeRoute } from "@/routes/agent/index";
import { Route as agentPrivacyRoute } from "@/routes/agent/privacy";
import { Route as agentProductRoute } from "@/routes/agent/product";
import { Route as zhAgentApproachRoute } from "@/routes/zh/agent/approach";
import { Route as zhAgentCompanyRoute } from "@/routes/zh/agent/company";
import { Route as zhAgentDiagnosticRoute } from "@/routes/zh/agent/diagnostic";
import { Route as zhAgentGeoRoute } from "@/routes/zh/agent/geo";
import { Route as zhAgentHomeRoute } from "@/routes/zh/agent/index";
import { Route as zhAgentPrivacyRoute } from "@/routes/zh/agent/privacy";
import { Route as zhAgentProductRoute } from "@/routes/zh/agent/product";
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
	/managed delivery|configured scope|evidence boundary|interface demonstration|no customer data|causal proof|supply chain|implementation detail|配置化观察|证据边界|当前演示|非客户数据|内部策略|实现细节|供应链/i;
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
				expect(topic.groups.every((group) => group.title && group.facts.length > 0)).toBe(true);
			}
		}

		const serialized = JSON.stringify(AGENT_FACTS);
		expect(serialized).not.toMatch(/\/(?:zh\/)?(?:research|resources)/i);
		expect(serialized).not.toMatch(internalNarration);
		expect(serialized).not.toMatch(/sources that shape|help brands become|影响答案|持续改善后|获得改善/iu);
	});

	it("keeps the managed product model, handoff fields, operator, and delivery truth aligned across Agent facts", () => {
		const en = JSON.stringify(AGENT_FACTS.global);
		const zh = JSON.stringify(AGENT_FACTS.zh);

		for (const topic of [...Object.values(AGENT_FACTS.global), ...Object.values(AGENT_FACTS.zh)]) {
			expect(topic.reviewedBy).toBe("Yonaris");
		}
		for (const phrase of [
			"managed review",
			"customer-visible evidence workspace and record",
			"not a self-serve ranking dashboard",
			"complete answer snapshot",
			"citations only when the answer exposes them",
			"named-alternative comparison",
			"prioritized next review",
			"recheck record",
			"scheduled around the agreed questions rather than run as continuous monitoring",
			"black.dcp@outlook.com",
		])
			expect(en).toContain(phrase);
		for (const phrase of [
			"托管式品牌复核",
			"证据工作空间和记录",
			"不是自助排名看板",
			"完整答案快照",
			"仅记录答案明确展示的引用",
			"指定对标对象的比较",
			"下一次优先复核项",
			"复查记录",
			"按项目节奏围绕约定问题复盘，不包装成实时监控",
			"black.dcp@outlook.com",
		])
			expect(zh).toContain(phrase);
		expect(en).not.toMatch(/\bmonitor\b|track changes|automatic ranking|real-time ranking|guaranteed outcome/i);
		expect(zh).not.toMatch(/提供持续监控|自动持续监控|自动排名|实时排名|保证结果/);
	});

	it("keeps established claim IDs on their original meaning and adds new delivery facts under new IDs", () => {
		for (const [edition, locale] of [
			["global", "en"],
			["zh", "zh"],
		] as const) {
			const facts = (key: "product" | "diagnostic" | "privacy") =>
				new Map<string, string>(
					AGENT_FACTS[edition][key].groups.flatMap((group) =>
						group.facts.map((fact) => [fact.id, fact.value] as const),
					),
				);
			const product = facts("product");
			const diagnostic = facts("diagnostic");
			const privacy = facts("privacy");

			expect(product.get("product.answer-workspace")).toMatch(
				locale === "en" ? /workspace.*answers.*brand mentions/i : /工作空间.*答案.*品牌提及/,
			);
			expect(product.get("product.review-items")).toMatch(
				locale === "en" ? /workspace lists.*omissions.*review/i : /工作空间.*列出.*复核/,
			);
			for (const id of [
				"product.service-led",
				"product.customer-visible",
				"product.yonaris-operated",
				"product.handoff",
				"product.recheck-cadence",
			]) {
				expect(product.has(id), `${edition} ${id}`).toBe(true);
			}
			expect(diagnostic.get("diagnostic.contact-purpose")).toMatch(
				locale === "en" ? /use these details to understand.*make contact/i : /使用这些信息了解需求.*联系/,
			);
			for (const id of ["diagnostic.scope-setting", "diagnostic.delivery-state", "diagnostic.support-contact"]) {
				expect(diagnostic.has(id), `${edition} ${id}`).toBe(true);
			}
			expect(privacy.get("privacy.contact-purpose")).toMatch(
				locale === "en" ? /used to understand.*respond/i : /用于确认称呼.*联系/,
			);
			for (const id of ["privacy.unconfirmed-delivery", "privacy.support-contact"]) {
				expect(privacy.has(id), `${edition} ${id}`).toBe(true);
			}
		}
	});

	it("renders a machine-first page with an unmistakable return to its Human canonical", () => {
		for (const locale of ["en", "zh"] as const) {
			for (const pageKey of HUMAN_PAGE_KEYS) {
				const markup = renderToStaticMarkup(<AgentPage locale={locale} pageKey={pageKey} />);
				const otherLocale = locale === "en" ? "zh" : "en";
				expect(markup.match(/<main/g) ?? []).toHaveLength(1);
				expect(markup.match(/<article/g) ?? []).toHaveLength(1);
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
				expect(markup).toContain("data-claim-id");
				const topic = getAgentTopic(locale, pageKey);
				expect(markup).toContain("<dl");
				expect(markup).toContain(`href="${topic.markdownPath}"`);
				expect(markup).toContain(`href="${agentCatalogPath(locale)}"`);
				expect(markup).toContain(topic.language);
				expect(markup).toContain(topic.lastReviewed);
				expect(markup).toContain(topic.reviewedBy);
				expect(markup).toContain(topic.scope);
				for (const limitation of topic.limitations) expect(markup).toContain(limitation);
				for (const group of topic.groups) {
					expect(markup).toContain(`data-fact-group="${group.id}"`);
					for (const fact of group.facts) {
						expect(markup).toContain(`data-claim-id="${fact.id}"`);
						expect(markup).toContain(fact.value);
					}
				}
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

	it("announces the horizontal topic rail affordance in both independently written interfaces", () => {
		expect(renderToStaticMarkup(<AgentPage locale="en" pageKey="product" />)).toContain(
			'<p class="agent-experience__rail-hint">Swipe topics <span aria-hidden="true">→</span></p>',
		);
		expect(renderToStaticMarkup(<AgentPage locale="zh" pageKey="product" />)).toContain(
			'<p class="agent-experience__rail-hint">横向滑动查看更多 <span aria-hidden="true">→</span></p>',
		);
	});

	it("provides noindex Agent heads with paired Human and machine discovery links", () => {
		for (const locale of ["en", "zh"] as const) {
			for (const pageKey of HUMAN_PAGE_KEYS) {
				const topic = getAgentTopic(locale, pageKey);
				const head = agentPageHead(locale, pageKey);
				expect(head.meta).toContainEqual({ name: "robots", content: "noindex,follow" });
				expect(head.links).toEqual([
					{ rel: "canonical", href: siteHref(topic.humanPath) },
					...machineDiscoveryLinks(locale, pageKey),
				]);
				expect(JSON.parse(head.scripts[0].children)["@graph"]).toHaveLength(4);
			}
		}
	});

	it("wires the shared Agent head contract into all fourteen route exports", () => {
		const routes = [
			["en", "home", agentHomeRoute],
			["en", "product", agentProductRoute],
			["en", "approach", agentApproachRoute],
			["en", "geo", agentGeoRoute],
			["en", "company", agentCompanyRoute],
			["en", "diagnostic", agentDiagnosticRoute],
			["en", "privacy", agentPrivacyRoute],
			["zh", "home", zhAgentHomeRoute],
			["zh", "product", zhAgentProductRoute],
			["zh", "approach", zhAgentApproachRoute],
			["zh", "geo", zhAgentGeoRoute],
			["zh", "company", zhAgentCompanyRoute],
			["zh", "diagnostic", zhAgentDiagnosticRoute],
			["zh", "privacy", zhAgentPrivacyRoute],
		] as const;

		for (const [locale, pageKey, route] of routes) {
			expect(route.options.head?.({} as never), `${locale}/${pageKey}`).toEqual(agentPageHead(locale, pageKey));
		}
	});
});
