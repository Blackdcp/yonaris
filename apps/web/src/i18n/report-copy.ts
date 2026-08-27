import { isContentLanguage, type OutputLanguage } from "@workspace/config/language";

type ReportStatus = "pending" | "processing" | "completed" | "failed" | "unknown";
type OpportunityPriority = "high" | "medium" | "low";
type SoVLevel = "noData" | "strong" | "moderate" | "low";

interface ReportMessages {
	reportTitle: string;
	outputLanguage: {
		label: string;
		en: string;
		zhCn: string;
	};
	statusLabel: string;
	statuses: Record<ReportStatus, string>;
	notAvailable: string;
	shareOfVoice: string;
	sovLevels: Record<SoVLevel, { label: string; description: string }>;
	cover: {
		promptsTested: string;
		brandMentions: string;
		competitors: string;
	};
	sections: {
		aiEnginePerformance: string;
		aiEnginePerformanceSubtitle: (evaluations: string) => string;
		engineRuns: (mentions: string, runs: string) => string;
		competitiveLandscape: string;
		competitiveLandscapeSubtitle: string;
		mentionRate: string;
		mentionRateSubtitle: string;
		promptAnalysis: string;
		promptAnalysisSubtitle: string;
		promptAnalysisContinued: string;
		contentGaps: string;
		contentGapsSubtitle: (brand: string) => string;
		contentGapsEmpty: (brand: string) => string;
		topSearchQueries: string;
		topSearchQueriesSubtitle: string;
		shareOfVoiceOpportunity: string;
		shareOfVoiceOpportunitySubtitle: string;
		nextSteps: string;
		nextStepsSubtitle: (brand: string) => string;
		nextStepsEmpty: (brand: string) => string;
	};
	table: {
		brand: string;
		sov: string;
		share: string;
		mentions: string;
		uniquePrompts: string;
		prompt: string;
		competitorsFound: string;
		query: string;
		brandMentioned: string;
		promptsWithMentions: string;
		totalPromptsTested: string;
		overallSov: string;
		opportunity: string;
		recommendation: string;
		currentSov: string;
		topCompetitorSov: string;
		goalSov: string;
	};
	priorities: Record<OpportunityPriority, string>;
	recommendations: Record<OpportunityPriority, string>;
	writeArticlesRecommendation: (count: string, prompt: string) => string;
	cta: {
		title: string;
		summary: (appName: string) => string;
		strategicOptimization: string;
		strategicOptimizationDescription: string;
		continuousMonitoring: string;
		continuousMonitoringDescription: string;
		competitiveAdvantage: string;
		competitiveAdvantageDescription: string;
		getStarted: (appName: string) => string;
		visit: (url: string) => string;
	};
	chart: {
		shareOfVoice: string;
		visibility: string;
		strength: string;
		opportunity: string;
		evaluatingFirstTime: string;
		noDataInRange: string;
		noDataAvailable: string;
		noBrandsFound: string;
		noBrandsFoundDescription: string;
		download: string;
		preparing: string;
		downloadPng: string;
		exportPng: string;
		exporting: string;
		logoAlt: (name: string) => string;
	};
}

