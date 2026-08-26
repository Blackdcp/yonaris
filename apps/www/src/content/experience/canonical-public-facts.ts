import type { HumanPageKey } from "./types";

export interface CanonicalReadingFact {
	readonly id: string;
	readonly prompt: string;
	readonly human: string;
	readonly meaning: string;
	readonly fact: string;
	readonly evidence: string;
	readonly boundary: string;
	readonly stableId: string;
}

export interface CanonicalPageFact {
	readonly id: string;
	readonly value: string;
	readonly source: string;
	readonly boundary: string;
}

export const EN_READING_RECORDS = [
	{
		id: "category",
		prompt: "Category",
		human: "Yonaris is AI-native MarTech infrastructure built for decisions made by people and shaped by agents.",
		meaning: "This establishes the category without reducing the company to a single AI-search tactic.",
		fact: "AI-native MarTech infrastructure built for decisions made by people and shaped by agents.",
		evidence: "Yonaris public company description · company statement · reviewed 27 Aug 2026",
		boundary: "This identifies the company category. It does not claim every planned capability is available today.",
		stableId: "yonaris.category.ai-native-martech",
	},
	{
		id: "purpose",
		prompt: "Purpose",
		human:
			"Yonaris connects buyer questions, company facts, public evidence, content and channels, market observation, customer behaviour, and action and review.",
		meaning: "Teams can connect how a company is understood to the evidence and business decision that need attention.",
		fact: "Yonaris connects buyer questions, company facts, public evidence, content and channels, market observation, customer behaviour, and action and review.",
		evidence: "Yonaris public purpose statement · company statement · reviewed 27 Aug 2026",
		boundary:
			"This states the purpose of the system. It does not guarantee a commercial outcome or third-party response.",
		stableId: "yonaris.purpose.decision-system",
	},
	{
		id: "scope",
		prompt: "Scope",
		human: "AI-answer observation is one entry into a wider marketing system, not the whole company category.",
		meaning:
			"An observed answer becomes useful when it stays connected to company facts, evidence and the next decision.",
		fact: "AI-answer observation is one entry into a wider marketing system, not the whole company category.",
		evidence: "Yonaris public scope statement · company statement · reviewed 27 Aug 2026",
		boundary: "The observation describes a selected question, market, language, time and AI surface.",
		stableId: "yonaris.scope.martech-system",
	},
] as const satisfies readonly CanonicalReadingFact[];

export const ZH_READING_RECORDS = [
	{
		id: "category",
		prompt: "品类",
		human: "Yonaris 是面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。",
		meaning: "这让购买者能理解公司所处的品类，而不是把 Yonaris 缩成一个 AI 搜索技巧。",
		fact: "面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。",
		evidence: "Yonaris 公司公开描述 · 公司声明 · 2026 年 8 月 27 日核对",
		boundary: "这是一项公司品类声明，不代表所有规划中的能力都已上线。",
		stableId: "yonaris.category.ai-native-martech",
	},
	{
		id: "purpose",
		prompt: "目的",
		human: "Yonaris 把市场问题、品牌事实、公开证据、内容与渠道、市场观测、客户行为和行动复核接在一起。",
		meaning: "团队可以把品牌怎样被理解，接回真实证据和最值得先处理的业务判断。",
		fact: "Yonaris 连接市场问题、品牌事实、公开证据、内容与渠道、市场观测、客户行为和行动与复核。",
		evidence: "Yonaris 公开目的说明 · 公司声明 · 2026 年 8 月 27 日核对",
		boundary: "这说明系统要解决的问题，不保证商业结果或第三方答案发生变化。",
		stableId: "yonaris.purpose.decision-system",
	},
	{
		id: "scope",
		prompt: "范围",
		human: "AI 答案观测只是更大营销系统的一个入口，不是 Yonaris 的全部品类。",
		meaning: "只有把答案接回品牌事实、公开证据和下一步决定，一次观测才真正有业务价值。",
		fact: "AI 答案观测只是更大营销系统的一个入口，不是 Yonaris 的全部品类。",
		evidence: "Yonaris 公开范围说明 · 公司声明 · 2026 年 8 月 27 日核对",
		boundary: "一次观测只说明选定问题、市场、语言、时间和 AI 界面下看到的内容。",
		stableId: "yonaris.scope.martech-system",
	},
] as const satisfies readonly CanonicalReadingFact[];

