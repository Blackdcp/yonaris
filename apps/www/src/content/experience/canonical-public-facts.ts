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

export const EN_CATEGORY = "AI-native MarTech infrastructure built for decisions made by people and shaped by agents.";
export const ZH_CATEGORY = "面向人类决策、由 Agent 共同塑造的 AI 原生营销科技基础设施。";

export const EN_READING_RECORDS = [
	{
		id: "category",
		prompt: "Category",
		human: `Yonaris is ${EN_CATEGORY}`,
		meaning: "This category connects marketing evidence to decisions made by teams and the agents that shape them.",
		fact: EN_CATEGORY,
		evidence: "Yonaris public company description · company statement · reviewed 27 Aug 2026",
		boundary: "The category covers Yonaris public system for buyer questions, evidence, market observation and review.",
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
		boundary: "The purpose applies to decisions reviewed against a stated question, market, language and time.",
		stableId: "yonaris.purpose.decision-system",
	},
	{
		id: "scope",
		prompt: "Scope",
		human:
			"AI-answer observation connects to a wider marketing system spanning company facts, public evidence, customer behaviour, and action and review.",
		meaning: "Teams can trace an observed answer through its evidence and into the next business decision.",
		fact: "AI-answer observation connects to a wider marketing system spanning company facts, public evidence, customer behaviour, and action and review.",
		evidence: "Yonaris public scope statement · company statement · reviewed 27 Aug 2026",
		boundary: "The observation describes a selected question, market, language, time and AI surface.",
		stableId: "yonaris.scope.martech-system",
	},
] as const satisfies readonly CanonicalReadingFact[];

export const ZH_READING_RECORDS = [
	{
		id: "category",
		prompt: "品类",
		human: `Yonaris 是${ZH_CATEGORY}`,
		meaning: "这一品类把营销证据接到团队的业务决策，以及影响这些决策的 Agent 上。",
		fact: ZH_CATEGORY,
		evidence: "Yonaris 公司公开描述 · 公司声明 · 2026 年 8 月 27 日核对",
		boundary: "该品类覆盖 Yonaris 围绕市场问题、公开证据、市场观测与行动复核提供的系统。",
		stableId: "yonaris.category.ai-native-martech",
	},
	{
		id: "purpose",
		prompt: "目的",
		human: "Yonaris 把市场问题、品牌事实、公开证据、内容与渠道、市场观测、客户行为和行动复核接在一起。",
		meaning: "团队可以把品牌怎样被理解，接回真实证据和最值得先处理的业务判断。",
		fact: "Yonaris 连接市场问题、品牌事实、公开证据、内容与渠道、市场观测、客户行为和行动与复核。",
		evidence: "Yonaris 公开目的说明 · 公司声明 · 2026 年 8 月 27 日核对",
		boundary: "该目的适用于明确问题、市场、语言与核对时间下的业务判断。",
		stableId: "yonaris.purpose.decision-system",
	},
	{
		id: "scope",
		prompt: "范围",
		human: "AI 答案观测与品牌事实、公开证据、客户行为和行动复核共同构成一套更完整的营销系统。",
		meaning: "团队可以沿着一次答案找到对应证据，并把判断接到下一步业务决定。",
		fact: "AI 答案观测与品牌事实、公开证据、客户行为和行动复核共同构成一套更完整的营销系统。",
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
			"The platform record covers the selected answer, its evidence and the conditions attached to that review.",
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
		boundary: "Market context is recorded separately from the stable company fact so comparisons stay like for like.",
	},
	diagnostic: {
		id: "yonaris.contact.three-fields",
		value: "The English contact form asks for Name, Work email and Company.",
		source: "Yonaris contact form · reviewed 27 Aug 2026",
		boundary: "Submitting the form requests a conversation about the question and company supplied.",
	},
	privacy: {
		id: "yonaris.privacy.contact-request",
		value: "Contact details are used to understand and respond to the request.",
		source: "Yonaris contact request privacy page · reviewed 27 Aug 2026",
		boundary: "This fact applies to the three contact details submitted through the consultation form.",
	},
} as const satisfies Partial<Record<HumanPageKey, CanonicalPageFact>>;

const ZH_PAGE_FACTS = {
	product: {
		id: "yonaris.platform.inspectable-evidence",
		value:
			"市场问题、品牌事实、内容与渠道、AI 与市场观测、客户行为和行动复核不再各说各话。选一个节点，就能看见它断开后会浪费哪一笔预算或破坏哪一个判断。",
		source: "Yonaris 中文系统说明 · 2026 年 8 月 27 日核对",
		boundary: "系统围绕选定问题保留答案、证据、客户行为与行动复核记录。",
	},
	approach: {
		id: "yonaris.evidence.reviewable-record",
		value: "固定一道采购问题，保留当时的答案和来源，定位为什么没进备选，再把唯一最该先做的动作放回复核里。",
		source: "Yonaris 中文公开拆解 · 2026 年 8 月 27 日核对",
		boundary: "该公开拆解适用于去标识示例，并保留问题、观察条件和复核结果。",
	},
	geo: {
		id: "yonaris.market.context-conditions",
		value:
			"公司事实可以保持一致，但市场、语言、当地品类表述、替代选择和证据条件会改变。Yonaris 把这些条件留在同一道问题旁边，避免跨市场判断失去语境。",
		source: "Yonaris 中文跨市场说明 · 2026 年 8 月 27 日核对",
		boundary: "市场语境与稳定的公司事实分别记录，让跨市场比较保持同一判断基准。",
	},
	diagnostic: {
		id: "yonaris.contact.three-fields",
		value: "中文联系表单只填写姓名、电话和公司。",
		source: "Yonaris 中文联系表单 · 2026 年 8 月 27 日核对",
		boundary: "提交表单用于申请围绕所填问题与公司的后续沟通。",
	},
	privacy: {
		id: "yonaris.privacy.contact-request",
		value: "联系信息只用于理解并回复这次咨询。",
		source: "Yonaris 中文咨询信息说明 · 2026 年 8 月 27 日核对",
		boundary: "该事实适用于咨询表单提交的姓名、电话与公司信息。",
	},
} as const satisfies Partial<Record<HumanPageKey, CanonicalPageFact>>;

export const PAGE_FACTS = {
	en: EN_PAGE_FACTS,
	zh: ZH_PAGE_FACTS,
} as const;
