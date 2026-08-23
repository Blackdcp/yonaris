import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export type EvidenceLoopStepId = "frame" | "question-set" | "sample" | "compare" | "inspect" | "repeat";
export type ApproachClaim = FactualClaim & { limitation: string };

export interface ApproachLineBreakPhrases {
	headline: readonly string[];
	methodTitle: readonly string[];
	nextTitle: readonly string[];
}

export interface EvidenceLoopStep {
	id: EvidenceLoopStepId;
	title: string;
	summary: string;
	evidenceLabel: string;
	evidenceValue: string;
	claimIds: readonly ApproachClaim["id"][];
}

export interface ApproachHomePreview {
	title: string;
	summary: string;
	steps: readonly [string, string, string];
	claimIds: readonly ApproachClaim["id"][];
}

export interface ApproachContent {
	meta: PageMeta;
	eyebrow: string;
	headline: string;
	currentScope: string;
	currentScopeClaimIds: readonly ApproachClaim["id"][];
	labels: {
		currentScope: string;
		currentSoftware: string;
		managedDelivery: string;
		limitation: string;
	};
	loop: {
		eyebrow: string;
		title: string;
		description: string;
		claimIds: readonly ApproachClaim["id"][];
		claims: readonly ApproachClaim[];
		ui: {
			processLabel: string;
			evidenceRecordLabel: string;
			activeStepLabel: string;
			evidenceArtifactLabel: string;
			capabilityContextLabel: string;
			limitationLabel: string;
			currentSoftwareLabel: string;
			managedDeliveryLabel: string;
		};
		steps: readonly EvidenceLoopStep[];
	};
	method: {
		eyebrow: string;
		name: string;
		title: string;
		summary: string;
		boundary: string;
		claimIds: readonly ApproachClaim["id"][];
	};
	nonCausalityNote: string;
	nonCausalityClaimIds: readonly ApproachClaim["id"][];
	homePreview: ApproachHomePreview;
	next: {
		eyebrow: string;
		title: string;
		productLabel: string;
		diagnosticLabel: string;
	};
	claims: readonly ApproachClaim[];
	limitations: readonly string[];
}

const enCurrentScope = {
	id: "approach-current-scope",
	status: "managed-delivery",
	text: "Yonaris combines configured software evidence with human review to frame, observe, inspect, and repeat one defined market test.",
	limitation: "The workflow is service-led today; collection conditions and review scope are agreed before execution.",
} as const satisfies ApproachClaim;

const enFrame = {
	id: "approach-frame",
	status: "managed-delivery",
	text: "Yonaris frames one market and one decision question before collection begins.",
	limitation: "The frame reflects the agreed diagnostic or Program scope, not a universal view of the market.",
} as const satisfies ApproachClaim;

const enQuestionSet = {
	id: "approach-question-set",
	status: "managed-delivery",
	text: "Branded and non-branded questions are reviewed as one declared set before sampling.",
	limitation: "A question set represents the buying context it was designed to test, not every possible prompt.",
} as const satisfies ApproachClaim;

const enSample = {
	id: "approach-sample",
	status: "managed-delivery",
	text: "Named AI providers and supported consumer surfaces are sampled under declared market, language, timing, and cohort conditions.",
	limitation:
		"Some consumer-surface collection remains operator-managed and coverage is neither continuous nor universal.",
} as const satisfies ApproachClaim;

const enCompare = {
	id: "approach-compare",
	status: "current-software",
	text: "The workspace compares mentions, configured-cohort competitor share, citations, and exposed query fan-out when available.",
	limitation:
		"Unavailable citations or queries are recorded as unknown; they do not establish that no search occurred.",
} as const satisfies ApproachClaim;

const enInspect = {
	id: "approach-inspect",
	status: "current-software",
	text: "Reviewers can inspect underlying sampled answers before forming a conclusion or choosing a next test.",
	limitation: "A sampled answer is evidence within its declared conditions, not a complete account of the market.",
} as const satisfies ApproachClaim;

const enRepeat = {
	id: "approach-repeat",
	status: "current-software",
	text: "The same defined cohort can be observed again after one bounded intervention.",
	limitation: "Repeated observations show change over time; they do not by themselves prove what caused the change.",
} as const satisfies ApproachClaim;

