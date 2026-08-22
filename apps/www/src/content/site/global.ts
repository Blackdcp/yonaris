import { type ApproachHomePreview, getApproachContent } from "./approach";
import { type DiagnosticContent, getDiagnosticContent } from "./diagnostic";
import { getProductContent, type ProductHomePreview } from "./product";
import { getResearchContent, type ResearchHomePreview } from "./research";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export interface PageMeta {
	title: string;
	description: string;
}

export type HomeStageId = "product" | "approach" | "research" | "diagnostic";

export interface HomeHeroContent {
	headline: string;
	explanation: string;
	websiteLabel: string;
	websitePlaceholder: string;
	submitLabel: string;
}

interface HomePreviewAnswer {
	engine: string;
	label: string;
	status: string;
	before: string;
	emphasis: string;
	after: string;
	sources: readonly [string, string];
}

export interface HomeDiagnosticPreviewContent {
	label: string;
	ariaLabel: string;
	breadcrumb: string;
	navigationLabel: string;
	navigationTitle: string;
	navigation: readonly [string, string, string, string];
	context: string;
	question: string;
	answers: readonly [HomePreviewAnswer, HomePreviewAnswer, HomePreviewAnswer];
	readoutTitle: string;
	readout: readonly [readonly [string, string], readonly [string, string], readonly [string, string]];
	limitation: string;
	claimIds: readonly ["home-illustrative-diagnostic"];
}

export interface HomeStructureContent {
	stageOrder: readonly ["product", "approach", "research", "diagnostic"];
	stageLabels: Record<HomeStageId, string>;
	links: {
		company: string;
		product: string;
		geo: string;
		approach: string;
		research: string;
		diagnostic: string;
	};
	product: {
		claimLabel: string;
		limitationLabel: string;
		geoContextLabel: string;
	};
	approach: { sequenceLabel: string };
	research: { scopeLabel: string; denominatorLabel: string; limitationLabel: string };
}

