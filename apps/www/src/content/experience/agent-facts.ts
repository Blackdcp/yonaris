import type { AgentTopic, HumanPageKey } from "./types";

type RegionalAgentFacts = Readonly<Record<HumanPageKey, AgentTopic>>;

const LAST_REVIEWED = "2026-08-25";

const EN_LIMITATIONS = [
	"Observations depend on the selected question, market, language, review time, and upstream AI surface.",
	"Citations are included only when the observed answer exposes them.",
	"A review does not promise rankings, traffic, recommendations, or automatic changes to third-party answers.",
] as const;

const ZH_LIMITATIONS = [
	"观察结果取决于所选问题、市场、语言、核对时间和上游 AI 界面。",
	"只有被观察的答案公开显示引用时，文档才会列出引用。",
	"核对不承诺排名、流量、推荐结果或第三方答案自动变化。",
] as const;

export const AGENT_FACTS = {
	global: {
		home: {
			id: "en.home",
			locale: "en",
			language: "en",
			title: "Yonaris: public facts for AI agents",
			summary: "Yonaris helps brands understand how they appear when people use AI to discover, compare, and choose.",
			humanPath: "/",
			agentPath: "/agent",
			markdownPath: "/agent/index.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "This topic states the public identity of Yonaris, its review focus, and the questions a scoped review can examine.",
			limitations: EN_LIMITATIONS,
			groups: [
				{
					id: "home.identity",
					title: "Identity",
					facts: [
						{ id: "home.name", value: "Name: Yonaris.", evidenceUrl: "/" },
						{
							id: "home.focus",
							value: "Focus: brand presence and representation in AI answers.",
							evidenceUrl: "/",
						},
						{
							id: "home.market-context",
							value: "Market context: China or a defined international target market.",
							evidenceUrl: "/",
						},
					],
				},
				{
					id: "home.review-questions",
					title: "Questions Yonaris helps answer",
					facts: [
						{
							id: "home.presence",
							value: "Does the brand appear for important buyer questions?",
							evidenceUrl: "/",
						},
						{ id: "home.accuracy", value: "Is the brand described accurately?", evidenceUrl: "/" },
						{
							id: "home.comparison",
							value: "How is the brand compared with alternatives?",
							evidenceUrl: "/",
						},
						{
							id: "home.citations",
							value: "Which citations are shown with the answer?",
							evidenceUrl: "/",
						},
						{
							id: "home.review-gaps",
							value: "Which omissions or inconsistencies need review?",
							evidenceUrl: "/",
						},
					],
				},
			],
		},
		product: {
			id: "en.product",
			locale: "en",
			language: "en",
			title: "Yonaris product",
			summary:
				"Yonaris turns AI answers into a clear view of brand presence, description, comparison, and visible sources.",
			humanPath: "/product",
			agentPath: "/agent/product",
			markdownPath: "/agent/product.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "This topic describes the observable inputs and outputs of the Yonaris review workspace.",
			limitations: EN_LIMITATIONS,
			groups: [
				{
					id: "product.capabilities",
					title: "Core capabilities",
					facts: [
						{
							id: "product.presence",
							value: "Monitor whether a brand appears for selected buyer questions.",
							evidenceUrl: "/product",
						},
						{
							id: "product.description",
							value: "Read how the brand and its product category are described.",
							evidenceUrl: "/product",
						},
						{
							id: "product.comparison",
							value: "Compare the brand with named alternatives.",
							evidenceUrl: "/product",
						},
						{
							id: "product.citations",
							value: "See citations when an AI surface provides them.",
							evidenceUrl: "/product",
						},
						{
							id: "product.repeat-checks",
							value: "Track changes across repeated checks.",
							evidenceUrl: "/product",
						},
					],
				},
				{
					id: "product.workspace",
					title: "Customer experience",
					facts: [
						{
							id: "product.answer-workspace",
							value: "A workspace brings relevant AI answers and brand mentions together.",
							evidenceUrl: "/product",
						},
						{
							id: "product.review-items",
							value: "The workspace lists observed omissions and inconsistencies for team review.",
							evidenceUrl: "/product",
						},
					],
				},
			],
		},
		approach: {
			id: "en.approach",
			locale: "en",
			language: "en",
			title: "How Yonaris works",
			summary:
				"Work begins with a market question, identifies what the answer includes or misses, and clarifies what to review next.",
			humanPath: "/approach",
			agentPath: "/agent/approach",
			markdownPath: "/agent/approach.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "This topic describes the bounded sequence from a selected buyer question to a repeated check.",
			limitations: EN_LIMITATIONS,
			groups: [
				{
					id: "approach.sequence",
					title: "Working sequence",
					facts: [
						{
							id: "approach.select-questions",
							value: "Choose the buyer questions that matter to the brand.",
							evidenceUrl: "/approach",
						},
						{
							id: "approach.collect-answers",
							value: "Collect answers for the chosen market and language.",
							evidenceUrl: "/approach",
						},
						{
							id: "approach.find-gaps",
							value: "Find gaps in visibility, accuracy, and comparison.",
							evidenceUrl: "/approach",
						},
						{
							id: "approach.record-updates",
							value: "Record specific public-information updates for team review.",
							evidenceUrl: "/approach",
						},
						{
							id: "approach.repeat-check",
							value: "Check the same questions again to see what changed.",
							evidenceUrl: "/approach",
						},
					],
				},
			],
		},
		geo: {
			id: "en.geo",
			locale: "en",
			language: "en",
			title: "Global markets",
			summary: "Yonaris shows how brands appear when AI systems describe, compare, and recommend options.",
			humanPath: "/geo",
			agentPath: "/agent/geo",
			markdownPath: "/agent/geo.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "This topic describes the market, language, buyer-question, and answer details that a review can examine.",
			limitations: EN_LIMITATIONS,
			groups: [
				{
					id: "geo.focus-areas",
					title: "Focus areas",
					facts: [
						{
							id: "geo.presence",
							value: "Presence in answers to relevant buyer questions.",
							evidenceUrl: "/geo",
						},
						{
							id: "geo.accuracy",
							value: "Accurate brand and product descriptions.",
							evidenceUrl: "/geo",
						},
						{
							id: "geo.comparison",
							value: "Competitive position inside AI comparisons.",
							evidenceUrl: "/geo",
						},
						{
							id: "geo.citations",
							value: "Citations shown with the answer, when available.",
							evidenceUrl: "/geo",
						},
						{
							id: "geo.repeat-checks",
							value: "Differences across repeated checks.",
							evidenceUrl: "/geo",
						},
					],
				},
				{
					id: "geo.market-context",
					title: "Market context",
					facts: [
						{
							id: "geo.china-context",
							value: "China work follows Chinese language and buyer context.",
							evidenceUrl: "/geo",
						},
						{
							id: "geo.international-context",
							value: "International work follows the language and buyer context of each selected target market.",
							evidenceUrl: "/geo",
						},
					],
				},
			],
		},
		company: {
			id: "en.company",
			locale: "en",
			language: "en",
			title: "About Yonaris",
			summary: "Yonaris is a brand intelligence company for a world where people ask AI before they visit a website.",
			humanPath: "/company",
			agentPath: "/agent/company",
			markdownPath: "/agent/company.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "This topic states the purpose of Yonaris and the regional context used to frame its public review work.",
			limitations: EN_LIMITATIONS,
			groups: [
				{
					id: "company.purpose",
					title: "Purpose",
					facts: [
						{
							id: "company.presentation",
							value: "Help brands see how AI presents them to potential customers.",
							evidenceUrl: "/company",
						},
						{
							id: "company.review-actions",
							value: "Turn unclear AI exposure into specific business questions and actions.",
							evidenceUrl: "/company",
						},
					],
				},
				{
					id: "company.regional-context",
					title: "Regional capability",
					facts: [
						{
							id: "company.china-context",
							value: "Serve brands in China with locally written experiences.",
							evidenceUrl: "/company",
						},
						{
							id: "company.international-context",
							value: "Support companies entering international markets with market-specific work.",
							evidenceUrl: "/company",
						},
					],
				},
			],
		},
		diagnostic: {
			id: "en.diagnostic",
			locale: "en",
			language: "en",
			title: "Contact Yonaris",
			summary: "Share three contact details to start a conversation about your brand's presence in AI answers.",
			humanPath: "/diagnostic",
			agentPath: "/agent/diagnostic",
			markdownPath: "/agent/diagnostic.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "This topic states the exact contact fields and the limited purpose of an initial inquiry.",
			limitations: EN_LIMITATIONS,
			groups: [
				{
					id: "diagnostic.contact-form",
					title: "Global contact form",
					facts: [
						{
							id: "diagnostic.required-fields",
							value: "Required fields: name, work email, and company.",
							evidenceUrl: "/diagnostic",
						},
						{
							id: "diagnostic.contact-purpose",
							value: "Yonaris will use these details to understand the request and make contact.",
							evidenceUrl: "/diagnostic",
						},
					],
				},
			],
		},
		privacy: {
			id: "en.privacy",
			locale: "en",
			language: "en",
			title: "Contact data and privacy",
			summary: "The website asks only for the contact details needed to respond to an inquiry.",
			humanPath: "/privacy",
			agentPath: "/agent/privacy",
			markdownPath: "/agent/privacy.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "This topic states which contact details are requested and the public page that explains their handling.",
			limitations: EN_LIMITATIONS,
			groups: [
				{
					id: "privacy.contact-data",
					title: "Contact data",
					facts: [
						{
							id: "privacy.required-fields",
							value: "Global inquiries ask for name, work email, and company.",
							evidenceUrl: "/privacy",
						},
						{
							id: "privacy.contact-purpose",
							value: "Contact details are used to understand the inquiry and respond.",
							evidenceUrl: "/privacy",
						},
						{
							id: "privacy.human-page",
							value: "The Human privacy page explains how contact-form details are handled.",
							evidenceUrl: "/privacy",
						},
					],
				},
			],
		},
	},
	zh: {
		home: {
			id: "zh.home",
			locale: "zh",
			language: "zh-CN",
			title: "Yonaris Agent 公开事实",
			summary: "Yonaris 帮助企业看清，客户用 AI 发现、比较和选择品牌时，自己的品牌如何被呈现。",
			humanPath: "/zh",
			agentPath: "/zh/agent",
			markdownPath: "/zh/agent/index.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "本主题说明 Yonaris 的公开定位、核对范围，以及一次品牌核对可以回答的具体问题。",
			limitations: ZH_LIMITATIONS,
			groups: [
				{
					id: "home.identity",
					title: "基本信息",
					facts: [
						{ id: "home.name", value: "品牌名称：Yonaris。", evidenceUrl: "/zh" },
						{
							id: "home.focus",
							value: "关注方向：品牌在 AI 答案中的出现与表达。",
							evidenceUrl: "/zh",
						},
						{
							id: "home.market-context",
							value: "市场语境：中国或一个明确的海外目标市场。",
							evidenceUrl: "/zh",
						},
					],
				},
				{
					id: "home.review-questions",
					title: "帮助企业回答的问题",
					facts: [
						{ id: "home.presence", value: "重要客户问题的答案中是否出现品牌？", evidenceUrl: "/zh" },
						{ id: "home.accuracy", value: "AI 对品牌的描述是否准确？", evidenceUrl: "/zh" },
						{ id: "home.comparison", value: "品牌与竞争对手被怎样比较？", evidenceUrl: "/zh" },
						{ id: "home.citations", value: "答案引用了哪些可见信息？", evidenceUrl: "/zh" },
						{ id: "home.review-gaps", value: "有哪些缺失或不一致需要复核？", evidenceUrl: "/zh" },
					],
				},
			],
		},
		product: {
			id: "zh.product",
			locale: "zh",
			language: "zh-CN",
			title: "Yonaris 产品能力",
			summary: "Yonaris 汇总 AI 如何提到、描述和比较品牌，并在答案提供引用时显示相应来源。",
			humanPath: "/zh/product",
			agentPath: "/zh/agent/product",
			markdownPath: "/zh/agent/product.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "本主题说明 Yonaris 核对工作空间中可以查看的输入、答案信息和后续复核项。",
			limitations: ZH_LIMITATIONS,
			groups: [
				{
					id: "product.capabilities",
					title: "核心能力",
					facts: [
						{
							id: "product.presence",
							value: "查看选定客户问题的答案中是否出现品牌。",
							evidenceUrl: "/zh/product",
						},
						{
							id: "product.description",
							value: "查看 AI 如何描述品牌与产品品类。",
							evidenceUrl: "/zh/product",
						},
						{
							id: "product.comparison",
							value: "了解品牌与指定竞争对手的比较方式。",
							evidenceUrl: "/zh/product",
						},
						{
							id: "product.citations",
							value: "在 AI 界面提供引用时查看相关来源。",
							evidenceUrl: "/zh/product",
						},
						{
							id: "product.repeat-checks",
							value: "持续查看相同问题中的变化。",
							evidenceUrl: "/zh/product",
						},
					],
				},
				{
					id: "product.workspace",
					title: "客户获得什么",
					facts: [
						{
							id: "product.answer-workspace",
							value: "在同一个工作空间查看相关 AI 答案和品牌提及。",
							evidenceUrl: "/zh/product",
						},
						{
							id: "product.review-items",
							value: "标记需要补充或统一的对外信息。",
							evidenceUrl: "/zh/product",
						},
					],
				},
			],
		},
		approach: {
			id: "zh.approach",
			locale: "zh",
			language: "zh-CN",
			title: "Yonaris 如何开展工作",
			summary: "从一个真实市场问题开始，明确先看哪里和下一步可以怎么做。",
			humanPath: "/zh/approach",
			agentPath: "/zh/agent/approach",
			markdownPath: "/zh/agent/approach.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "本主题说明从选择客户问题、核对答案到再次查看同一范围的完整工作顺序。",
			limitations: ZH_LIMITATIONS,
			groups: [
				{
					id: "approach.sequence",
					title: "工作步骤",
					facts: [
						{
							id: "approach.select-questions",
							value: "选择对品牌真正重要的客户问题。",
							evidenceUrl: "/zh/approach",
						},
						{
							id: "approach.collect-answers",
							value: "针对目标市场和语言采集 AI 答案。",
							evidenceUrl: "/zh/approach",
						},
						{
							id: "approach.find-gaps",
							value: "找出品牌在出现、描述和比较中的具体差异。",
							evidenceUrl: "/zh/approach",
						},
						{
							id: "approach.record-updates",
							value: "列出需要补充或统一的对外信息。",
							evidenceUrl: "/zh/approach",
						},
						{
							id: "approach.repeat-check",
							value: "再次查看相同问题，了解发生了什么变化。",
							evidenceUrl: "/zh/approach",
						},
					],
				},
			],
		},
		geo: {
			id: "zh.geo",
			locale: "zh",
			language: "zh-CN",
			title: "全球市场",
			summary: "Yonaris 帮助企业看清品牌在 AI 的描述、比较和推荐场景中如何出现。",
			humanPath: "/zh/geo",
			agentPath: "/zh/agent/geo",
			markdownPath: "/zh/agent/geo.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "本主题说明一次市场核对可以采用的语言、客户问题、竞争语境和答案信息。",
			limitations: ZH_LIMITATIONS,
			groups: [
				{
					id: "geo.focus-areas",
					title: "关注方向",
					facts: [
						{ id: "geo.presence", value: "是否进入重要客户问题的答案。", evidenceUrl: "/zh/geo" },
						{ id: "geo.accuracy", value: "品牌与产品描述是否准确。", evidenceUrl: "/zh/geo" },
						{ id: "geo.comparison", value: "与竞争对手相比处于什么位置。", evidenceUrl: "/zh/geo" },
						{ id: "geo.citations", value: "答案提供了哪些可见引用。", evidenceUrl: "/zh/geo" },
						{
							id: "geo.repeat-checks",
							value: "相同问题在重复检查中发生了什么变化。",
							evidenceUrl: "/zh/geo",
						},
					],
				},
				{
					id: "geo.market-context",
					title: "市场语境",
					facts: [
						{
							id: "geo.china-context",
							value: "中国市场采用中文和本地客户语境。",
							evidenceUrl: "/zh/geo",
						},
						{
							id: "geo.international-context",
							value: "海外工作围绕已选市场的语言、客户问题与 AI 答案开展观察和比较。",
							evidenceUrl: "/zh/geo",
						},
					],
				},
			],
		},
		company: {
			id: "zh.company",
			locale: "zh",
			language: "zh-CN",
			title: "关于 Yonaris",
			summary: "Yonaris 面向越来越多客户会先问 AI、再决定是否访问官网的市场环境，帮助企业看清自己的品牌表达。",
			humanPath: "/zh/company",
			agentPath: "/zh/agent/company",
			markdownPath: "/zh/agent/company.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "本主题说明 Yonaris 的公开目的，以及品牌核对所采用的中国和海外市场语境。",
			limitations: ZH_LIMITATIONS,
			groups: [
				{
					id: "company.purpose",
					title: "我们关注什么",
					facts: [
						{
							id: "company.presentation",
							value: "帮助企业看见 AI 如何向潜在客户呈现品牌。",
							evidenceUrl: "/zh/company",
						},
						{
							id: "company.review-actions",
							value: "把模糊的不确定转化为具体问题和行动。",
							evidenceUrl: "/zh/company",
						},
					],
				},
				{
					id: "company.regional-context",
					title: "区域能力",
					facts: [
						{
							id: "company.china-context",
							value: "以符合中国客户习惯的方式服务中国市场。",
							evidenceUrl: "/zh/company",
						},
						{
							id: "company.international-context",
							value: "围绕已选海外目标市场的语言、问题与 AI 答案提供观察和比较。",
							evidenceUrl: "/zh/company",
						},
					],
				},
			],
		},
		diagnostic: {
			id: "zh.diagnostic",
			locale: "zh",
			language: "zh-CN",
			title: "联系 Yonaris",
			summary: "留下三项基本信息，开始沟通你的品牌在 AI 答案中的表现。",
			humanPath: "/zh/diagnostic",
			agentPath: "/zh/agent/diagnostic",
			markdownPath: "/zh/agent/diagnostic.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "本主题说明中国区域联系表单的三项必填信息，以及初次沟通使用这些信息的目的。",
			limitations: ZH_LIMITATIONS,
			groups: [
				{
					id: "diagnostic.contact-form",
					title: "中国区域联系表单",
					facts: [
						{
							id: "diagnostic.required-fields",
							value: "必填信息：姓名、电话、公司。",
							evidenceUrl: "/zh/diagnostic",
						},
						{
							id: "diagnostic.contact-purpose",
							value: "Yonaris 会使用这些信息了解需求并与你联系。",
							evidenceUrl: "/zh/diagnostic",
						},
					],
				},
			],
		},
		privacy: {
			id: "zh.privacy",
			locale: "zh",
			language: "zh-CN",
			title: "联系信息与隐私",
			summary: "官网只要求提交回复咨询所需的联系信息。",
			humanPath: "/zh/privacy",
			agentPath: "/zh/agent/privacy",
			markdownPath: "/zh/agent/privacy.md",
			lastReviewed: LAST_REVIEWED,
			reviewedBy: "Yonaris",
			scope: "本主题说明中国区域咨询所需的联系信息、使用目的，以及公开隐私说明所在页面。",
			limitations: ZH_LIMITATIONS,
			groups: [
				{
					id: "privacy.contact-data",
					title: "联系信息",
					facts: [
						{
							id: "privacy.required-fields",
							value: "中国区域咨询表单收集姓名、电话和公司。",
							evidenceUrl: "/zh/privacy",
						},
						{
							id: "privacy.contact-purpose",
							value: "这些信息用于确认称呼、了解公司背景并与你联系。",
							evidenceUrl: "/zh/privacy",
						},
						{
							id: "privacy.human-page",
							value: "更多说明请查看官网隐私页。",
							evidenceUrl: "/zh/privacy",
						},
					],
				},
			],
		},
	},
} as const satisfies Readonly<Record<"global" | "zh", RegionalAgentFacts>>;
