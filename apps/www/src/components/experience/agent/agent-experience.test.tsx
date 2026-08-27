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
import { CHINA_PAGES } from "../china/china-pages";
import { GLOBAL_PAGES } from "../global/global-pages";
import * as agentPages from "./agent-pages";

const { AgentPage } = agentPages;

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
	/managed delivery|configured scope|evidence boundary|interface demonstration|no customer data|causal proof|supply chain|implementation detail|upstream AI surface|配置化观察|证据边界|当前演示|非客户数据|内部策略|实现细节|供应链/i;
const retiredVisuals = /global-cinematic|zh-decision|editorial-stage|decision-canvas|global-en__|zh-site__/i;
const publicImplementationNarration =
	/provider acceptance|provider accepts?|delivery service|服务商|投递服务|交付通道|接收机制|without reducing [^.]+ to (?:a )?[^.]+|single AI-search tactic|planned capabilit|规划中的能力|缩成一个 AI 搜索技巧/iu;

const canonicalQuestions = {
	en: {
		home: "What is Yonaris?",
		product: "What does the platform make inspectable?",
		approach: "What remains in a reviewable record?",
		geo: "What changes across markets?",
		company: "How does one company remain clear to both readers?",
		diagnostic: "What does the contact form request?",
		privacy: "How is contact-request data used?",
	},
	zh: {
		home: "Yonaris 是什么？",
		product: "系统把哪些环节接在一起？",
		approach: "一次可复核拆解保留什么？",
		geo: "跨市场判断要保留哪些条件？",
		company: "同一事实怎样同时给人和 Agent 阅读？",
		diagnostic: "预约需要填写什么？",
		privacy: "咨询信息如何使用？",
	},
} as const;

const canonicalQuestionFacts = {
	home: ["yonaris.category.ai-native-martech", "yonaris.purpose.decision-system", "yonaris.scope.martech-system"],
	product: ["yonaris.platform.inspectable-evidence"],
	approach: ["yonaris.evidence.reviewable-record"],
	geo: ["yonaris.market.context-conditions"],
	company: ["yonaris.category.ai-native-martech", "yonaris.purpose.decision-system", "yonaris.scope.martech-system"],
	diagnostic: ["yonaris.contact.three-fields"],
	privacy: ["yonaris.privacy.contact-request"],
} as const;