export interface GlobalContent {
	meta: PageMeta;
	category: string;
	vision: string;
	productPromise: string;
	diagnosticOffer: string;
	currentScope: string;
	hero: HomeHeroContent;
	preview: HomeDiagnosticPreviewContent;
	home: HomeStructureContent;
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export interface HomeComposition {
	product: DeepReadonly<ProductHomePreview>;
	approach: DeepReadonly<ApproachHomePreview>;
	research: DeepReadonly<ResearchHomePreview>;
	diagnostic: DeepReadonly<DiagnosticContent["homeOffer"]>;
}

const enIllustrativeDiagnostic = {
	id: "home-illustrative-diagnostic",
	status: "illustrative",
	text: "The homepage window illustrates how a market-perception diagnostic can organize public narrative evidence.",
	limitation:
		"The window is an explanatory composition, not live telemetry, customer evidence, or a completed diagnostic.",
} as const satisfies FactualClaim;

const zhIllustrativeDiagnostic = {
	id: "home-illustrative-diagnostic",
	status: "illustrative",
	text: "首页窗口用一组说明性内容展示市场认知诊断如何组织公开叙事证据。",
	limitation: "该窗口是说明性组合，不是实时遥测、客户证据，也不是已经完成的诊断结果。",
} as const satisfies FactualClaim;

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
	hero: {
		headline: "See how AI is shaping your market.",
		explanation:
			"Yonaris reveals how AI describes and compares your brand, which sources shape the answer, and where the market narrative can move.",
		websiteLabel: "Website",
		websitePlaceholder: "https://example.com",
		submitLabel: "Get a Free Diagnostic",
	},
	preview: {
		label: "Illustrative diagnostic",
		ariaLabel: "Illustrative market perception diagnostic",
		breadcrumb: "Market perception / Buying question",
		navigationLabel: "Diagnostic views",
		navigationTitle: "Readout",
		navigation: ["Answer landscape", "Comparisons", "Sources", "Opportunities"],
		context: "Yonaris self-diagnostic · Public narrative",
		question: "What is Yonaris—and what category does it belong to?",
		answers: [
			{
				engine: "A",
				label: "Illustrative answer",
				status: "Portal language",
				before: "One public surface categorizes Yonaris as an ",
				emphasis: "AI search optimization platform",
				after: ".",
				sources: ["portal.yonaris.com", "AI Search Optimization"],
			},
			{
				engine: "Y",
				label: "Company narrative",
				status: "Homepage language",
				before: "The company positions itself more broadly as ",
				emphasis: "AI-native MarTech",
				after: "—rebuilt for humans and agents.",
				sources: ["yonaris.com", "Public homepage"],
			},
			{
				engine: "!",
				label: "Observed mismatch",
				status: "Category drift",
				before: "Two public surfaces teach ",
				emphasis: "two different categories",
				after: ". The narrower product label is easier for AI to repeat.",
				sources: ["Illustrative synthesis", "Public metadata"],
			},
		],
		readoutTitle: "Yonaris readout",
		readout: [
			["Observation", "Two surfaces teach two categories."],
			["Diagnostic finding", "The broader MarTech position is not carrying."],
			["Next move", "Align company, product and portal metadata."],
		],
		limitation: enIllustrativeDiagnostic.limitation,
		claimIds: [enIllustrativeDiagnostic.id],
	},
	home: {
		stageOrder: ["product", "approach", "research", "diagnostic"],
		stageLabels: {
			product: "Product evidence",
			approach: "Evidence method",
			research: "Research record",
			diagnostic: "Free diagnostic",
		},
		links: {
			company: "Read the company thesis",
			product: "Explore Product",
			geo: "See GEO in context",
			approach: "Explore the Approach",
			research: "Read the Research",
			diagnostic: "Get a Free Diagnostic",
		},
		product: {
			claimLabel: "What is observable now",
			limitationLabel: "Evidence boundary",
			geoContextLabel: "First applied workflow",
		},
		approach: { sequenceLabel: "Three moments in the loop" },
		research: {
			scopeLabel: "Declared scope",
			denominatorLabel: "Named denominator",
			limitationLabel: "Interpretation boundary",
		},
	},
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
		enIllustrativeDiagnostic,
	],
	limitations: [
		"Sampling is configured rather than universal or real time.",
		"A diagnostic request begins a scope review; it does not return an instant scan or score.",
		enIllustrativeDiagnostic.limitation,
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
	hero: {
		headline: "看清 AI 如何塑造你的市场",
		explanation: "Yonaris 揭示 AI 如何描述与比较你的品牌、哪些信息源正在影响答案，以及市场叙事还能向哪里生长",
		websiteLabel: "官网",
		websitePlaceholder: "https://example.com",
		submitLabel: "获取免费诊断",
	},
	preview: {
		label: "示例诊断",
		ariaLabel: "市场认知示例诊断",
		breadcrumb: "市场认知 / 购买问题",
		navigationLabel: "诊断视图",
		navigationTitle: "诊断读数",
		navigation: ["答案全景", "比较方式", "信息来源", "叙事机会"],
		context: "Yonaris 自我诊断 · 公开叙事",
		question: "Yonaris 是什么——它属于哪个品类？",
		answers: [
			{
				engine: "A",
				label: "示例答案",
				status: "产品门户语言",
				before: "一个公开界面将 Yonaris 归类为",
				emphasis: "AI 搜索优化平台",
				after: "。",
				sources: ["portal.yonaris.com", "AI Search Optimization"],
			},
			{
				engine: "Y",
				label: "公司叙事",
				status: "官网语言",
				before: "公司把自身定位为更广义的",
				emphasis: "AI 原生营销科技",
				after: "——同时面向人，也面向智能体。",
				sources: ["yonaris.com", "公开官网"],
			},
			{
				engine: "!",
				label: "观察到的不一致",
				status: "品类漂移",
				before: "两个公开界面正在传递",
				emphasis: "两个不同品类",
				after: "。更窄的产品标签更容易被 AI 重复。",
				sources: ["示例综合判断", "公开元数据"],
			},
		],
		readoutTitle: "Yonaris 诊断读数",
		readout: [
			["观察", "两个公开界面传递两个品类。"],
			["诊断发现", "更广义的 MarTech 定位没有被充分继承。"],
			["下一步", "统一公司、产品与门户元数据。"],
		],
		limitation: zhIllustrativeDiagnostic.limitation,
		claimIds: [zhIllustrativeDiagnostic.id],
	},
	home: {
		stageOrder: ["product", "approach", "research", "diagnostic"],
		stageLabels: {
			product: "产品证据",
			approach: "证据方法",
			research: "研究记录",
			diagnostic: "免费诊断",
		},
		links: {
			company: "阅读公司品类主张",
			product: "查看产品",
			geo: "了解 GEO 场景",
			approach: "查看方法",
			research: "阅读研究",
			diagnostic: "获取免费诊断",
		},
		product: {
			claimLabel: "现在可以观察什么",
			limitationLabel: "证据边界",
			geoContextLabel: "第一项落地工作流",
		},
		approach: { sequenceLabel: "证据循环中的三个时刻" },
		research: {
			scopeLabel: "声明范围",
			denominatorLabel: "明确分母",
			limitationLabel: "解释边界",
		},
	},
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
		zhIllustrativeDiagnostic,
	],
	limitations: [
		"采样范围需要预先配置，并非覆盖所有模型或实时运行。",
		"提交诊断申请后会先确认范围，不会立即生成扫描结果或分数。",
		zhIllustrativeDiagnostic.limitation,
	],
} as const satisfies GlobalContent;

export const globalContentByLocale: DeepReadonly<Record<Locale, GlobalContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getGlobalContent(locale: Locale): DeepReadonly<GlobalContent> {
	return globalContentByLocale[locale];
}

export function getHomeComposition(locale: Locale): DeepReadonly<HomeComposition> {
	return deepFreeze({
		product: getProductContent(locale).homePreview,
		approach: getApproachContent(locale).homePreview,
		research: getResearchContent(locale).homePreview,
		diagnostic: getDiagnosticContent(locale).homeOffer,
	});
}
