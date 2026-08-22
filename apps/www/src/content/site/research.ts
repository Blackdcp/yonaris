import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export type EvidenceAvailability<T> = { state: "known"; value: T } | { state: "unknown"; reason: string };
export type ResearchClaim = FactualClaim & { limitation: string };

export interface ResearchItem {
	id: string;
	text: string;
}

export interface MetricDefinition {
	id: "visibility" | "share-of-voice";
	label: string;
	definition: string;
	numerator: string;
	denominator: string;
	limitation: string;
	claimIds: readonly ResearchClaim["id"][];
}

export interface IllustrativeEvidenceRecord {
	id: "illustrative-record-01";
	status: "illustrative";
	label: string;
	title: string;
	scope: string;
	observedAtIso: string;
	observedAtLabel: string;
	sampleCount: number;
	question: string;
	surface: string;
	answer: string;
	citations: EvidenceAvailability<readonly ResearchItem[]>;
	exposedQueries: EvidenceAvailability<readonly ResearchItem[]>;
	findings: readonly ResearchItem[];
	unknowns: readonly ResearchItem[];
	claimIds: readonly ResearchClaim["id"][];
}

export interface ResearchHomePreview {
	title: string;
	scope: string;
	denominator: string;
	limitation: string;
	claimIds: readonly ResearchClaim["id"][];
}

interface ResearchMeasurement {
	eyebrow: string;
	title: string;
	summary: string;
	scopeLabel: string;
	scopeItems: readonly ResearchItem[];
	claimIds: readonly ResearchClaim["id"][];
}

interface ResearchComparison {
	eyebrow: string;
	title: string;
	guidance: string;
	limitation: string;
	claimIds: readonly ResearchClaim["id"][];
}

interface ResearchLabels {
	known: string;
	unknown: string;
	definition: string;
	numerator: string;
	denominator: string;
	limitation: string;
	recordMetadata: string;
	scope: string;
	observedAt: string;
	sampleCount: string;
	question: string;
	surface: string;
	answer: string;
	citations: string;
	exposedQueries: string;
	findings: string;
	unknowns: string;
}

interface ResearchNext {
	eyebrow: string;
	title: string;
	approachLabel: string;
	diagnosticLabel: string;
}

export interface ResearchContent {
	meta: PageMeta;
	eyebrow: string;
	headline: string;
	dek: string;
	currentScope: string;
	currentScopeClaimIds: readonly ResearchClaim["id"][];
	measurement: ResearchMeasurement;
	metricsEyebrow: string;
	metricsTitle: string;
	metrics: readonly MetricDefinition[];
	recordEyebrow: string;
	record: IllustrativeEvidenceRecord;
	comparison: ResearchComparison;
	nonCausalityNote: string;
	nonCausalityClaimIds: readonly ResearchClaim["id"][];
	homePreview: ResearchHomePreview;
	labels: ResearchLabels;
	next: ResearchNext;
	claims: readonly ResearchClaim[];
	limitations: readonly string[];
}

const enDeclaredScope = {
	id: "research-declared-scope",
	status: "current-software",
	text: "Yonaris keeps each observation attached to its configured Program, question cohort, surface, market, language, and collection window.",
	limitation: "The record describes its declared filter, not universal market coverage.",
} as const satisfies ResearchClaim;

const enVisibilityDefinition = {
	id: "research-visibility-definition",
	status: "current-software",
	text: "Visibility counts valid sampled answers that mention the tracked brand against every valid sampled answer in the active declared filter.",
	limitation: "The value applies only to the samples and filters included in its denominator.",
} as const satisfies ResearchClaim;

const enConfiguredSovDefinition = {
	id: "research-configured-sov-definition",
	status: "current-software",
	text: "Configured-cohort share of voice compares tracked-brand mentions with tracked-brand plus configured-competitor mentions in the same cohort.",
	limitation: "Changing the competitor set or cohort changes the denominator and breaks a direct comparison.",
} as const satisfies ResearchClaim;

const enRepeatObservation = {
	id: "research-repeat-observation",
	status: "current-software",
	text: "Separately collected observations can be compared when their declared cohorts and conditions remain materially aligned.",
	limitation: "A repeated observation can show a difference over time but does not independently establish causation.",
} as const satisfies ResearchClaim;

const enIllustrativeRecord = {
	id: "research-illustrative-record",
	status: "illustrative",
	text: "The Aster Vale Systems ledger record demonstrates how one answer, its available sources, findings, and unknowns can be reviewed together.",
	limitation: "Aster Vale Systems and every field in this record are fictional; this is not customer evidence or a performance result.",
} as const satisfies ResearchClaim;

const enClaims = [
	enDeclaredScope,
	enVisibilityDefinition,
	enConfiguredSovDefinition,
	enRepeatObservation,
	enIllustrativeRecord,
] as const;