const englishMessages = {
	reportTitle: "AI Share of Voice Report",
	outputLanguage: { label: "Output language", en: "English", zhCn: "简体中文" },
	statusLabel: "Report status",
	statuses: {
		pending: "Pending",
		processing: "Processing",
		completed: "Completed",
		failed: "Failed",
		unknown: "Unknown",
	},
	notAvailable: "N/A",
	shareOfVoice: "Share of Voice",
	sovLevels: {
		noData: { label: "No Data", description: "No mentions detected." },
		strong: { label: "Strong", description: "Your brand leads the conversation." },
		moderate: { label: "Moderate", description: "Room for improvement." },
		low: { label: "Low", description: "Competitors dominate this space." },
	},
	cover: {
		promptsTested: "Prompts Tested",
		brandMentions: "Brand Mentions",
		competitors: "Competitors",
	},
	sections: {
		aiEnginePerformance: "AI Engine Performance",
		aiEnginePerformanceSubtitle: (evaluations) => `Brand mention rate across ${evaluations} evaluations`,
		engineRuns: (mentions, runs) => `${mentions} of ${runs} runs`,
		competitiveLandscape: "Competitive Landscape",
		competitiveLandscapeSubtitle: "Share of voice comparison across all tested prompts",
		mentionRate: "Mention Rate",
		mentionRateSubtitle:
			"Each prompt is evaluated multiple times across AI engines — mentions show total appearances, unique prompts show how many distinct prompts include the brand",
		promptAnalysis: "Prompt Analysis",
		promptAnalysisSubtitle: "Share of voice for representative prompts — strengths and growth opportunities",
		promptAnalysisContinued: "Prompt Analysis (continued)",
		contentGaps: "Content Gaps",
		contentGapsSubtitle: (brand) =>
			`Prompts where competitors appear but ${brand} does not — highest-value opportunities`,
		contentGapsEmpty: (brand) => `${brand} appears in all prompts where competitors are mentioned.`,
		topSearchQueries: "Top AI Search Queries",
		topSearchQueriesSubtitle: "Common web search queries AI models run when answering prompts in your category",
		shareOfVoiceOpportunity: "Share of Voice Opportunity",
		shareOfVoiceOpportunitySubtitle: "Overview of your current AI share of voice and growth potential",
		nextSteps: "What Should I Do Next?",
		nextStepsSubtitle: (brand) => `Prompts where competitors outperform ${brand} — your biggest growth opportunities`,
		nextStepsEmpty: (brand) => `${brand} leads or matches competitors across all tested prompts.`,
	},
	table: {
		brand: "Brand",
		sov: "SoV",
		share: "Share",
		mentions: "Mentions",
		uniquePrompts: "Unique Prompts",
		prompt: "Prompt",
		competitorsFound: "Competitors Found",
		query: "Query",
		brandMentioned: "Brand Mentioned",
		promptsWithMentions: "Prompts With Mentions",
		totalPromptsTested: "Total Prompts Tested",
		overallSov: "Overall SoV",
		opportunity: "Opportunity",
		recommendation: "Recommendation",
		currentSov: "Current SoV",
		topCompetitorSov: "Top Competitor SoV",
		goalSov: "Goal SoV",
	},
	priorities: { high: "High", medium: "Medium", low: "Low" },
	recommendations: {
		high: "Prioritize content creation to establish AI presence",
		medium: "Expand content to increase brand share of voice",
		low: "Maintain leadership and defend competitive position",
	},
	writeArticlesRecommendation: (count, prompt) => `Write ${count} LLM-friendly articles on “${prompt}”`,
	cta: {
		title: "Ready to Optimize Your AI answer presence?",
		summary: (appName) => `Take your brand's AI presence to the next level with ${appName}`,
		strategicOptimization: "Strategic Optimization",
		strategicOptimizationDescription:
			"Develop content strategies that increase your brand's share of voice in AI responses",
		continuousMonitoring: "Continuous Monitoring",
		continuousMonitoringDescription: "Track your AI share of voice across hundreds of relevant prompts and topics",
		competitiveAdvantage: "Competitive Advantage",
		competitiveAdvantageDescription: "Stay ahead of competitors in the rapidly evolving AI search landscape",
		getStarted: (appName) => `Get started with ${appName} today`,
		visit: (url) => `Visit ${url} to learn more about our AI answer presence platform and services.`,
	},
	chart: {
		shareOfVoice: "Share of Voice",
		visibility: "Visibility",
		strength: "Strength",
		opportunity: "Opportunity",
		evaluatingFirstTime: "Evaluating for the first time",
		noDataInRange: "No data in the selected range",
		noDataAvailable: "No data available",
		noBrandsFound: "No brands found",
		noBrandsFoundDescription: "No brand mentions were detected in this period.",
		download: "Download chart",
		preparing: "Preparing…",
		downloadPng: "Download chart as PNG",
		exportPng: "Export (PNG)",
		exporting: "Exporting…",
		logoAlt: (name) => `${name} logo`,
	},
} satisfies ReportMessages;

