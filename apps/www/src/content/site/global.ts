import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export interface PageMeta {
	title: string;
	description: string;
}

export interface GlobalContent {
	meta: PageMeta;
	category: string;
	vision: string;
	productPromise: string;
	diagnosticOffer: string;
	currentScope: string;
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "See how AI is shaping your market.",
		description:
			"Review how configured AI systems describe and compare your brand, with the evidence behind each sampled answer.",
	},
	category: "AI-native MarTech",
	vision: "MarTech, rebuilt. For humans and agents.",
	productPromise: "Make AI market answers observable.",
	diagnosticOffer: "Give us one brand, one market, and one question that matters.",
	currentScope:
		"Yonaris provides configured answer sampling, reviewable market evidence, and team-reviewed next-test opportunities through an early service-led product.",
	claims: [
		{
			id: "home-observable-answers",
			status: "current-software",
			text: "Configured answer samples can be inspected alongside brand and competitor mentions, citations, and provider-exposed queries.",
			limitation: "Evidence availability depends on the configured Program and what each surface exposes.",
		},
		{
			id: "home-managed-delivery",
			status: "managed-delivery",
			text: "Yonaris operates parts of collection and reviews recommended next tests with customers.",
			limitation: "The complete workflow is not public self-service software.",
		},
		{
			id: "home-human-agent-vision",
			status: "direction",
			text: "Yonaris intends to build MarTech that serves human teams and software agents from a shared factual core.",
			limitation: "This is the company direction, not a claim that every envisioned module exists today.",
		},
	],
	limitations: [
		"Sampling is configured rather than universal or real time.",
		"A diagnostic request begins a scope review; it does not return an instant scan or score.",
	],
} as const satisfies GlobalContent;

export const pageZh = {
	meta: {
		title: "看清 AI 如何塑造你的市场",
		description: "在明确的采样范围内，查看 AI 如何描述和比较你的品牌，并回到每条回答背后的证据。",
	},
	category: "AI 原生营销科技",
	vision: "重构 MarTech，同时面向人，也面向智能体。",
	productPromise: "让 AI 市场回答变得可观察。",
	diagnosticOffer: "告诉我们一个品牌、一个市场，以及一个真正重要的问题。",
	currentScope:
		"Yonaris 目前以服务驱动的早期产品形态，提供按配置采集的回答样本、可复核的市场证据，以及经团队审核的下一步测试建议。",
	claims: [
		{
			id: "home-observable-answers",
			status: "current-software",
			text: "用户可以逐条检查已配置的回答样本，并查看品牌及竞品提及、引用来源和服务商公开的查询改写。",
			limitation: "证据是否可见，取决于 Program 的配置以及具体 AI 界面所公开的信息。",
		},
		{
			id: "home-managed-delivery",
			status: "managed-delivery",
			text: "部分采集由 Yonaris 团队执行，下一步测试机会也会经过人工审阅。",
			limitation: "完整流程尚不是可公开自助使用的软件。",
		},
		{
			id: "home-human-agent-vision",
			status: "direction",
			text: "Yonaris 计划构建一套让人类团队与软件智能体共享同一事实基础的 MarTech。",
			limitation: "这是公司的发展方向，并不表示设想中的每个模块都已上线。",
		},
	],
	limitations: [
		"采样范围需要预先配置，并非覆盖所有模型或实时运行。",
		"提交诊断申请后会先确认范围，不会立即生成扫描结果或分数。",
	],
} as const satisfies GlobalContent;

export const globalContentByLocale: DeepReadonly<Record<Locale, GlobalContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getGlobalContent(locale: Locale): DeepReadonly<GlobalContent> {
	return globalContentByLocale[locale];
}