export const pageEn = {
	meta: {
		title: "Every finding should show its scope.",
		description:
			"Inspect Yonaris measurement definitions, denominators, answer evidence, and unknowns before interpreting a market finding.",
	},
	eyebrow: "Research · Measurement ledger",
	headline: "Every finding should show its scope.",
	dek: "An answer becomes useful evidence only when the question, surface, time, sample, denominator, and unknowns travel with it.",
	currentScope: enDeclaredScope.text,
	currentScopeClaimIds: [enDeclaredScope.id],
	measurement: {
		eyebrow: "Measurement design",
		title: "Declare the frame before reading the finding.",
		summary:
			"A reviewable observation begins with the collection conditions. Those conditions determine what the record can—and cannot—support.",
		scopeLabel: "A complete declaration names",
		scopeItems: [
			{ id: "program", text: "Configured Program" },
			{ id: "question-cohort", text: "Question cohort" },
			{ id: "surface", text: "Named AI surface" },
			{ id: "market-language", text: "Market and language" },
			{ id: "collection-window", text: "Collection window" },
			{ id: "valid-sample-rule", text: "Valid-sample rule" },
		],
		claimIds: [enDeclaredScope.id],
	},
	metricsEyebrow: "Metric definitions",
	metricsTitle: "The denominator is part of the finding.",
	metrics: [
		{
			id: "visibility",
			label: "Visibility",
			definition: "The share of valid sampled answers in the active declared filter that mention the tracked brand.",
			numerator: "Valid sampled answers that mention the tracked brand.",
			denominator: "All valid sampled answers in the active declared filter.",
			limitation: enVisibilityDefinition.limitation,
			claimIds: [enVisibilityDefinition.id],
		},
		{
			id: "share-of-voice",
			label: "Configured-cohort share of voice",
			definition:
				"The tracked brand's share of all tracked-brand and configured-competitor mentions in the same declared cohort.",
			numerator: "Tracked-brand mentions in the declared cohort.",
			denominator:
				"Tracked-brand mentions plus configured-competitor mentions in the same declared cohort.",
			limitation: enConfiguredSovDefinition.limitation,
			claimIds: [enConfiguredSovDefinition.id],
		},
	],
	recordEyebrow: "Evidence record · 01",
	record: {
		id: "illustrative-record-01",
		status: "illustrative",
		label: "Illustrative",
		title: "One answer, read with its conditions intact",
		scope:
			"Aster Vale Systems (fictional) · procurement software · United States · English · one decision question",
		observedAtIso: "2026-08-12",
		observedAtLabel: "12 August 2026",
		sampleCount: 1,
		question: "Which procurement platforms help a growing team review supplier risk with an auditable process?",
		surface: "Example AI answer surface · configured sample",
		answer:
			"The fictional answer describes three approaches and names Aster Vale Systems as an option for teams that require an auditable review trail. It also tells the buyer to verify integration scope and implementation requirements before selection.",
		citations: {
			state: "known",
			value: [
				{ id: "citation-01", text: "documentation.astervale.example/product-overview" },
				{ id: "citation-02", text: "buyers-guide.example/procurement-evidence" },
			],
		},
		exposedQueries: {
			state: "unknown",
			reason:
				"This illustrative surface did not expose query data for this sample. Unavailable data does not establish that no search occurred.",
		},
		findings: [
			{ id: "finding-01", text: "The fictional answer mentions the tracked brand in direct response to the declared question." },
			{ id: "finding-02", text: "The answer qualifies the mention with integration and implementation checks." },
		],
		unknowns: [
			{ id: "unknown-01", text: "Why the surface selected this wording" },
			{ id: "unknown-02", text: "Whether retrieval occurred beyond the fields exposed with the answer" },
			{ id: "unknown-03", text: "How another collection window would differ" },
		],
		claimIds: [enIllustrativeRecord.id],
	},
	comparison: {
		eyebrow: "Before / after",
		title: "Compare cohorts, not isolated screenshots.",
		guidance:
			"Keep the Program, question cohort, surfaces, market, language, validity rule, and collection conditions as aligned as practical. Report both denominators and inspect the underlying answers before describing a difference.",
		limitation: enRepeatObservation.limitation,
		claimIds: [enRepeatObservation.id],
	},
	nonCausalityNote: enRepeatObservation.limitation,
	nonCausalityClaimIds: [enRepeatObservation.id],
	homePreview: {
		title: "A finding you can audit",
		scope: "One declared question cohort across named surfaces and a stated collection window.",
		denominator: "Every metric names the samples included in its denominator.",
		limitation: enRepeatObservation.limitation,
		claimIds: [enDeclaredScope.id, enVisibilityDefinition.id, enConfiguredSovDefinition.id, enRepeatObservation.id],
	},
	labels: {
		known: "Known",
		unknown: "Unknown",
		definition: "Definition",
		numerator: "Numerator",
		denominator: "Denominator",
		limitation: "Limitation",
		recordMetadata: "Record metadata",
		scope: "Declared scope",
		observedAt: "Observed at",
		sampleCount: "Answer samples",
		question: "Decision question",
		surface: "AI surface",
		answer: "Answer excerpt",
		citations: "Citations",
		exposedQueries: "Exposed queries",
		findings: "What this record supports",
		unknowns: "What remains unknown",
	},
	next: {
		eyebrow: "Use the record",
		title: "Bring one market question into a declared evidence frame.",
		approachLabel: "See the approach",
		diagnosticLabel: "Get a Free Diagnostic",
	},
	claims: enClaims,
	limitations: [
		enDeclaredScope.limitation,
		enVisibilityDefinition.limitation,
		enConfiguredSovDefinition.limitation,
		enRepeatObservation.limitation,
		enIllustrativeRecord.limitation,
		"No customer outcome is published as verified evidence in this release.",
	],
} as const satisfies ResearchContent;