const chineseMessages = {
	reportTitle: "AI 声量份额报告",
	outputLanguage: { label: "输出语言", en: "English", zhCn: "简体中文" },
	statusLabel: "报告状态",
	statuses: {
		pending: "等待生成",
		processing: "生成中",
		completed: "已完成",
		failed: "生成失败",
		unknown: "状态未知",
	},
	notAvailable: "暂无",
	shareOfVoice: "声量份额",
	sovLevels: {
		noData: { label: "暂无数据", description: "尚未检测到品牌提及。" },
		strong: { label: "表现强劲", description: "品牌已在相关讨论中占据领先位置。" },
		moderate: { label: "稳步提升", description: "品牌声量仍有进一步增长空间。" },
		low: { label: "有待突破", description: "当前相关讨论主要由竞品占据。" },
	},
	cover: {
		promptsTested: "已测试提示词",
		brandMentions: "品牌提及",
		competitors: "竞品数量",
	},
	sections: {
		aiEnginePerformance: "AI 引擎表现",
		aiEnginePerformanceSubtitle: (evaluations) => `基于 ${evaluations} 次 AI 评测呈现品牌提及表现`,
		engineRuns: (mentions, runs) => `${runs} 次评测中提及 ${mentions} 次`,
		competitiveLandscape: "竞争格局",
		competitiveLandscapeSubtitle: "对比全部已测试提示词中的品牌声量份额",
		mentionRate: "提及表现",
		mentionRateSubtitle: "每条提示词由多个 AI 引擎重复评测；提及次数反映总曝光，覆盖提示词反映影响广度",
		promptAnalysis: "提示词分析",
		promptAnalysisSubtitle: "透视代表性提示词中的声量优势与增长机会",
		promptAnalysisContinued: "提示词分析（续）",
		contentGaps: "内容缺口",
		contentGapsSubtitle: (brand) => `竞品已出现而 ${brand} 尚未获得提及的高价值提示词机会`,
		contentGapsEmpty: (brand) => `${brand} 已覆盖所有出现竞品提及的提示词。`,
		topSearchQueries: "AI 热门检索词",
		topSearchQueriesSubtitle: "AI 模型回答相关问题时最常展开的联网检索词",
		shareOfVoiceOpportunity: "声量增长空间",
		shareOfVoiceOpportunitySubtitle: "综合呈现当前 AI 声量份额与后续增长潜力",
		nextSteps: "下一步行动建议",
		nextStepsSubtitle: (brand) => `优先关注竞品表现领先于 ${brand} 的提示词，释放关键增长空间`,
		nextStepsEmpty: (brand) => `${brand} 在全部已测试提示词中均已领先或追平竞品。`,
	},
	table: {
		brand: "品牌",
		sov: "声量份额",
		share: "占比",
		mentions: "提及次数",
		uniquePrompts: "覆盖提示词",
		prompt: "提示词",
		competitorsFound: "出现的竞品",
		query: "检索词",
		brandMentioned: "品牌是否提及",
		promptsWithMentions: "获得提及的提示词",
		totalPromptsTested: "已测试提示词总数",
		overallSov: "整体声量份额",
		opportunity: "增长空间",
		recommendation: "建议",
		currentSov: "当前声量份额",
		topCompetitorSov: "领先竞品声量份额",
		goalSov: "目标声量份额",
	},
	priorities: { high: "高", medium: "中", low: "低" },
	recommendations: {
		high: "优先构建高价值内容，夯实品牌在 AI 答案中的影响力",
		medium: "拓展重点主题内容，持续提升品牌声量份额",
		low: "巩固领先优势，并持续防守关键竞争阵地",
	},
	writeArticlesRecommendation: (count, prompt) => `围绕“${prompt}”创作 ${count} 篇适配大模型检索与引用的内容`,
	cta: {
		title: "准备好提升品牌的 AI 答案影响力了吗？",
		summary: (appName) => `借助 ${appName}，让品牌在 AI 答案中的影响力更进一步`,
		strategicOptimization: "战略优化",
		strategicOptimizationDescription: "制定面向 AI 答案场景的内容策略，持续扩大品牌声量份额",
		continuousMonitoring: "持续监测",
		continuousMonitoringDescription: "跨提示词与主题追踪品牌的 AI 声量变化，及时识别趋势",
		competitiveAdvantage: "竞争优势",
		competitiveAdvantageDescription: "洞察快速演进的 AI 检索格局，持续领先关键竞品",
		getStarted: (appName) => `立即开始使用 ${appName}`,
		visit: (url) => `访问 ${url}，进一步了解我们的 AI 答案影响力平台与服务。`,
	},
	chart: {
		shareOfVoice: "声量份额",
		visibility: "可见度",
		strength: "优势",
		opportunity: "机会",
		evaluatingFirstTime: "正在进行首次评测",
		noDataInRange: "所选时间范围内暂无数据",
		noDataAvailable: "暂无数据",
		noBrandsFound: "未检测到品牌",
		noBrandsFoundDescription: "当前周期内尚未检测到任何品牌提及。",
		download: "下载图表",
		preparing: "准备中…",
		downloadPng: "下载 PNG 图表",
		exportPng: "导出 (PNG)",
		exporting: "正在导出…",
		logoAlt: (name) => `${name} 标志`,
	},
} satisfies ReportMessages;

