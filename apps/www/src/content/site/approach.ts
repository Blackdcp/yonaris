import type { PageMeta } from "./global";
import type { FactualClaim, Locale } from "./types";

export interface ApproachStep {
	id: string;
	title: string;
	description: string;
}

export interface ApproachContent {
	meta: PageMeta;
	eyebrow: string;
	methodName: string;
	methodBoundary: string;
	currentScope: string;
	steps: readonly ApproachStep[];
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "A repeatable evidence loop, not a generic score.",
		description:
			"Follow one declared market question from scope and sampling through evidence review, a bounded intervention, and repeat observation.",
	},
	eyebrow: "Evidence loop",
	methodName: "Recursive Forest",
	methodBoundary:
		"Recursive Forest is a working method for growing useful questions and evidence from declared facts, not an implemented graph product architecture.",
	currentScope:
		"Yonaris combines configured software evidence with human review to frame, observe, inspect, and repeat a defined market test.",
	steps: [
		{
			id: "frame",
			title: "Frame the decision",
			description: "Choose one market and one decision question that matters.",
		},
		{
			id: "questions",
			title: "Build the question set",
			description: "Review branded and non-branded questions before collection.",
		},
		{
			id: "sample",
			title: "Declare and sample",
			description: "Name the AI surfaces, market, language, timing, and cohort being observed.",
		},
		{
			id: "compare",
			title: "Compare the evidence",
			description: "Review mentions, competitor share, citations, and available query fan-out.",
		},
		{
			id: "inspect",
			title: "Read the answers",
			description: "Inspect underlying responses and unknown states before drawing conclusions.",
		},
		{
			id: "repeat",
			title: "Change one bounded input",
			description: "Make a defined intervention, then repeat the same test to observe change.",
		},
	],
	claims: [
		{
			id: "approach-declared-scope",
			status: "current-software",
			text: "Programs preserve a declared scope and reviewable answer samples.",
			limitation: "Comparison is meaningful only within the declared cohort and collection conditions.",
		},
		{
			id: "approach-human-review",
			status: "managed-delivery",
			text: "Question sets, evidence interpretation, and next-test opportunities include human review.",
			limitation: "The method is not an autonomous decision or publishing system.",
		},
		{
			id: "approach-repeat-observation",
			status: "current-software",
			text: "A defined cohort can be observed again to compare sampled answers over time.",
			limitation: "A before-and-after difference does not by itself identify why the change occurred.",
		},
	],
	limitations: [
		"Repeated observation can show change over time but does not independently prove causation.",
		"Provider behavior and exposed evidence can change outside the tested intervention.",
	],
} as const satisfies ApproachContent;

export const pageZh = {
	meta: {
		title: "一套可重复的证据循环，而不是泛化分数。",
		description: "让一个明确的市场问题依次经过范围界定、采样、证据复核、有限干预与重复观察。",
	},
	eyebrow: "证据循环",
	methodName: "递归森林",
	methodBoundary: "递归森林是一套从明确事实出发，持续生长问题与证据的工作方法，并非已经实现的图架构产品。",
	currentScope: "Yonaris 将已配置的软件证据与人工审核结合，用来界定、观察、检查并重复一项明确的市场测试。",
	steps: [
		{ id: "frame", title: "确定决策问题", description: "选择一个市场，以及一个真正影响决策的问题。" },
		{ id: "questions", title: "建立问题集合", description: "在采集前共同审核品牌词与非品牌词问题。" },
		{ id: "sample", title: "声明范围并采样", description: "写明要观察的 AI 界面、市场、语言、时间与样本集合。" },
		{ id: "compare", title: "比较证据", description: "比较品牌提及、竞品声量、引用，以及可见的查询扩展。" },
		{ id: "inspect", title: "阅读原始回答", description: "先查看回答全文与未知状态，再形成判断。" },
		{ id: "repeat", title: "改变一个有限变量", description: "完成边界清楚的干预后，用相同定义再观察一次。" },
	],
	claims: [
		{
			id: "approach-declared-scope",
			status: "current-software",
			text: "Program 会保留已声明的范围和可复核的回答样本。",
			limitation: "只有在声明的样本集合与采集条件内，比较才具有明确含义。",
		},
		{
			id: "approach-human-review",
			status: "managed-delivery",
			text: "问题集、证据解释和下一步测试机会都会经过人工审核。",
			limitation: "这套方法不是自主决策或自动发布系统。",
		},
		{
			id: "approach-repeat-observation",
			status: "current-software",
			text: "可以再次观察同一定义的样本集合，比较不同时点的回答。",
			limitation: "前后差异本身无法说明变化为何发生。",
		},
	],
	limitations: [
		"重复观察能够展示随时间发生的变化，但不能独立证明因果关系。",
		"服务商行为和其公开的证据可能在测试干预之外发生变化。",
	],
} as const satisfies ApproachContent;

export const approachContentByLocale: Readonly<Record<Locale, ApproachContent>> = Object.freeze({
	en: pageEn,
	zh: pageZh,
});

export function getApproachContent(locale: Locale): ApproachContent {
	return approachContentByLocale[locale];
}
