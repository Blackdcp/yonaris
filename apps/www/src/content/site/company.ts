import type { PageMeta } from "./global";
import type { FactualClaim, Locale } from "./types";

export interface CompanyPrinciple {
	id: string;
	title: string;
	description: string;
}

export interface CompanyContent {
	meta: PageMeta;
	category: string;
	vision: string;
	marketShift: string;
	stage: string;
	brandThesis: string;
	openSourceRelationship: string;
	currentScope: string;
	principles: readonly CompanyPrinciple[];
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "MarTech, rebuilt. For humans and agents.",
		description:
			"Yonaris is an early, service-led AI-native MarTech company building a real evidence platform for AI-mediated markets.",
	},
	category: "AI-native MarTech",
	vision: "MarTech, rebuilt. For humans and agents.",
	marketShift:
		"Discovery, comparison, and selection increasingly happen through AI-mediated answers before a person reaches a website or sales conversation.",
	stage: "Yonaris is an early, service-led product with a real evidence platform.",
	brandThesis:
		"Recursive Forest names a working belief: finite, declared facts can support a growing field of useful market questions and evidence.",
	openSourceRelationship:
		"Elmo-compatible open-source infrastructure is a technical foundation for parts of the system. It is not the Yonaris company identity, customer promise, or category.",
	currentScope:
		"Yonaris combines customer-visible evidence software with operator-managed collection and human-reviewed recommendations.",
	principles: [
		{
			id: "evidence",
			title: "Evidence over theatre",
			description: "Show the underlying answer and available source record before telling a success story.",
		},
		{
			id: "scope",
			title: "Declare the scope",
			description: "Name the market, questions, surfaces, cohort, and timing behind each observation.",
		},
		{
			id: "review",
			title: "Keep human review",
			description: "Use judgment where evidence is incomplete and before recommendations become action.",
		},
		{
			id: "truth",
			title: "Build durable product truth",
			description: "Keep claims bounded, reviewable, and useful to people and agents.",
		},
	],
	claims: [
		{
			id: "company-stage",
			status: "managed-delivery",
			text: "Yonaris currently delivers an early product through a service-led operating model.",
			limitation: "The company does not present the workflow as mature public self-service SaaS.",
		},
		{
			id: "company-evidence-platform",
			status: "current-software",
			text: "The product includes customer workspaces and reviewable sampled-answer evidence.",
			limitation: "Software coverage remains bounded by configured Programs and supported surfaces.",
		},
		{
			id: "company-human-agent-direction",
			status: "direction",
			text: "Yonaris intends to make the same durable market facts useful to human teams and software agents.",
			limitation: "This vision is broader than the capabilities available in the current release.",
		},
	],
	limitations: [
		"No customer, investor, funding, location, certification, or team claim is made without approved evidence.",
		"Open-source compatibility does not make the upstream project the Yonaris company identity.",
	],
} as const satisfies CompanyContent;

export const pageZh = {
	meta: {
		title: "重构 MarTech，同时面向人，也面向智能体。",
		description:
			"Yonaris 是一家处于早期、以服务驱动的 AI 原生营销科技公司，正在为 AI 介入的市场建设真实可用的证据平台。",
	},
	category: "AI 原生营销科技",
	vision: "重构 MarTech，同时面向人，也面向智能体。",
	marketShift: "越来越多的发现、比较与选择发生在 AI 生成的回答里，早于网站访问或销售沟通。",
	stage: "Yonaris 目前是一款处于早期、以服务驱动，并拥有真实证据平台的产品。",
	brandThesis: "“递归森林”表达的是一种工作信念：有限且明确的事实，可以支撑不断生长的市场问题与证据。",
	openSourceRelationship:
		"与 Elmo 兼容的开源基础设施为系统的部分能力提供技术基础，但它不是 Yonaris 的公司身份、客户承诺或所属品类。",
	currentScope: "Yonaris 目前把客户可见的证据软件、运营团队管理的采集，以及人工审核的建议结合在一起。",
	principles: [
		{ id: "evidence", title: "证据优先于表演", description: "在讲成功故事之前，先展示原始回答与可用的来源记录。" },
		{ id: "scope", title: "声明范围", description: "每次观察都要写明市场、问题、界面、样本集合与时间。" },
		{ id: "review", title: "保留人工审核", description: "证据不完整时依靠判断，并在建议转化为行动前由人复核。" },
		{ id: "truth", title: "沉淀持久的产品事实", description: "让主张边界清楚、可以复核，并且同时服务于人和智能体。" },
	],
	claims: [
		{
			id: "company-stage",
			status: "managed-delivery",
			text: "Yonaris 目前以服务驱动的运营方式交付一款早期产品。",
			limitation: "公司不会把当前流程描述成成熟的公开自助 SaaS。",
		},
		{
			id: "company-evidence-platform",
			status: "current-software",
			text: "产品已经包含客户工作区与可逐条复核的回答样本证据。",
			limitation: "软件覆盖仍受已配置 Program 与受支持界面的限制。",
		},
		{
			id: "company-human-agent-direction",
			status: "direction",
			text: "Yonaris 希望让同一套持久的市场事实同时服务于人类团队与软件智能体。",
			limitation: "这一愿景比当前版本已经具备的能力更广。",
		},
	],
	limitations: [
		"没有获准公开的证据时，不会声称客户、投资人、融资、地点、认证或团队信息。",
		"兼容开源基础设施，并不意味着上游项目就是 Yonaris 的公司身份。",
	],
} as const satisfies CompanyContent;

export const companyContentByLocale: Readonly<Record<Locale, CompanyContent>> = Object.freeze({
	en: pageEn,
	zh: pageZh,
});

export function getCompanyContent(locale: Locale): CompanyContent {
	return companyContentByLocale[locale];
}