export type ReportCopy = Omit<ReportMessages, "writeArticlesRecommendation"> & {
	formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
	formatNumber: (value: number) => string;
	formatPercent: (value: number) => string;
	status: (value: string) => string;
	sovLevel: (value: string) => { label: string; description: string };
	recommendation: (priority: OpportunityPriority) => string;
	writeArticlesRecommendation: (count: number, prompt: string) => string;
};

function statusKey(value: string): ReportStatus {
	return value === "pending" || value === "processing" || value === "completed" || value === "failed"
		? value
		: "unknown";
}

function sovLevelKey(value: string): SoVLevel {
	switch (value) {
		case "Strong":
			return "strong";
		case "Moderate":
			return "moderate";
		case "Low":
			return "low";
		default:
			return "noData";
	}
}

export function getReportCopy(outputLanguage: OutputLanguage): ReportCopy {
	const messages = outputLanguage === "zh-CN" ? chineseMessages : englishMessages;
	const numberFormatter = new Intl.NumberFormat(outputLanguage);
	const percentFormatter = new Intl.NumberFormat(outputLanguage, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const defaultDateOptions: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "long",
		day: "numeric",
	};

	return {
		...messages,
		formatDate: (value, options) =>
			new Intl.DateTimeFormat(outputLanguage, {
				timeZone: "UTC",
				...(options ?? defaultDateOptions),
			}).format(value),
		formatNumber: (value) => numberFormatter.format(value),
		formatPercent: (value) => percentFormatter.format(value / 100),
		status: (value) => messages.statuses[statusKey(value)],
		sovLevel: (value) => messages.sovLevels[sovLevelKey(value)],
		recommendation: (priority) => messages.recommendations[priority],
		writeArticlesRecommendation: (count, prompt) =>
			messages.writeArticlesRecommendation(numberFormatter.format(count), prompt),
	};
}

export function parseReportRenderLanguage(value: unknown, persisted: OutputLanguage): OutputLanguage {
	return isContentLanguage(value) ? value : persisted;
}