const enRecursiveForest = {
	id: "approach-recursive-forest",
	status: "managed-delivery",
	text: "Recursive Forest is Yonaris's working method for extending finite product facts into questions shaped by context and conditions.",
	limitation:
		"It is a working method, not an implemented graph product architecture or a claim of exhaustive coverage.",
} as const satisfies ApproachClaim;

const enClaims = [
	enCurrentScope,
	enFrame,
	enQuestionSet,
	enSample,
	enCompare,
	enInspect,
	enRepeat,
	enRecursiveForest,
] as const;

export const pageEn = {
	meta: {
		title: "A repeatable evidence loop, not a generic score.",
		description:
			"Follow one declared market question from scope and sampling through evidence review, a bounded intervention, and repeat observation.",
	},
	eyebrow: "Approach · Evidence protocol",
	headline: "A repeatable evidence loop, not a generic score.",
	currentScope: enCurrentScope.text,
	currentScopeClaimIds: [enCurrentScope.id],
	labels: {
		currentScope: "Current scope",
		currentSoftware: "Current software",
		managedDelivery: "Managed delivery",
		limitation: "Boundary",
	},
	loop: {
		eyebrow: "One question · Six controlled moves",
		title: "Keep the question, the evidence, and the next move in one chain.",
		description:
			"The sequence preserves the conditions behind each observation so a later comparison still means something.",
		claimIds: [enFrame.id, enQuestionSet.id, enSample.id, enCompare.id, enInspect.id, enRepeat.id],
		claims: enClaims,
		ui: {
			processLabel: "Six-step evidence loop",
			evidenceRecordLabel: "Active evidence record",
			activeStepLabel: "Active step",
			evidenceArtifactLabel: "Evidence artifact",
			capabilityContextLabel: "Operating reality",
			limitationLabel: "Boundary",
			currentSoftwareLabel: "Current software",
			managedDeliveryLabel: "Managed delivery",
		},
		steps: [
			{
				id: "frame",
				title: "Frame the decision",
				summary: enFrame.text,
				evidenceLabel: "Declared scope",
				evidenceValue: "One market · One decision question",
				claimIds: [enFrame.id],
			},
			{
				id: "question-set",
				title: "Build the question set",
				summary: enQuestionSet.text,
				evidenceLabel: "Reviewed question set",
				evidenceValue: "Branded · Non-branded · Decision-shaped",
				claimIds: [enQuestionSet.id],
			},
			{
				id: "sample",
				title: "Declare and sample",
				summary: enSample.text,
				evidenceLabel: "Sampling note",
				evidenceValue: "Surfaces · Market · Language · Timing · Cohort",
				claimIds: [enSample.id],
			},
			{
				id: "compare",
				title: "Compare the evidence",
				summary: enCompare.text,
				evidenceLabel: "Comparison set",
				evidenceValue: "Mentions · Competitor share · Citations · Available fan-out",
				claimIds: [enCompare.id],
			},
			{
				id: "inspect",
				title: "Inspect the answers",
				summary: enInspect.text,
				evidenceLabel: "Answer review",
				evidenceValue: "Underlying responses · Known states · Unknown states",
				claimIds: [enInspect.id],
			},
			{
				id: "repeat",
				title: "Change one bounded input",
				summary: enRepeat.text,
				evidenceLabel: "Repeat record",
				evidenceValue: "Same cohort · Bounded change · Later observation",
				claimIds: [enRepeat.id],
			},
		],
	},
	method: {
		eyebrow: "Working method",
		name: "Recursive Forest",
		title: "Do not enumerate every question. Govern what generates them.",
		summary: enRecursiveForest.text,
		boundary: enRecursiveForest.limitation,
		claimIds: [enRecursiveForest.id],
	},
	nonCausalityNote: enRepeat.limitation,
	nonCausalityClaimIds: [enRepeat.id],
	homePreview: {
		title: "One question becomes a reviewable evidence loop",
		summary: "Declare the test, inspect the underlying evidence, and repeat the same defined cohort.",
		steps: ["Declare the scope", "Inspect the evidence", "Repeat the test"],
		claimIds: [enFrame.id, enCompare.id, enInspect.id, enRepeat.id],
	},
	next: {
		eyebrow: "Put the method to work",
		title: "Start with one market question that matters.",
		productLabel: "Inspect the product",
		diagnosticLabel: "Get a Free Diagnostic",
	},
	claims: enClaims,
	limitations: [enCurrentScope.limitation, enRepeat.limitation, enRecursiveForest.limitation],
} as const satisfies ApproachContent;

