/** The only locales supported by the public, de-identified product demo. */
export type ProductDemoLocale = "en" | "zh";

export type ProductDemoView = "overview" | "shareOfVoice" | "opportunities" | "queryFanOut";
type ProductDemoMetric = "visibility" | "share" | "prompts" | "evaluations";
export type ProductDemoOpportunityKind = "creation" | "existing-content" | "outreach" | "social";

export interface ProductDemoLabels {
	readonly tabs: Readonly<Record<ProductDemoView, string>>;
	readonly sampleWorkspace: string;
	readonly sampleData: string;
	readonly coverageBoundary: string;
	readonly illustrativeSignal: string;
	readonly reviewAction: string;
	readonly originalPrompt: string;
	readonly rewrittenQuery: string;
	readonly metricLabels: Readonly<Record<ProductDemoMetric, string>>;
}

export interface ProductDemoOverview {
	readonly visibility: number;
	readonly share: number;
	readonly prompts: number;
	readonly evaluations: number;
	readonly evaluationWindow: string;
	readonly frequencyNote: string;
	readonly trends: Readonly<Pick<Record<ProductDemoMetric, string>, "visibility" | "share">>;
	readonly lastUpdated: string;
}

export interface ProductDemoShareOfVoiceRow {
	readonly brand: string;
}

export interface ProductDemoShareOfVoice {
	readonly title: string;
	readonly summary: string;
	readonly rows: readonly ProductDemoShareOfVoiceRow[];
}

export interface ProductDemoOpportunityRow {
	readonly kind: ProductDemoOpportunityKind;
	readonly category: string;
	readonly title: string;
	readonly signal: string;
	readonly action: string;
}

export interface ProductDemoOpportunities {
	readonly title: string;
	readonly summary: string;
	readonly rows: readonly ProductDemoOpportunityRow[];
}

export interface ProductDemoQueryFanOutLine {
	readonly query: string;
	readonly relationship: string;
	readonly explanation: string;
}

export interface ProductDemoQueryFanOut {
	readonly title: string;
	readonly prompt: string;
	readonly summary: string;
	readonly lines: readonly ProductDemoQueryFanOutLine[];
}

export interface ProductDemoContent {
	readonly locale: ProductDemoLocale;
	readonly labels: ProductDemoLabels;
	readonly overview: ProductDemoOverview;
	readonly shareOfVoice: ProductDemoShareOfVoice;
	readonly opportunities: ProductDemoOpportunities;
	readonly queryFanOut: ProductDemoQueryFanOut;
}

const EN: ProductDemoContent = {
	locale: "en",
	labels: {
		tabs: {
			overview: "Overview",
			shareOfVoice: "Share of Voice",
			opportunities: "Opportunities",
			queryFanOut: "Query Fan-Out",
		},
		sampleWorkspace: "Sample workspace",
		sampleData: "Sample data for product demonstration only.",
		coverageBoundary:
			"Coverage is limited to the selected market, language, engine, tracked prompt, observation target, and 30-day window.",
		illustrativeSignal: "Illustrative signal",
		reviewAction: "Review action",
		originalPrompt: "Tracked prompt",
		rewrittenQuery: "Rewritten web query",
		metricLabels: {
			visibility: "AI Visibility",
			share: "Share of Voice",
			prompts: "Prompts",
			evaluations: "Evaluations",
		},
	},
	overview: {
		visibility: 79,
		share: 35,
		prompts: 42,
		evaluations: 3120,
		evaluationWindow: "30-day evaluation window",
		frequencyNote: "Runs approximately once per day.",
		trends: { visibility: "30-day AI Visibility trend", share: "30-day Share of Voice trend" },
		lastUpdated: "Last updated within the displayed window.",
	},
	shareOfVoice: {
		title: "Share of Voice tracked comparison set",
		summary: "An ordered, de-identified comparison set for the selected observation boundary.",
		rows: [{ brand: "Your brand" }, { brand: "Competitor A" }, { brand: "Competitor B" }, { brand: "Competitor C" }],
	},
	opportunities: {
		title: "Opportunities",
		summary: "Illustrative signals and review actions grounded in the observed prompt set.",
		rows: [
			{
				kind: "creation",
				category: "Creation",
				title: "Create a comparison brief",
				signal: "The tracked question lacks a directly matched public comparison source.",
				action: "Review a source-backed comparison brief before publication.",
			},
			{
				kind: "existing-content",
				category: "Existing content",
				title: "Review an existing evidence page",
				signal: "A relevant public page needs an evidence and freshness review.",
				action: "Inspect the page against the selected observation boundary.",
			},
			{
				kind: "outreach",
				category: "Outreach",
				title: "Review independent comparison surfaces",
				signal: "Independent comparison surfaces appear in the observed evidence set.",
				action: "Confirm an eligible third-party surface before outreach.",
			},
			{
				kind: "social",
				category: "Social",
				title: "Review community conversations",
				signal: "Community conversations are part of the evidence surfaces selected for review.",
				action: "Review an authentic, disclosed participation opportunity.",
			},
		],
	},
	queryFanOut: {
		title: "Query Fan-Out",
		prompt: "What should a buyer compare before choosing an analytics partner?",
		summary:
			"One tracked prompt followed by de-identified web-query rewrites observed for the selected engine and target.",
		lines: [
			{
				query: "analytics partner evaluation criteria",
				relationship: "Added",
				explanation: "Adds evaluation criteria to the buying intent.",
			},
			{
				query: "compare analytics partners for buyer decisions",
				relationship: "Preserved",
				explanation: "Preserves the analytics-partner comparison intent.",
			},
			{
				query: "analytics partner evidence by selected market and language",
				relationship: "Boundary",
				explanation: "Applies the selected observation boundary to the rewrite.",
			},
		],
	},
};

