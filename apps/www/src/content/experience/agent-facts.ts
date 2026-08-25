import type { AgentTopic, HumanPageKey } from "./types";

type RegionalAgentFacts = Readonly<Record<HumanPageKey, AgentTopic>>;

export const AGENT_FACTS = {
	global: {
		home: {
			title: "Yonaris: public facts for AI agents",
			summary: "Yonaris helps brands understand how they appear when people use AI to discover, compare, and choose.",
			humanPath: "/",
			groups: [
				{
					title: "Identity",
					items: [
						"Name: Yonaris.",
						"Focus: brand presence and representation in AI answers.",
						"Markets: China and international markets.",
					],
				},
				{
					title: "Questions Yonaris helps answer",
					items: [
						"Does the brand appear for important buyer questions?",
						"Is the brand described accurately?",
						"How is the brand compared with alternatives?",
						"Which citations are shown with the answer?",
						"Which omissions or inconsistencies need review?",
					],
				},
			],
		},
		product: {
			title: "Yonaris product",
			summary:
				"Yonaris turns AI answers into a clear view of brand presence, description, comparison, and visible sources.",
			humanPath: "/product",
			groups: [
				{
					title: "Core capabilities",
					items: [
						"Monitor whether a brand appears for selected buyer questions.",
						"Read how the brand and its product category are described.",
						"Compare the brand with named alternatives.",
						"See citations when an AI surface provides them.",
						"Track changes across repeated checks.",
					],
				},
				{
					title: "Customer experience",
					items: [
						"A workspace brings relevant AI answers and brand mentions together.",
						"The workspace lists observed omissions and inconsistencies for team review.",
					],
				},
			],
		},
		approach: {
			title: "How Yonaris works",
			summary:
				"Work begins with a market question, identifies what the answer includes or misses, and clarifies what to review next.",
			humanPath: "/approach",
			groups: [
				{
					title: "Working sequence",
					items: [
						"Choose the buyer questions that matter to the brand.",
						"Collect answers for the chosen market and language.",
						"Find gaps in visibility, accuracy, and comparison.",
						"Record specific public-information updates for team review.",
						"Check the same questions again to see what changed.",
					],
				},
			],
		},
		geo: {
			title: "Global markets",
			summary: "Yonaris shows how brands appear when AI systems describe, compare, and recommend options.",
			humanPath: "/geo",
			groups: [
				{
					title: "Focus areas",
					items: [
						"Presence in answers to relevant buyer questions.",
						"Accurate brand and product descriptions.",
						"Competitive position inside AI comparisons.",
						"Citations shown with the answer, when available.",
						"Differences across repeated checks.",
					],
				},
				{
					title: "Market coverage",
					items: [
						"China work follows Chinese language and buyer context.",
						"International work follows the language and buyer context of each target market.",
					],
				},
			],
		},
		company: {
			title: "About Yonaris",
			summary: "Yonaris is a brand intelligence company for a world where people ask AI before they visit a website.",
			humanPath: "/company",
			groups: [
				{
					title: "Purpose",
					items: [
						"Help brands see how AI presents them to potential customers.",
						"Turn unclear AI exposure into specific business questions and actions.",
					],
				},
				{
					title: "Regional capability",
					items: [
						"Serve brands in China with locally written experiences.",
						"Support companies entering international markets with market-specific work.",
					],
				},
			],
		},
		diagnostic: {
			title: "Contact Yonaris",
			summary: "Share three contact details to start a conversation about your brand's presence in AI answers.",
			humanPath: "/diagnostic",
			groups: [
				{
					title: "Global contact form",
					items: [
						"Required fields: name, work email, and company.",
						"Yonaris will use these details to understand the request and make contact.",
					],
				},
			],
		},
		privacy: {
			title: "Contact data and privacy",
			summary: "The website asks only for the contact details needed to respond to an inquiry.",
			humanPath: "/privacy",
			groups: [
				{
					title: "Contact data",
					items: [
						"Global inquiries ask for name, work email, and company.",
						"Contact details are used to understand the inquiry and respond.",
						"The Human privacy page explains how contact-form details are handled.",
					],
				},
			],
		},
	},
	zh: {
		home: {
			title: "Yonaris Agent 公开事实",
			summary: "Yonaris 帮助企业看清，客户用 AI 发现、比较和选择品牌时，自己的品牌如何被呈现。",
			humanPath: "/zh",
			groups: [
				{
					title: "基本信息",
					items: ["品牌名称：Yonaris。", "关注方向：品牌在 AI 答案中的出现与表达。", "服务市场：中国及海外目标市场。"],
				},
				{
					title: "帮助企业回答的问题",
					items: [
						"重要客户问题的答案中是否出现品牌？",
						"AI 对品牌的描述是否准确？",
						"品牌与竞争对手被怎样比较？",
						"答案引用了哪些可见信息？",
						"有哪些缺失或不一致需要复核？",
					],
				},
			],
		},
		product: {
			title: "Yonaris 产品能力",
			summary: "Yonaris 汇总 AI 如何提到、描述和比较品牌，并在答案提供引用时显示相应来源。",
			humanPath: "/zh/product",
			groups: [
				{
					title: "核心能力",
					items: [
						"查看选定客户问题的答案中是否出现品牌。",
						"查看 AI 如何描述品牌与产品品类。",
						"了解品牌与指定竞争对手的比较方式。",
						"在 AI 界面提供引用时查看相关来源。",
						"持续查看相同问题中的变化。",
					],
				},
				{
					title: "客户获得什么",
					items: ["在同一个工作空间查看相关 AI 答案和品牌提及。", "标记需要补充或统一的对外信息。"],
				},
			],
		},
		approach: {
			title: "Yonaris 如何开展工作",
			summary: "从一个真实市场问题开始，明确先看哪里和下一步可以怎么做。",
			humanPath: "/zh/approach",
			groups: [
				{
					title: "工作步骤",
					items: [
						"选择对品牌真正重要的客户问题。",
						"针对目标市场和语言采集 AI 答案。",
						"找出品牌在出现、描述和比较中的具体差异。",
						"列出需要补充或统一的对外信息。",
						"再次查看相同问题，了解发生了什么变化。",
					],
				},
			],
		},
		geo: {
			title: "全球市场",
			summary: "Yonaris 帮助企业看清品牌在 AI 的描述、比较和推荐场景中如何出现。",
			humanPath: "/zh/geo",
			groups: [
				{
					title: "关注方向",
					items: [
						"是否进入重要客户问题的答案。",
						"品牌与产品描述是否准确。",
						"与竞争对手相比处于什么位置。",
						"答案提供了哪些可见引用。",
						"相同问题在重复检查中发生了什么变化。",
					],
				},
				{
					title: "市场服务",
					items: ["中国市场采用中文和本地客户语境。", "海外工作围绕已选市场的语言、客户问题与 AI 答案开展观察和比较。"],
				},
			],
		},
		company: {
			title: "关于 Yonaris",
			summary: "Yonaris 面向越来越多客户会先问 AI、再决定是否访问官网的市场环境，帮助企业看清自己的品牌表达。",
			humanPath: "/zh/company",
			groups: [
				{
					title: "我们关注什么",
					items: ["帮助企业看见 AI 如何向潜在客户呈现品牌。", "把模糊的不确定转化为具体问题和行动。"],
				},
				{
					title: "区域能力",
					items: [
						"以符合中国客户习惯的方式服务中国市场。",
						"围绕已选海外目标市场的语言、问题与 AI 答案提供观察和比较。",
					],
				},
			],
		},
		diagnostic: {
			title: "联系 Yonaris",
			summary: "留下三项基本信息，开始沟通你的品牌在 AI 答案中的表现。",
			humanPath: "/zh/diagnostic",
			groups: [
				{
					title: "中国区域联系表单",
					items: ["必填信息：姓名、电话、公司。", "Yonaris 会使用这些信息了解需求并与你联系。"],
				},
			],
		},
		privacy: {
			title: "联系信息与隐私",
			summary: "官网只要求提交回复咨询所需的联系信息。",
			humanPath: "/zh/privacy",
			groups: [
				{
					title: "联系信息",
					items: [
						"中国区域咨询表单收集姓名、电话和公司。",
						"这些信息用于确认称呼、了解公司背景并与你联系。",
						"更多说明请查看官网隐私页。",
					],
				},
			],
		},
	},
} as const satisfies Readonly<Record<"global" | "zh", RegionalAgentFacts>>;
