import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export interface GeoQuestion {
	id: string;
	title: string;
	description: string;
}

export interface GeoContent {
	meta: PageMeta;
	eyebrow: string;
	boundary: string;
	currentScope: string;
	questions: readonly GeoQuestion[];
	beyondGeo: string;
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "GEO is the first applied workflow, not the category ceiling.",
		description:
			"Observe when a brand enters an AI answer, how it is described and compared, and which exposed evidence can guide a bounded next test.",
	},
	eyebrow: "Applied workflow",
	boundary:
		"GEO is Yonaris's first applied workflow: observing and improving how AI systems discover, describe, compare, and recommend a brand.",
	currentScope:
		"Yonaris applies configured sampling, evidence inspection, and human-reviewed opportunities to defined GEO questions.",
	questions: [
		{
			id: "discovery",
			title: "When does the brand enter an answer?",
			description: "Observe brand inclusion across a reviewed set of market and decision questions.",
		},
		{
			id: "description",
			title: "How is it described?",
			description: "Read the attributes, caveats, and omissions in the sampled response.",
		},
		{
			id: "comparison",
			title: "How is it compared?",
			description: "Inspect named alternatives and the criteria used to frame trade-offs.",
		},
		{
			id: "sources",
			title: "Which exposed sources shape the answer?",
			description:
				"Review available citations and query rewrites without treating absent fields as proof of no retrieval.",
		},
		{
			id: "retest",
			title: "What can be changed and retested?",
			description: "Choose a bounded knowledge or evidence intervention, then repeat the declared observation.",
		},
	],
	beyondGeo:
		"The same evidence discipline can support broader AI-mediated discovery and selection work; that broader system remains the company direction, not a bundle of present-day modules.",
	claims: [
		{
			id: "geo-configured-observation",
			status: "current-software",
			text: "Configured Programs can show sampled mentions, comparisons, individual answers, citations, and exposed query rewrites when available.",
			limitation:
				"Observed coverage is bounded by the selected questions, surfaces, market, language, and collection period.",
		},
		{
			id: "geo-managed-next-tests",
			status: "managed-delivery",
			text: "Yonaris reviews the clearest evidence gaps and frames bounded next tests.",
			limitation: "Recommendations are reviewed by people; changes are not executed autonomously.",
		},
		{
			id: "geo-broader-system",
			status: "direction",
			text: "Yonaris intends to extend the evidence system beyond GEO into broader AI-native marketing decisions.",
			limitation:
				"GEO is the applied workflow available now; the broader vision is not presented as completed software.",
		},
	],
	limitations: [
		"Yonaris does not promise rankings, traffic, universal visibility, or automated remediation.",
		"Changes between samples do not independently prove causal impact.",
	],
} as const satisfies GeoContent;

export const pageZh = {
	meta: {
		title: "GEO 是第一项落地工作流，而不是公司的品类上限。",
		description: "观察品牌何时进入 AI 回答、如何被描述与比较，并依据公开证据选择一项边界清楚的下一步测试。",
	},
	eyebrow: "落地工作流",
	boundary: "GEO 是 Yonaris 的第一项落地工作流：观察并改善 AI 系统如何发现、描述、比较与推荐一个品牌。",
	currentScope: "Yonaris 把已配置的采样、证据检查和人工审核的机会建议，用在定义明确的 GEO 问题上。",
	questions: [
		{ id: "discovery", title: "品牌何时进入回答？", description: "在审核过的市场与决策问题集合中，观察品牌是否出现。" },
		{ id: "description", title: "品牌被怎样描述？", description: "阅读回答样本中的属性、限定条件与遗漏。" },
		{ id: "comparison", title: "品牌如何被比较？", description: "检查答案提到的替代方案，以及用于权衡的标准。" },
		{
			id: "sources",
			title: "哪些公开来源影响了回答？",
			description: "查看可用引用与查询改写，但不把字段缺失当作没有检索的证据。",
		},
		{
			id: "retest",
			title: "哪些内容可以改变并重新测试？",
			description: "选择一项有限的知识或证据干预，再重复已声明的观察。",
		},
	],
	beyondGeo:
		"同样的证据纪律可以服务于更广泛的 AI 介入式发现与选择；这仍是公司的发展方向，而不是一组已经上线的产品模块。",
	claims: [
		{
			id: "geo-configured-observation",
			status: "current-software",
			text: "已配置的 Program 可以展示回答样本中的提及、比较、逐条回答，以及可用的引用和查询改写。",
			limitation: "观察范围受所选问题、界面、市场、语言与采集周期限制。",
		},
		{
			id: "geo-managed-next-tests",
			status: "managed-delivery",
			text: "Yonaris 会审核最清晰的证据缺口，并据此设计边界明确的下一步测试。",
			limitation: "建议需要人工审核，系统不会自主执行变更。",
		},
		{
			id: "geo-broader-system",
			status: "direction",
			text: "Yonaris 希望把这套证据系统从 GEO 延伸到更广泛的 AI 原生营销决策。",
			limitation: "当前可落地的是 GEO 工作流；更广的愿景不会被描述成已经完成的软件。",
		},
	],
	limitations: ["Yonaris 不承诺排名、流量、全量可见度或自动修复。", "样本间的变化不能独立证明因果影响。"],
} as const satisfies GeoContent;

export const geoContentByLocale: DeepReadonly<Record<Locale, GeoContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getGeoContent(locale: Locale): DeepReadonly<GeoContent> {
	return geoContentByLocale[locale];
}