const zhCurrentScope = {
	id: "approach-current-scope",
	status: "managed-delivery",
	text: "Yonaris 把软件中可复核的证据与人工判断放在同一条流程里，用明确的市场测试串起界定、观察、检查与复测",
	limitation: "当前流程由团队服务驱动，执行前会共同确认采集条件和复核范围",
} as const satisfies ApproachClaim;

const zhFrame = {
	id: "approach-frame",
	status: "managed-delivery",
	text: "采集开始前，Yonaris 会先明确一个市场和一个真正影响决策的问题",
	limitation: "范围以双方确认的诊断或 Program 为准，并不代表整个市场",
} as const satisfies ApproachClaim;

const zhQuestionSet = {
	id: "approach-question-set",
	status: "managed-delivery",
	text: "品牌相关与非品牌相关的问题会先组成一组边界明确的问题集，再进入采样",
	limitation: "问题集只代表它所要检验的购买语境，不等于所有可能出现的提问",
} as const satisfies ApproachClaim;

const zhSample = {
	id: "approach-sample",
	status: "managed-delivery",
	text: "在已声明的市场、语言、时间与样本条件下，Yonaris 采集指定 AI 服务商和支持的消费端界面",
	limitation: "部分消费端采集仍由团队执行，覆盖并非持续、实时或无边界",
} as const satisfies ApproachClaim;

const zhCompare = {
	id: "approach-compare",
	status: "current-software",
	text: "工作区可以比较品牌提及、同一竞品集合内的声量、引用，以及服务商公开的查询改写",
	limitation: "不可用的引用或查询会保留为未知状态，不能据此判断没有发生搜索",
} as const satisfies ApproachClaim;

const zhInspect = {
	id: "approach-inspect",
	status: "current-software",
	text: "形成结论或选择下一项测试前，复核者可以回到每一条回答样本检查原文",
	limitation: "一条回答只是在既定条件下取得的证据，不是对市场的完整描述",
} as const satisfies ApproachClaim;

const zhRepeat = {
	id: "approach-repeat",
	status: "current-software",
	text: "完成一个边界清楚的干预后，可以用同一定义再次观察相同样本集合",
	limitation: "重复观察能够呈现变化，但仅凭这些观察无法证明变化由什么造成",
} as const satisfies ApproachClaim;

const zhRecursiveForest = {
	id: "approach-recursive-forest",
	status: "managed-delivery",
	text: "递归森林是 Yonaris 的工作方法：从有限的产品事实出发，让问题随语境与条件继续展开",
	limitation: "它是一套工作方法，不是已经实现的图谱产品架构，也不意味着可以穷尽市场",
} as const satisfies ApproachClaim;

const zhClaims = [
	zhCurrentScope,
	zhFrame,
	zhQuestionSet,
	zhSample,
	zhCompare,
	zhInspect,
	zhRepeat,
	zhRecursiveForest,
] as const;

