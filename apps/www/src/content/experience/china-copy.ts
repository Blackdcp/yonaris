import type { HumanPageCopy } from "./types";

interface ChinaPageCopy extends HumanPageCopy {
	readonly primaryCta: string;
	readonly closingTitle: string;
	readonly closingBody: string;
}

export const CHINA_SITUATIONS = [
	{
		id: "missing",
		label: "没出现",
		question: "客户问：有哪些适合我的品牌？",
		answer: "答案列出了同类选择，却没有出现你的品牌。",
		action: "先看哪些关键问题的答案没有提到品牌，再检查对外信息是否说清楚。",
	},
	{
		id: "unclear",
		label: "说不准",
		question: "客户问：这个品牌最擅长什么？",
		answer: "AI 提到了你的品牌，却没有说出真正重要的产品优势。",
		action: "把关键事实说清楚，让不同页面形成一致表达。",
	},
	{
		id: "displaced",
		label: "竞品说得更多",
		question: "客户问：这几种方案应该怎么选？",
		answer: "答案更完整地介绍了竞品，你的核心优势没有被说清。",
		action: "对比答案里的品牌描述、比较项和可见引用，找出具体差异。",
	},
	{
		id: "fragmented",
		label: "出海后被说成两回事",
		question: "海外客户问：这家公司属于哪一类？",
		answer: "换了语言和市场，品牌被放进了不同的品类。",
		action: "分别查看目标市场的答案，核对哪些核心品牌事实出现了差异。",
	},
] as const;

export const CHINA_PRODUCT_STAGES = [
	{
		id: "ask",
		label: "从真实问题开始",
		title: "客户会怎么问",
		body: "选择一个会影响购买的具体问题，不从空泛关键词开始。",
		output: "客户怎么问",
	},
	{
		id: "compare",
		label: "看不同答案",
		title: "品牌被怎么比较",
		body: "把品牌、竞品和答案里的比较标准放在同一张画面里。",
		output: "AI 怎么答",
	},
	{
		id: "improve",
		label: "找到改进位置",
		title: "哪些信息值得先补",
		body: "从品牌事实、产品表达和公开内容中找到最重要的一处缺口。",
		output: "先看哪里",
	},
	{
		id: "follow",
		label: "再次检查",
		title: "同一问题后来怎么答",
		body: "用相同市场、语言和问题再次采集答案，比较变化。",
		output: "后来怎么变",
	},
] as const;

export const CHINA_SERVICE_SITUATIONS = [
	{
		id: "visibility",
		number: "01",
		situation: "想知道品牌有没有被看见",
		startingPoint: "先看出现情况",
		description: "围绕选定的购买问题，查看品牌在答案里是否出现、被如何介绍。",
		visibleItems: ["客户怎么问", "答案是否提到品牌", "品牌被怎样介绍"],
	},
	{
		id: "accuracy",
		number: "02",
		situation: "AI 总把品牌说偏",
		startingPoint: "核对品牌描述",
		description: "查看被忽略、说错或相互冲突的信息，列出需要核对的具体位置。",
		visibleItems: ["AI 的品牌描述", "冲突或缺失的位置", "先补哪项对外信息"],
	},
	{
		id: "competition",
		number: "03",
		situation: "竞品总能得到更多推荐",
		startingPoint: "比较答案里的竞品",
		description: "查看答案如何介绍指定竞品，以及品牌与竞品同时出现时有哪些具体差异。",
		visibleItems: ["出现了哪些竞品", "比较了哪些方面", "答案列出的引用来源（如有）"],
	},
	{
		id: "expansion",
		number: "04",
		situation: "出海后品牌定位失真",
		startingPoint: "比较目标市场",
		description: "按已选目标市场、语言、购买问题和竞品，查看品牌被怎样介绍。",
		visibleItems: ["目标市场问题", "不同语言答案", "品牌事实差异"],
	},
] as const;

export const CHINA_MARKETS = [
	{
		id: "china",
		label: "中国市场",
		question: "中国客户正在怎样问？",
		context: "中文购买表达、本地品类习惯与国内 AI 场景",
		move: "先把品牌在中国市场里的出现与表达看清楚。",
	},
	{
		id: "target-market",
		label: "目标海外市场",
		question: "当地客户如何描述这类需求？",
		context: "按已确定的国家、语言、品类和竞品进行配置。",
		move: "先确定一个具体市场，再查看对应答案。",
	},
] as const;

