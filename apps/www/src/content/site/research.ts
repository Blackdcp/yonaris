import type { PageMeta } from "./global";
import type { FactualClaim, Locale } from "./types";

export interface EvidenceRecord {
	label: string;
	title: string;
	scope: string;
	date: string;
	sampleCount: string;
	metricDefinition: string;
	question: string;
	surface: string;
	answer: string;
	citations: readonly string[];
	exposedQueries: readonly string[];
	known: readonly string[];
	unknown: readonly string[];
}

export interface ResearchContent {
	meta: PageMeta;
	eyebrow: string;
	currentScope: string;
	measurementDesign: string;
	definitions: { visibility: string; shareOfVoice: string };
	record: EvidenceRecord;
	comparisonGuidance: string;
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "Every finding should show its scope.",
		description:
			"Read the question, surface, date, denominator, answer evidence, and unknowns before interpreting a finding.",
	},
	eyebrow: "Research ledger",
	currentScope:
		"This first release documents measurement definitions and an explanatory evidence record; it publishes no customer outcome as verified evidence.",
	measurementDesign:
		"Declare the Program, question cohort, surfaces, market, language, time window, and denominator before comparing observations.",
	definitions: {
		visibility:
			"Visibility is the share of sampled answers in the declared cohort that mention the tracked brand: answers mentioning the brand divided by all sampled answers in scope.",
		shareOfVoice:
			"Configured-cohort share of voice is the tracked brand's mentions divided by all mentions of the tracked brand and the named competitor cohort in the same scoped samples.",
	},
	record: {
		label: "Illustrative",
		title: "How one scoped answer record is read",
		scope: "Example category · United States · English · one declared question",
		date: "Illustrative collection date: 2026-08-01",
		sampleCount: "One explanatory answer, not a published study",
		metricDefinition: "No aggregate metric is inferred from this single record.",
		question: "Which approach should a growing team evaluate for this decision?",
		surface: "Example AI surface",
		answer:
			"A redacted explanatory answer would appear here so a reviewer can inspect the language used, not only a derived score.",
		citations: [
			"Example source A — shown only to demonstrate evidence fields",
			"Example source B — shown only to demonstrate evidence fields",
		],
		exposedQueries: ["Example query rewrite — available only when the surface exposes it"],
		known: [
			"Declared scope and question",
			"Answer text returned in the example",
			"Evidence fields exposed by the example surface",
		],
		unknown: [
			"Why the provider selected this wording",
			"Whether unexposed retrieval occurred",
			"Whether an intervention caused a later difference",
		],
	},
	comparisonGuidance:
		"For a before-and-after comparison, keep the declared cohort and collection conditions as stable as practical, report both denominators, inspect the underlying answers, and record material provider changes.",
	claims: [
		{
			id: "research-example-record",
			status: "illustrative",
			text: "The evidence record demonstrates how scope, answer text, citations, exposed queries, knowns, and unknowns can be presented together.",
			limitation: "The record is explanatory and is not customer evidence or a performance result.",
		},
		{
			id: "research-example-comparison",
			status: "illustrative",
			text: "The comparison guidance demonstrates how a defined cohort can be examined across two observations.",
			limitation: "No illustrative difference should be interpreted as verified lift or causal impact.",
		},
	],
	limitations: [
		"Repeated observations do not independently prove that an intervention caused a change.",
		"No customer result, logo, quote, or anonymized performance statistic is included in this release.",
	],
} as const satisfies ResearchContent;

export const pageZh = {
	meta: {
		title: "每一项发现，都应该带着它的范围。",
		description: "先看问题、界面、日期、分母、回答证据与未知项，再解释一项发现。",
	},
	eyebrow: "研究账本",
	currentScope: "首版只公开测量定义与一条解释性证据记录，不把任何客户结果当作已验证证据发布。",
	measurementDesign: "比较之前，先声明 Program、问题集合、AI 界面、市场、语言、时间窗口与指标分母。",
	definitions: {
		visibility: "可见度是明确样本集合中提及目标品牌的回答占比：提及品牌的回答数，除以范围内全部回答数。",
		shareOfVoice: "指定竞品集合内的声量份额，是目标品牌提及次数除以同一批样本中目标品牌与已命名竞品的全部提及次数。",
	},
	record: {
		label: "示例",
		title: "如何阅读一条有明确范围的回答记录",
		scope: "示例品类 · 美国 · 英语 · 一个已声明问题",
		date: "示例采集日期：2026-08-01",
		sampleCount: "一条用于说明的回答，不是已发布研究",
		metricDefinition: "不能从这一条记录推导总体指标。",
		question: "面对这一决策，成长中的团队应该评估哪种方案？",
		surface: "示例 AI 界面",
		answer: "这里会显示一段经过脱敏的说明性回答，让读者检查具体措辞，而不只看到一个派生分数。",
		citations: ["示例来源 A——仅用于说明证据字段", "示例来源 B——仅用于说明证据字段"],
		exposedQueries: ["示例查询改写——只有界面公开时才会出现"],
		known: ["已声明的范围与问题", "示例中返回的回答文字", "示例界面公开的证据字段"],
		unknown: ["服务商为何选择这些措辞", "是否发生了未公开的检索", "某次干预是否造成后续差异"],
	},
	comparisonGuidance:
		"进行前后比较时，应尽量保持样本集合与采集条件稳定，分别报告两次分母，阅读原始回答，并记录服务商的重大变化。",
	claims: [
		{
			id: "research-example-record",
			status: "illustrative",
			text: "这条证据记录用于说明如何把范围、回答、引用、公开查询、已知项与未知项放在一起呈现。",
			limitation: "它只是解释性材料，不是客户证据或业绩结果。",
		},
		{
			id: "research-example-comparison",
			status: "illustrative",
			text: "比较说明展示了如何在两个观察时点检查同一明确定义的样本集合。",
			limitation: "示例中的任何差异都不应被解释为已验证提升或因果影响。",
		},
	],
	limitations: ["重复观察不能独立证明变化由某项干预造成。", "本版本不包含客户结果、标志、引语或匿名业绩数据。"],
} as const satisfies ResearchContent;

export const researchContentByLocale: Readonly<Record<Locale, ResearchContent>> = Object.freeze({
	en: pageEn,
	zh: pageZh,
});

export function getResearchContent(locale: Locale): ResearchContent {
	return researchContentByLocale[locale];
}