const zhDeclaredScope = {
	id: "research-declared-scope",
	status: "current-software",
	text: "Yonaris 会把每次观察与已配置的 Program、问题集合、AI 界面、市场、语言和采集时间放在一起保存",
	limitation: "记录说明的是本次筛选范围，不代表对整个市场的无边界覆盖",
} as const satisfies ResearchClaim;

const zhVisibilityDefinition = {
	id: "research-visibility-definition",
	status: "current-software",
	text: "可见度用当前声明筛选中提及目标品牌的有效回答数，除以该筛选下全部有效回答数",
	limitation: "这个指标只适用于分母中实际纳入的样本与筛选条件",
} as const satisfies ResearchClaim;

const zhConfiguredSovDefinition = {
	id: "research-configured-sov-definition",
	status: "current-software",
	text: "指定竞品集合内的声量份额，用目标品牌提及次数，对比同一集合中目标品牌与已配置竞品的全部提及次数",
	limitation: "一旦更换竞品集合或样本集合，分母随之改变，不能直接沿用原来的比较",
} as const satisfies ResearchClaim;

const zhRepeatObservation = {
	id: "research-repeat-observation",
	status: "current-software",
	text: "当两次采集的样本集合与条件保持实质一致时，可以对分别保存的观察进行比较",
	limitation: "重复观察可以呈现时间上的差异，但不能独立证明因果关系",
} as const satisfies ResearchClaim;

const zhIllustrativeRecord = {
	id: "research-illustrative-record",
	status: "illustrative",
	text: "Aster Vale Systems 账本用于展示如何同时复核一条回答、可用来源、发现与未知项",
	limitation: "Aster Vale Systems 及这条记录中的全部字段都是虚构示例，不是客户证据或业绩结果",
} as const satisfies ResearchClaim;

const zhClaims = [
	zhDeclaredScope,
	zhVisibilityDefinition,
	zhConfiguredSovDefinition,
	zhRepeatObservation,
	zhIllustrativeRecord,
] as const;