const ZH: ProductDemoContent = {
	locale: "zh",
	labels: {
		tabs: { overview: "总览", shareOfVoice: "声量份额", opportunities: "机会", queryFanOut: "问题分发" },
		sampleWorkspace: "示例工作区",
		sampleData: "仅用于产品演示的示例数据。",
		coverageBoundary: "覆盖范围限于选定市场、语言、引擎、跟踪问题、观测目标和 30 天时间窗。",
		illustrativeSignal: "示意信号",
		reviewAction: "复核行动",
		originalPrompt: "跟踪问题",
		rewrittenQuery: "改写后的网页查询",
		metricLabels: { visibility: "AI 可见度", share: "声量份额", prompts: "问题数", evaluations: "评估次数" },
	},
	overview: {
		visibility: 79,
		share: 35,
		prompts: 42,
		evaluations: 3120,
		evaluationWindow: "30 天评估时间窗",
		frequencyNote: "约每天运行一次。",
		trends: { visibility: "30 天 AI 可见度趋势", share: "30 天声量份额趋势" },
		lastUpdated: "最近一次更新在当前显示时间窗内。",
	},
	shareOfVoice: {
		title: "声量份额跟踪对比组",
		summary: "按顺序展示选定观测边界内的去标识对比组。",
		rows: [{ brand: "你的品牌" }, { brand: "竞品甲" }, { brand: "竞品乙" }, { brand: "竞品丙" }],
	},
	opportunities: {
		title: "机会",
		summary: "根据已观测的问题集，展示示意信号和待复核行动。",
		rows: [
			{
				kind: "creation",
				category: "新建内容",
				title: "准备对比说明",
				signal: "跟踪问题缺少直接匹配的公开对比来源。",
				action: "发布前复核一份有来源依据的对比说明。",
			},
			{
				kind: "existing-content",
				category: "现有内容",
				title: "复核现有证据页面",
				signal: "相关公开页面需要复核证据和时效性。",
				action: "按照选定观测边界检查该页面。",
			},
			{
				kind: "outreach",
				category: "外部拓展",
				title: "复核独立对比渠道",
				signal: "已观测证据中出现了独立对比渠道。",
				action: "开展外部沟通前，先确认适合的第三方渠道。",
			},
			{
				kind: "social",
				category: "社交渠道",
				title: "复核社群讨论",
				signal: "社群讨论属于当前待复核的证据渠道。",
				action: "复核一次真实、明确披露身份的参与机会。",
			},
		],
	},
	queryFanOut: {
		title: "问题分发",
		prompt: "买方在选择分析合作伙伴前应该比较哪些方面？",
		summary: "一个跟踪问题，后接在选定引擎和目标下观测到的去标识网页查询改写。",
		lines: [
			{ query: "分析合作伙伴 评估标准", relationship: "新增", explanation: "在采购意图上新增评估标准。" },
			{ query: "比较分析合作伙伴 采购决策", relationship: "保留", explanation: "保留分析合作伙伴的比较意图。" },
			{
				query: "分析合作伙伴 选定市场 语言 公开证据",
				relationship: "边界",
				explanation: "把选定观测边界应用到查询改写。",
			},
		],
	},
};

export const PRODUCT_DEMO: Readonly<Record<ProductDemoLocale, ProductDemoContent>> = { en: EN, zh: ZH };

export function productDemoFor(locale: ProductDemoLocale): ProductDemoContent {
	return PRODUCT_DEMO[locale];
}