export const CHINA_COPY = {
	home: {
		navLabel: "首页",
		metaTitle: "Yonaris｜看清 AI 如何介绍你的品牌",
		metaDescription: "Yonaris 帮助企业看清品牌在 AI 答案中的出现、表达、竞争位置与跨市场差异。",
		eyebrow: "AI 正在改写客户决策",
		title: "客户问 AI 时，你的品牌被怎么说？",
		lead: "越来越多客户会用 AI 了解产品、比较方案。Yonaris 帮你查看品牌有没有出现、被怎样介绍、与哪些竞品同时出现；如答案提供引用，也可以查看相应来源。",
		primaryCta: "聊聊品牌现状",
		closingTitle: "先从你最担心的问题开始",
		closingBody: "留下姓名、电话和公司。我们会联系你，先聊清品牌、市场和最关心的问题。",
	},
	product: {
		navLabel: "产品",
		metaTitle: "产品｜客户怎么问，AI 怎么答，先看哪里｜Yonaris",
		metaDescription: "沿着真实客户问题，查看完整 AI 答案、品牌描述、竞品、答案列出的引用来源（如有）与后续变化。",
		eyebrow: "把答案变成行动",
		title: "客户怎么问，AI 怎么答，先看哪里",
		lead: "选择一个会影响购买的真实问题，看清完整答案、品牌和竞品怎样被介绍；如答案提供引用，再查看相应来源，并比较之后的变化。",
		primaryCta: "预约产品沟通",
		closingTitle: "你不需要先学会一套新术语",
		closingBody: "告诉我们客户会怎么问，我们从这个问题开始。",
	},
	approach: {
		navLabel: "服务",
		metaTitle: "服务｜从最担心的品牌问题开始｜Yonaris",
		metaDescription: "按品牌未出现、表达失真、竞品信息更多与海外市场差异，查看对应的答案和比较范围。",
		eyebrow: "先从问题开始",
		title: "从最担心的品牌问题开始",
		lead: "告诉我们品牌在哪个市场、客户会问什么，以及你最担心哪种情况。我们从最影响业务判断的一处开始看。",
		primaryCta: "说说你的问题",
		closingTitle: "先看清一个最影响生意的问题",
		closingBody: "从一个市场、一个品类和一组真实问题开始，方向会更清楚。",
	},
	geo: {
		navLabel: "全球市场",
		metaTitle: "全球市场｜服务中国，也支持选定海外目标市场｜Yonaris",
		metaDescription: "Yonaris 按已确定目标市场的国家、语言、购买问题和竞争语境，帮助企业理解不同市场里的 AI 品牌表达。",
		eyebrow: "一个品牌，多种市场语境",
		title: "服务中国市场，也支持企业进入海外目标市场",
		lead: "中国客户怎么问、海外客户怎么问，不是一套话术换一种语言。Yonaris 围绕已确定的国家、语言、客户问题和竞品，分别查看品牌在 AI 答案里如何出现。",
		primaryCta: "聊聊目标市场",
		closingTitle: "准备进入哪个市场？",
		closingBody: "告诉我们目标国家、语言和品牌问题，我们从当地客户会怎么问开始。",
	},
	company: {
		navLabel: "关于我们",
		metaTitle: "关于 Yonaris｜让品牌看清 AI 答案",
		metaDescription: "Yonaris 是一家品牌智能公司，帮助企业理解客户使用 AI 发现、比较和选择时，品牌如何被呈现。",
		eyebrow: "关于 Yonaris",
		title: "让企业看清 AI 如何介绍自己的品牌",
		lead: "Yonaris 是一家品牌智能公司。我们从真实客户问题出发，帮助企业看清 AI 如何介绍、比较和引用品牌，服务中国市场，也围绕已确定的海外目标市场开展工作。",
		primaryCta: "聊聊你的品牌问题",
		closingTitle: "一个品牌核心，不同市场问题",
		closingBody: "从中国市场到已确定的海外目标市场，分别按当地语言和客户问题查看答案。",
	},
	diagnostic: {
		navLabel: "预约沟通",
		metaTitle: "预约沟通｜告诉 Yonaris 你的品牌问题",
		metaDescription: "填写姓名、电话和公司，与 Yonaris 沟通品牌在 AI 答案中的现状与目标市场。",
		eyebrow: "三项信息，开始沟通",
		title: "先聊清楚，你最想解决什么",
		lead: "留下姓名、电话和公司。我们会联系你，先了解品牌、目标市场和最关心的问题。",
		primaryCta: "提交联系方式",
		closingTitle: "一次沟通先理清三个问题",
		closingBody: "你最关心什么、应该先看哪里、下一步可以怎么做。",
	},
	privacy: {
		navLabel: "隐私说明",
		metaTitle: "隐私说明｜Yonaris 中国站",
		metaDescription: "了解 Yonaris 中国站咨询表单收集哪些信息，以及这些信息如何用于联系你。",
		eyebrow: "基本信息说明",
		title: "三项信息，只用于回复咨询",
		lead: "中国站表单只收集姓名、电话和公司，用于回复本次咨询和了解基本需求。",
		primaryCta: "返回预约沟通",
		closingTitle: "你填写的内容不会进入公开页面",
		closingBody: "我们只用这些信息回复本次咨询和安排后续沟通。",
	},
} as const satisfies Record<string, ChinaPageCopy>;