export const pageZh = {
	meta: {
		title: "建立可重复的证据循环，而不是制造一个泛化分数",
		description: "让一个明确的市场问题依次经过范围界定、问题审核、采样、证据检查、有限干预与重复观察",
	},
	eyebrow: "方法 · 证据协议",
	headline: "建立可重复的证据循环，而不是制造一个泛化分数",
	currentScope: zhCurrentScope.text,
	currentScopeClaimIds: [zhCurrentScope.id],
	labels: {
		currentScope: "当前范围",
		currentSoftware: "当前软件",
		managedDelivery: "团队交付",
		limitation: "边界",
	},
	loop: {
		eyebrow: "一个问题 · 六个受控动作",
		title: "让问题、证据与下一步始终处在同一条链路里",
		description: "每次观察都保留它成立的条件，让下一次比较仍然有意义",
		claimIds: [zhFrame.id, zhQuestionSet.id, zhSample.id, zhCompare.id, zhInspect.id, zhRepeat.id],
		claims: zhClaims,
		ui: {
			processLabel: "六步证据循环",
			evidenceRecordLabel: "当前证据记录",
			activeStepLabel: "当前步骤",
			evidenceArtifactLabel: "证据产物",
			capabilityContextLabel: "实际交付状态",
			limitationLabel: "边界",
			currentSoftwareLabel: "当前软件",
			managedDeliveryLabel: "团队交付",
		},
		steps: [
			{
				id: "frame",
				title: "确定决策问题",
				summary: zhFrame.text,
				evidenceLabel: "声明范围",
				evidenceValue: "一个市场 · 一个决策问题",
				claimIds: [zhFrame.id],
			},
			{
				id: "question-set",
				title: "建立问题集合",
				summary: zhQuestionSet.text,
				evidenceLabel: "已审核问题集",
				evidenceValue: "品牌相关 · 非品牌相关 · 面向决策",
				claimIds: [zhQuestionSet.id],
			},
			{
				id: "sample",
				title: "声明范围并采样",
				summary: zhSample.text,
				evidenceLabel: "采样说明",
				evidenceValue: "界面 · 市场 · 语言 · 时间 · 样本集合",
				claimIds: [zhSample.id],
			},
			{
				id: "compare",
				title: "比较证据",
				summary: zhCompare.text,
				evidenceLabel: "比较集合",
				evidenceValue: "提及 · 竞品声量 · 引用 · 可见查询改写",
				claimIds: [zhCompare.id],
			},
			{
				id: "inspect",
				title: "检查原始回答",
				summary: zhInspect.text,
				evidenceLabel: "回答复核",
				evidenceValue: "回答原文 · 已知状态 · 未知状态",
				claimIds: [zhInspect.id],
			},
			{
				id: "repeat",
				title: "改变一个有限变量",
				summary: zhRepeat.text,
				evidenceLabel: "复测记录",
				evidenceValue: "相同样本 · 有限改变 · 后续观察",
				claimIds: [zhRepeat.id],
			},
		],
	},
	method: {
		eyebrow: "工作方法",
		name: "递归森林",
		title: "不穷举每一个问题，而是治理问题如何生长",
		summary: zhRecursiveForest.text,
		boundary: zhRecursiveForest.limitation,
		claimIds: [zhRecursiveForest.id],
	},
	nonCausalityNote: zhRepeat.limitation,
	nonCausalityClaimIds: [zhRepeat.id],
	homePreview: {
		title: "让一个问题进入可复核的证据循环",
		summary: "先声明测试，再检查底层证据，最后用同一定义复测",
		steps: ["声明范围", "检查证据", "重复测试"],
		claimIds: [zhFrame.id, zhCompare.id, zhInspect.id, zhRepeat.id],
	},
	next: {
		eyebrow: "把方法用于真实问题",
		title: "从一个真正影响市场决策的问题开始",
		productLabel: "查看产品",
		diagnosticLabel: "获取免费诊断",
	},
	claims: zhClaims,
	limitations: [zhCurrentScope.limitation, zhRepeat.limitation, zhRecursiveForest.limitation],
} as const satisfies ApproachContent;

export const approachContentByLocale: DeepReadonly<Record<Locale, ApproachContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

const approachLineBreakPhrasesByLocale: DeepReadonly<Record<Locale, ApproachLineBreakPhrases>> = deepFreeze({
	en: {
		headline: [],
		methodTitle: [],
		nextTitle: [],
	},
	zh: {
		headline: ["一个"],
		methodTitle: ["一个问题，", "而是治理问题"],
		nextTitle: ["影响市场决策"],
	},
});

export function getApproachContent(locale: Locale): DeepReadonly<ApproachContent> {
	return approachContentByLocale[locale];
}

export function getApproachLineBreakPhrases(locale: Locale): DeepReadonly<ApproachLineBreakPhrases> {
	return approachLineBreakPhrasesByLocale[locale];
}