export const pageZh = {
	meta: {
		title: "每一项结论，都应说明它成立的范围",
		description: "解释市场发现之前，先检查 Yonaris 的测量定义、分母、回答证据与未知项",
	},
	eyebrow: "研究 · 测量账本",
	headline: "每一项结论，都应说明它成立的范围",
	dek: "只有当问题、AI 界面、时间、样本、分母与未知项始终跟随记录，一条回答才会成为可用证据",
	currentScope: zhDeclaredScope.text,
	currentScopeClaimIds: [zhDeclaredScope.id],
	measurement: {
		eyebrow: "测量设计",
		title: "先声明观察框架，再阅读结论",
		summary: "一条可复核的观察从采集条件开始。它们共同决定这条记录能支持什么，也决定它不能证明什么",
		scopeLabel: "完整的范围声明包括",
		scopeItems: [
			{ id: "program", text: "已配置的 Program" },
			{ id: "question-cohort", text: "问题集合" },
			{ id: "surface", text: "指定 AI 界面" },
			{ id: "market-language", text: "市场与语言" },
			{ id: "collection-window", text: "采集时间窗口" },
			{ id: "valid-sample-rule", text: "有效样本规则" },
		],
		claimIds: [zhDeclaredScope.id],
	},
	metricsEyebrow: "指标定义",
	metricsTitle: "分母本身就是结论的一部分",
	metrics: [
		{
			id: "visibility",
			label: "可见度",
			definition: "当前声明筛选下，提及目标品牌的有效回答占全部有效回答的比例",
			numerator: "提及目标品牌的有效采样回答",
			denominator: "当前声明筛选下的全部有效采样回答",
			limitation: zhVisibilityDefinition.limitation,
			claimIds: [zhVisibilityDefinition.id],
		},
		{
			id: "share-of-voice",
			label: "指定竞品集合内的声量份额",
			definition: "同一声明样本集合中，目标品牌提及次数占目标品牌与已配置竞品全部提及次数的比例",
			numerator: "声明样本集合中的目标品牌提及次数",
			denominator: "同一声明样本集合中，目标品牌提及次数加已配置竞品提及次数",
			limitation: zhConfiguredSovDefinition.limitation,
			claimIds: [zhConfiguredSovDefinition.id],
		},
	],
	recordEyebrow: "证据记录 · 01",
	record: {
		id: "illustrative-record-01",
		status: "illustrative",
		label: "示例",
		title: "让一条回答始终带着它成立的条件",
		scope: "Aster Vale Systems（虚构）· 采购软件 · 美国 · 英语 · 一个决策问题",
		observedAtIso: "2026-08-12",
		observedAtLabel: "2026 年 8 月 12 日",
		sampleCount: 1,
		question: "哪些采购平台能帮助成长中的团队用可审计流程复核供应商风险？",
		surface: "示例 AI 回答界面 · 已配置样本",
		answer:
			"这条虚构回答介绍了三类方案，并把 Aster Vale Systems 列为适合需要可审计复核记录的团队的一种选择，同时提醒购买者在决策前核实集成范围与实施要求",
		citations: {
			state: "known",
			value: [
				{ id: "citation-01", text: "documentation.astervale.example/product-overview" },
				{ id: "citation-02", text: "buyers-guide.example/procurement-evidence" },
			],
		},
		exposedQueries: {
			state: "unknown",
			reason: "这个示例界面没有公开本条样本的查询数据。数据不可用，不能证明没有发生搜索",
		},
		findings: [
			{ id: "finding-01", text: "这条虚构回答直接回应已声明问题，并提及目标品牌" },
			{ id: "finding-02", text: "回答同时要求购买者继续核实集成与实施条件" },
		],
		unknowns: [
			{ id: "unknown-01", text: "界面为何选择这些措辞" },
			{ id: "unknown-02", text: "回答附带字段之外是否发生了检索" },
			{ id: "unknown-03", text: "另一个采集时间窗口会产生什么差异" },
		],
		claimIds: [zhIllustrativeRecord.id],
	},
	comparison: {
		eyebrow: "前后比较",
		title: "比较样本集合，而不是孤立截图",
		guidance:
			"尽可能让 Program、问题集合、AI 界面、市场、语言、有效样本规则与采集条件保持一致，分别报告两次分母，并在描述差异之前检查底层回答",
		limitation: zhRepeatObservation.limitation,
		claimIds: [zhRepeatObservation.id],
	},
	nonCausalityNote: zhRepeatObservation.limitation,
	nonCausalityClaimIds: [zhRepeatObservation.id],
	homePreview: {
		title: "一项可以被审计的发现",
		scope: "在指定 AI 界面与声明采集时间中观察一个明确的问题集合",
		denominator: "每一项指标都明确说明分母中包含哪些样本",
		limitation: zhRepeatObservation.limitation,
		claimIds: [zhDeclaredScope.id, zhVisibilityDefinition.id, zhConfiguredSovDefinition.id, zhRepeatObservation.id],
	},
	labels: {
		known: "已知",
		unknown: "未知",
		definition: "定义",
		numerator: "分子",
		denominator: "分母",
		limitation: "边界",
		recordMetadata: "记录元数据",
		scope: "声明范围",
		observedAt: "观察时间",
		sampleCount: "回答样本数",
		question: "决策问题",
		surface: "AI 界面",
		answer: "回答摘录",
		citations: "引用",
		exposedQueries: "公开查询",
		findings: "这条记录可以支持什么",
		unknowns: "仍然未知的部分",
	},
	next: {
		eyebrow: "使用这套记录",
		title: "把一个真正重要的市场问题放进明确的证据框架",
		approachLabel: "查看方法",
		diagnosticLabel: "获取免费诊断",
	},
	claims: zhClaims,
	limitations: [
		zhDeclaredScope.limitation,
		zhVisibilityDefinition.limitation,
		zhConfiguredSovDefinition.limitation,
		zhRepeatObservation.limitation,
		zhIllustrativeRecord.limitation,
		"本版本没有发布任何客户结果作为已验证证据",
	],
} as const satisfies ResearchContent;

export const researchContentByLocale: DeepReadonly<Record<Locale, ResearchContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getResearchContent(locale: Locale): DeepReadonly<ResearchContent> {
	return researchContentByLocale[locale];
}
