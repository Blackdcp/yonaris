/** The only locales supported by the public, de-identified product demo. */
export type ProductDemoLocale = "en" | "zh";

export type ProductDemoView = "overview" | "shareOfVoice" | "opportunities" | "queryFanOut";
type ProductDemoMetric = "visibility" | "share" | "prompts" | "evaluations";

export interface ProductDemoLabels {
	readonly tabs: Readonly<Record<ProductDemoView, string>>;
	readonly sampleWorkspace: string;
	readonly sampleData: string;
	readonly coverageBoundary: string;
	readonly metricLabels: Readonly<Record<ProductDemoMetric, string>>;
}

export interface ProductDemoOverview {
	readonly visibility: number;
	readonly share: number;
	readonly prompts: number;
	readonly evaluations: number;
	readonly evaluationWindow: string;
	readonly frequencyNote: string;
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
	readonly surface: string;
	readonly status: string;
	readonly answer: string;
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
		coverageBoundary: "Coverage is limited to the selected market, language, prompts, models and evaluation window.",
		metricLabels: { visibility: "AI Visibility", share: "Share of Voice", prompts: "Prompts", evaluations: "Evaluations" },
	},
	overview: {
		visibility: 79,
		share: 35,
		prompts: 42,
		evaluations: 3120,
		evaluationWindow: "30-day evaluation window",
		frequencyNote: "Approximately 100 evaluations per day.",
	},
	shareOfVoice: {
		title: "Share of Voice Leaderboard",
		summary: "A de-identified comparison of observed answers in the selected evaluation window.",
		rows: [
			{ brand: "Your brand" },
			{ brand: "Competitor A" },
			{ brand: "Competitor B" },
			{ brand: "Competitor C" },
		],
	},
	opportunities: {
		title: "Opportunities",
		summary: "Signals to review next, grounded in the observed prompt set.",
		rows: [
			{ title: "Clarify category language", signal: "The answer groups alternatives before your brand.", action: "Inspect the source and retest the wording." },
			{ title: "Strengthen proof coverage", signal: "High-intent prompts lack a directly matched public source.", action: "Add evidence for the next review window." },
			{ title: "Compare market phrasing", signal: "Equivalent prompts produce different shortlist language.", action: "Review market and language conditions." },
		],
	},
	queryFanOut: {
		title: "Query Fan-Out",
		prompt: "What should a buyer compare before choosing an analytics partner?",
		summary: "One buying question is reviewed across a small set of answer surfaces.",
		lines: [
			{ surface: "Answer surface A", status: "Observed", answer: "Category and alternatives identified." },
			{ surface: "Answer surface B", status: "Observed", answer: "Proof requirement appears in the shortlist." },
			{ surface: "Answer surface C", status: "Needs review", answer: "Source boundary is not yet clear." },
		],
	},
};

const ZH: ProductDemoContent = {
	locale: "zh",
	labels: {
		tabs: { overview: "总览", shareOfVoice: "声量份额", opportunities: "机会", queryFanOut: "问题分发" },
		sampleWorkspace: "示例工作区",
		sampleData: "仅用于产品演示的示例数据。",
		coverageBoundary: "覆盖范围限于选定市场、语言、问题、模型和评估时间窗。",
		metricLabels: { visibility: "AI 可见度", share: "声量份额", prompts: "问题数", evaluations: "评估次数" },
	},
	overview: {
		visibility: 79,
		share: 35,
		prompts: 42,
		evaluations: 3120,
		evaluationWindow: "30 天评估时间窗",
		frequencyNote: "约每天 100 次评估。",
	},
	shareOfVoice: {
		title: "声量份额排行",
		summary: "在选定评估时间窗内，对去标识答案进行比较。",
		rows: [
			{ brand: "你的品牌" },
			{ brand: "竞品 A" },
			{ brand: "竞品 B" },
			{ brand: "竞品 C" },
		],
	},
	opportunities: {
		title: "机会",
		summary: "根据已观测的问题集，列出下一步值得复核的信号。",
		rows: [
			{ title: "说清品类语言", signal: "答案先把替代选项放在你的品牌之前。", action: "查看来源并重新核对表述。" },
			{ title: "补足证据覆盖", signal: "高意向问题缺少直接匹配的公开来源。", action: "为下一轮复核补充证据。" },
			{ title: "比较市场说法", signal: "相同问题在不同语境下产生不同的入选表述。", action: "查看市场和语言条件。" },
		],
	},
	queryFanOut: {
		title: "问题分发",
		prompt: "买方在选择分析合作伙伴前应该比较哪些方面？",
		summary: "一道采购问题会在几种答案界面上分别复核。",
		lines: [
			{ surface: "答案界面 A", status: "已观测", answer: "识别出品类和替代选项。" },
			{ surface: "答案界面 B", status: "已观测", answer: "入选答案中出现了证据要求。" },
			{ surface: "答案界面 C", status: "待复核", answer: "来源边界还不清楚。" },
		],
	},
};

export const PRODUCT_DEMO: Readonly<Record<ProductDemoLocale, ProductDemoContent>> = { en: EN, zh: ZH };

export function productDemoFor(locale: ProductDemoLocale): ProductDemoContent {
	return PRODUCT_DEMO[locale];
}