function textContent(markup: string): string {
	return markup
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

	it("publishes the approved category and wider MarTech system instead of a search tactic", () => {
		const en = JSON.stringify(AGENT_FACTS.global);
		const zh = JSON.stringify(AGENT_FACTS.zh);

		for (const topic of [...Object.values(AGENT_FACTS.global), ...Object.values(AGENT_FACTS.zh)]) {
			expect(topic.reviewedBy).toBe("Yonaris");
		}
		expect(en).toContain("AI-native MarTech infrastructure built for decisions made by people and shaped by agents.");
		expect(zh).toContain("面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。");
		for (const phrase of [
			"buyer questions",
			"company facts",
			"public evidence",
			"customer behaviour",
			"action and review",
		])
			expect(en).toContain(phrase);
		for (const phrase of ["市场问题", "品牌事实", "公开证据", "客户行为", "行动与复核"]) expect(zh).toContain(phrase);
		expect(en).not.toMatch(/GEO platform|single AI-search tactic|black\.dcp@outlook\.com/i);
		expect(zh).not.toMatch(/单纯的 GEO|AI 搜索技巧|black\.dcp@outlook\.com/i);
		expect(en).not.toMatch(/\bmonitor\b|track changes|automatic ranking|real-time ranking|guaranteed outcome/i);
		expect(zh).not.toMatch(/提供持续监控|自动持续监控|自动排名|实时排名|保证结果/);
	});

	it("keeps every Agent fact on a visible semantic Human target with matching evidence", () => {
		for (const [locale, edition, pages] of [
			["en", "global", GLOBAL_PAGES],
			["zh", "zh", CHINA_PAGES],
		] as const) {
			for (const pageKey of HUMAN_PAGE_KEYS) {
				const Page = pages[pageKey];
				const humanMarkup = renderToStaticMarkup(<Page />);
				for (const group of AGENT_FACTS[edition][pageKey].groups) {
					for (const fact of group.facts) {
						const target = humanMarkup.match(
							new RegExp(`<article(?=[^>]*\\bid="${escapeRegex(fact.id)}")[^>]*>[\\s\\S]*?<\\/article>`),
						)?.[0];
						expect(target, `${locale}/${pageKey} must expose visible article ${fact.id}`).toBeTruthy();
						const openingTag = target?.match(/^<article[^>]*>/)?.[0] ?? "";
						expect(openingTag).not.toMatch(/\bhidden(?:=|\s|>)/);
						const visibleText = textContent(target ?? "");
						expect(visibleText).toContain(fact.value);
						expect(visibleText).toContain(fact.source);
						expect(visibleText).toContain(fact.boundary);
					}
				}
			}
		}
	});

	it("renders a machine-first page with an unmistakable return to its Human canonical", () => {
		for (const locale of ["en", "zh"] as const) {
			for (const pageKey of HUMAN_PAGE_KEYS) {
				const markup = renderToStaticMarkup(<AgentPage locale={locale} pageKey={pageKey} />);
				const otherLocale = locale === "en" ? "zh" : "en";
				expect(markup.match(/<main/g) ?? []).toHaveLength(1);
				expect(markup.match(/<article/g)?.length ?? 0).toBeGreaterThan(1);
				expect(markup.match(/<h1/g) ?? []).toHaveLength(1);
				expect(markup).toContain('data-agent-surface="true"');
				expect(markup).toContain(`data-agent-locale="${locale}"`);
				expect(markup).toContain(`data-page-key="${pageKey}"`);
				expect(markup).toContain('data-page-composition="fact-directory"');
				for (const scene of ["question-index", "answer-document", "fact-inspector", "fact-directory"])
					expect(markup).toContain(`data-scene-object="${scene}"`);
				expect(markup).toContain('src="/brand/logos/yonaris-wordmark-white.png"');
				expect(markup).toContain(`href="${humanPath(locale, pageKey)}" data-human-canonical="true"`);
				expect(markup).toContain(`href="${agentPath(locale, pageKey)}" aria-current="page"`);
				expect(markup).toContain('class="mode-link agent-experience__mode-mobile"');
				expect(markup).toContain('data-compact="true"');
				expect(markup).toContain(`href="${agentPath(otherLocale, pageKey)}" data-locale-switch="${otherLocale}"`);
				expect(markup).toContain(locale === "en" ? "Read this topic for people" : "以人类视角阅读本主题");
				expect(markup).toContain("data-fact-group");
				expect(markup).toContain("data-claim-id");
				expect(markup).toContain('id="agent-facts" tabindex="-1"');
				const topic = getAgentTopic(locale, pageKey);
				expect(markup).toContain("<dl");
				expect(markup).toContain(`href="${topic.markdownPath}"`);
				expect(markup).toContain(`href="${agentCatalogPath(locale)}"`);
				expect(markup).toContain(topic.language);
				expect(markup).toContain(topic.lastReviewed);
				expect(markup).toContain(topic.reviewedBy);
				expect(markup).toContain(topic.scope);
				const questions = (
					topic as typeof topic & {
						questions?: readonly { id: string; title: string; factIds: readonly string[] }[];
					}
				).questions;
				expect(questions, `${locale}/${pageKey} needs canonical questions`).toBeDefined();
				expect(questions?.[0]?.title).toBe(canonicalQuestions[locale][pageKey]);
				expect(questions?.[0]?.factIds).toEqual(canonicalQuestionFacts[pageKey]);
				expect(markup).toContain(canonicalQuestions[locale][pageKey]);
				expect(markup).toContain('role="tablist"');
				expect(markup).toContain('role="tab"');
				expect(markup).toContain('aria-live="polite"');
				const initialFactId = questions?.[0]?.factIds[0];
				expect(initialFactId).toBeTruthy();
				expect(markup).toMatch(
					new RegExp(
						`<a(?=[^>]*href="#${escapeRegex(initialFactId ?? "missing")}")(?=[^>]*aria-current="location")[^>]*>`,
					),
				);
				for (const limitation of topic.limitations) expect(markup).toContain(limitation);
				for (const group of topic.groups) {
					expect(markup).toContain(`data-fact-group="${group.id}"`);
					for (const fact of group.facts) {
						const publicFact = fact as typeof fact & { source?: string; boundary?: string };
						expect(markup).toContain(`id="${fact.id}"`);
						expect(markup.match(new RegExp(`\\sid="${escapeRegex(fact.id)}"`, "g")) ?? []).toHaveLength(1);
						expect(markup).toContain(`data-claim-id="${fact.id}"`);
						expect(markup).toContain(`href="#${fact.id}"`);
						expect(markup).toContain(fact.value);
						expect(markup).toContain(`href="${fact.evidenceUrl}"`);
						expect(publicFact.source?.trim()).toBeTruthy();
						expect(publicFact.boundary?.trim()).toBeTruthy();
						expect(markup).toContain(publicFact.source ?? "missing source");
						expect(markup).toContain(publicFact.boundary ?? "missing boundary");
					}
				}
				expect(markup).not.toMatch(retiredRoutes);
				expect(markup).not.toMatch(internalNarration);
				expect(markup).not.toMatch(retiredVisuals);
				expect(markup).not.toMatch(/[↗→↳←]/);
				expect(markup).not.toMatch(/>0[1-9]</);
				expect(markup).toContain("GET");
				expect(markup).toContain("HEAD");
				expect(markup).toContain("text/markdown");
				expect(markup).toContain(locale === "en" ? "Available representations" : "可用读取格式");
				expect(markup).not.toContain(locale === "en" ? "Content negotiation" : "内容协商");
				expect(markup).not.toContain("agent-experience__transport");
				expect(markup).not.toContain('type="search"');
			}
		}
	});

	it("keeps the full Agent introduction on home and exposes inner directories in a compact masthead", () => {
		for (const locale of ["en", "zh"] as const) {
			const home = renderToStaticMarkup(<AgentPage locale={locale} pageKey="home" />);
			const product = renderToStaticMarkup(<AgentPage locale={locale} pageKey="product" />);
			const firstFact = getAgentTopic(locale, "home").groups[0]?.facts[0];
			const dualRecord = home.match(/<article class="agent-experience__dual-record">[\s\S]*?<\/article>/u)?.[0] ?? "";
			expect(home).toContain("agent-experience__home-intro");
			expect(home).toContain("agent-experience__dual-record");
			expect(firstFact).toBeDefined();
			expect(dualRecord.match(new RegExp(escapeRegex(firstFact?.value ?? "missing"), "g")) ?? []).toHaveLength(2);
			expect(product).not.toContain("agent-experience__home-intro");
			expect(product).toContain("agent-experience__route-intro");
			expect(product).toContain('id="agent-fact-inspector" tabindex="-1" aria-live="polite"');
		}
	});

	it("renders every stable fact ID exactly once in the SSR DOM", () => {
		for (const locale of ["en", "zh"] as const) {
			for (const pageKey of HUMAN_PAGE_KEYS) {
				const markup = renderToStaticMarkup(<AgentPage locale={locale} pageKey={pageKey} />);
				const ids = [...markup.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
				expect(new Set(ids).size, `${locale}/${pageKey} contains duplicate DOM IDs`).toBe(ids.length);
			}
		}
	});

	it("moves question selection to its canonical fact and lets a real fact anchor update the inspector", () => {
		const helpers = agentPages as typeof agentPages & {
			resolveAgentDirectorySelection?: (
				topic: ReturnType<typeof getAgentTopic>,
				selection: { questionId?: string; factId?: string },
			) => { questionId: string; factId: string };
			commitAgentFactNavigation?: (
				factId: string,
				runtime: { replaceHash: (hash: string) => void; focusInspector: () => void },
			) => void;
		};
		const resolveSelection = helpers.resolveAgentDirectorySelection;
		expect(resolveSelection, "Agent directory selection must be an explicit tested state transition").toBeTypeOf(
			"function",
		);
		if (!resolveSelection) return;
		const topic = getAgentTopic("en", "home") as ReturnType<typeof getAgentTopic> & {
			questions: readonly { id: string; title: string; factIds: readonly string[] }[];
		};
		const purposeQuestion = topic.questions[1];
		expect(purposeQuestion).toBeDefined();
		if (!purposeQuestion) return;
		expect(resolveSelection(topic, { questionId: purposeQuestion.id })).toEqual({
			questionId: purposeQuestion.id,
			factId: "yonaris.purpose.decision-system",
		});
		expect(
			resolveSelection(topic, {
				questionId: topic.questions[0]?.id,
				factId: "yonaris.scope.martech-system",
			}),
		).toEqual({
			questionId: topic.questions[0]?.id,
			factId: "yonaris.scope.martech-system",
		});

		const navigationEvents: string[] = [];
		expect(helpers.commitAgentFactNavigation).toBeTypeOf("function");
		helpers.commitAgentFactNavigation?.("yonaris.scope.martech-system", {
			replaceHash: (hash) => navigationEvents.push(`hash:${hash}`),
			focusInspector: () => navigationEvents.push("focus:agent-fact-inspector"),
		});
		expect(navigationEvents).toEqual(["hash:#yonaris.scope.martech-system", "focus:agent-fact-inspector"]);
	});

	it("keeps implementation and positioning narration out of every Human and Agent surface", () => {
		const globalHuman = HUMAN_PAGE_KEYS.map((pageKey) => {
			const Page = GLOBAL_PAGES[pageKey];
			return renderToStaticMarkup(<Page />);
		});
		const chinaHuman = HUMAN_PAGE_KEYS.map((pageKey) => {
			const Page = CHINA_PAGES[pageKey];
			return renderToStaticMarkup(<Page />);
		});
		const rendered = [
			...globalHuman,
			...chinaHuman,
			...HUMAN_PAGE_KEYS.map((pageKey) => renderToStaticMarkup(<AgentPage locale="en" pageKey={pageKey} />)),
			...HUMAN_PAGE_KEYS.map((pageKey) => renderToStaticMarkup(<AgentPage locale="zh" pageKey={pageKey} />)),
		].join("\n");

		expect(textContent(rendered)).not.toMatch(publicImplementationNarration);
	});

	it("makes the Agent home a complete topic directory", () => {
		for (const locale of ["en", "zh"] as const) {
			const markup = renderToStaticMarkup(<AgentPage locale={locale} pageKey="home" />);
			for (const pageKey of HUMAN_PAGE_KEYS) {
				expect(markup).toContain(`href="${agentPath(locale, pageKey)}"`);
			}
		}
	});

	it("renders stable facts without template rails", () => {
		const html = renderToStaticMarkup(<AgentPage locale="en" pageKey="company" />);
		expect(html).toContain('id="yonaris.category.ai-native-martech"');
		expect(html).toContain("AI-native MarTech infrastructure built for decisions made by people and shaped by agents.");
		expect(html).toContain('aria-label="Fact directory"');
		expect(html).not.toMatch(/[↗→↳←]/);
		expect(html).not.toMatch(/>0[1-9]</);
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