const EN_PAGE_FACTS = {
	product: {
		id: "yonaris.platform.inspectable-evidence",
		value:
			"Start with one buying question. Follow the answer into the source, the boundary and the buying effect—then decide what deserves attention first.",
		source: "Yonaris public platform description · reviewed 27 Aug 2026",
		boundary:
			"The platform makes a selected answer inspectable and stays limited to the selected evidence and conditions.",
	},
	approach: {
		id: "yonaris.evidence.reviewable-record",
		value:
			"The original question, observed answer, source material, recommendation and retest stay in one readable record.",
		source: "Yonaris public evidence description · reviewed 27 Aug 2026",
		boundary: "A retest is comparable only when the question and observation conditions remain visible.",
	},
	geo: {
		id: "yonaris.market.context-conditions",
		value:
			"Market, language, category wording, alternatives and evidence conditions stay visible around the buying decision. Yonaris keeps them beside the answer so your team can compare like with like and decide what to review.",
		source: "Yonaris public market-context description · reviewed 27 Aug 2026",
		boundary:
			"The same company fact can be read differently across markets; this record does not define customers by origin or destination.",
	},
	diagnostic: {
		id: "yonaris.contact.three-fields",
		value: "The English contact form asks for Name, Work email and Company.",
		source: "Yonaris contact form · reviewed 27 Aug 2026",
		boundary: "Submitting the form requests a conversation; it does not create an instant report or customer result.",
	},
	privacy: {
		id: "yonaris.privacy.contact-request",
		value: "Contact details are used to understand and respond to the request.",
		source: "Yonaris contact request privacy page · reviewed 27 Aug 2026",
		boundary:
			"The public statement covers the contact request and does not invent a retention period or broader legal promise.",
	},
} as const satisfies Partial<Record<HumanPageKey, CanonicalPageFact>>;

const ZH_PAGE_FACTS = {
	product: {
		id: "yonaris.platform.inspectable-evidence",
		value:
			"市场问题、品牌事实、内容与渠道、AI 与市场观测、客户行为和行动复核不再各说各话。选一个节点，就能看见它断开后会浪费哪一笔预算或破坏哪一个判断。",
		source: "Yonaris 中文系统说明 · 2026 年 8 月 27 日核对",
		boundary: "系统围绕选定问题保留可复核记录，不包装未经公开验证的实时自动化能力。",
	},
	approach: {
		id: "yonaris.evidence.reviewable-record",
		value: "固定一道采购问题，保留当时的答案和来源，定位为什么没进备选，再把唯一最该先做的动作放回复核里。",
		source: "Yonaris 中文公开拆解 · 2026 年 8 月 27 日核对",
		boundary: "公开拆解是去标识的方法演示，不代表客户结果，也不把单次变化写成因果。",
	},
	geo: {
		id: "yonaris.market.context-conditions",
		value:
			"公司事实可以保持一致，但市场、语言、当地品类表述、替代选择和证据条件会改变。Yonaris 把这些条件留在同一道问题旁边，避免跨市场判断失去语境。",
		source: "Yonaris 中文跨市场说明 · 2026 年 8 月 27 日核对",
		boundary: "公司事实可以保持一致，市场语境会变化；服务能力不按客户来自哪里或去往哪里定义。",
	},
	diagnostic: {
		id: "yonaris.contact.three-fields",
		value: "中文联系表单只填写姓名、电话和公司。",
		source: "Yonaris 中文联系表单 · 2026 年 8 月 27 日核对",
		boundary: "提交表单用于申请沟通，不会即时生成报告或客户结果。",
	},
	privacy: {
		id: "yonaris.privacy.contact-request",
		value: "联系信息只用于理解并回复这次咨询。",
		source: "Yonaris 中文咨询信息说明 · 2026 年 8 月 27 日核对",
		boundary: "公开说明只覆盖本次联系申请，不虚构保存周期或更广泛的法律承诺。",
	},
} as const satisfies Partial<Record<HumanPageKey, CanonicalPageFact>>;

export const PAGE_FACTS = {
	en: EN_PAGE_FACTS,
	zh: ZH_PAGE_FACTS,
} as const;
