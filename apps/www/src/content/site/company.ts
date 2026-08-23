import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export type CompanyReaderId = "human" | "agent";
export type CompanyClaim = FactualClaim & { limitation: string };

export interface CompanyReader {
	id: CompanyReaderId;
	label: string;
	summary: string;
	annotation: string;
}

export interface CompanyPrinciple {
	id: "evidence" | "scope" | "review" | "truth";
	title: string;
	description: string;
}

interface CompanyClaimSection {
	eyebrow: string;
	title: string;
	summary: string;
	claimIds: readonly CompanyClaim["id"][];
}

export interface CompanyContent {
	meta: PageMeta;
	category: string;
	vision: CompanyClaimSection & { headline: string };
	marketShift: {
		eyebrow: string;
		title: string;
		summary: string;
		groupLabel: string;
		annotationLabel: string;
		readers: readonly CompanyReader[];
		claimIds: readonly CompanyClaim["id"][];
	};
	stage: CompanyClaimSection & { currentScopeLabel: string };
	forest: CompanyClaimSection & { name: string; boundary: string };
	principles: {
		eyebrow: string;
		title: string;
		items: readonly CompanyPrinciple[];
	};
	contact: {
		eyebrow: string;
		title: string;
		summary: string;
		diagnosticLabel: string;
		emailLabel: string;
		email: string;
	};
	currentScope: string;
	currentScopeClaimIds: readonly CompanyClaim["id"][];
	claims: readonly CompanyClaim[];
	limitations: readonly string[];
}

const enHumanAgentDirection = {
	id: "company-human-agent-direction",
	status: "direction",
	text: "Yonaris is building toward MarTech that gives human teams and software agents a shared factual core for market understanding.",
	limitation: "This is the company vision; the current release does not make every future agent workflow available.",
} as const satisfies CompanyClaim;

const enServiceLedStage = {
	id: "company-service-led-stage",
	status: "managed-delivery",
	text: "Yonaris is an early company delivering a real evidence product through a service-led model.",
	limitation: "The current workflow is not mature public self-service SaaS.",
} as const satisfies CompanyClaim;

const enEvidencePlatform = {
	id: "company-evidence-platform",
	status: "current-software",
	text: "Configured evidence is customer-visible in workspaces with sampled answers, mentions, citations, and available exposed queries.",
	limitation: "Coverage depends on configured Programs and the evidence each supported surface exposes.",
} as const satisfies CompanyClaim;

const enRecursiveForestMethod = {
	id: "company-recursive-forest-method",
	status: "managed-delivery",
	text: "Recursive Forest is the working method Yonaris uses to organize finite product facts, conditions, relationships, and evidence for expanding market questions.",
	limitation: "It is not an implemented graph architecture or a claim that every possible question can be covered.",
} as const satisfies CompanyClaim;

const enClaims = [enHumanAgentDirection, enServiceLedStage, enEvidencePlatform, enRecursiveForestMethod] as const;

export const pageEn = {
	meta: {
		title: "MarTech, rebuilt. For humans and agents.",
		description:
			"Yonaris is an early, service-led AI-native MarTech company building a real evidence platform for AI-mediated markets.",
	},
	category: "AI-native MarTech",
	vision: {
		eyebrow: "Company · Category thesis",
		title: "A market shaped by people and machines needs a different factual layer.",
		headline: "MarTech, rebuilt. For humans and agents.",
		summary:
			"AI is becoming part of how markets discover, compare, and select products. Yonaris is building the evidence layer for that shift.",
		claimIds: [enHumanAgentDirection.id],
	},
	marketShift: {
		eyebrow: "Market shift",
		title: "The market now has two readers.",
		summary:
			"A buying journey no longer has one audience. People and software agents reach decisions differently, but both need claims they can trace back to facts, conditions, and evidence.",
		groupLabel: "Choose the market reader",
		annotationLabel: "What changes",
		readers: [
			{
				id: "human",
				label: "Human decision-maker",
				summary:
					"People interpret products through questions, comparisons, constraints, and proof. They need enough context to challenge a claim before acting on it.",
				annotation: "A person can question the evidence, inspect its scope, and decide what to test next.",
			},
			{
				id: "agent",
				label: "Software agent",
				summary:
					"Agents assemble market understanding from distributed facts. They need explicit relationships and conditions so one claim is not mistaken for a universal answer.",
				annotation: "An agent needs explicit facts, conditions, and evidence it can carry into another buying context.",
			},
		],
		claimIds: [enHumanAgentDirection.id],
	},
	stage: {
		eyebrow: "Present stage",
		title: "A real platform. A service-led beginning.",
		summary: "Yonaris is an early company delivering a real evidence product through a service-led model.",
		currentScopeLabel: "How delivery works today",
		claimIds: [enServiceLedStage.id, enEvidencePlatform.id],
	},
	forest: {
		eyebrow: "Brand thesis",
		name: "Yonaris / Recursive Forest",
		title: "Don’t enumerate every question. Build what generates the answers.",
		summary:
			"Recursive Forest is a working method: govern finite product facts, conditions, relationships, and evidence so understanding can expand with the market context.",
		boundary:
			"It is a working method, not an implemented graph architecture or a claim that every possible question can be covered.",
		claimIds: [enRecursiveForestMethod.id],
	},
	principles: {
		eyebrow: "Operating principles",
		title: "Four commitments shape the work.",
		items: [
			{
				id: "evidence",
				title: "Evidence over theatre",
				description: "Show the answer and available source record before shaping a success narrative.",
			},
			{
				id: "scope",
				title: "Declare the scope",
				description: "Name the market, questions, surfaces, cohort, and timing behind every observation.",
			},
			{
				id: "review",
				title: "Keep human review",
				description: "Use judgment where evidence is incomplete and before a recommendation becomes action.",
			},
			{
				id: "truth",
				title: "Build durable product truth",
				description: "Keep claims bounded, reviewable, and useful to people and agents.",
			},
		],
	},
	contact: {
		eyebrow: "Begin with evidence",
		title: "Start with one question that matters.",
		summary:
			"Bring one brand, one market, and one decision question. We will confirm the scope before collecting evidence.",
		diagnosticLabel: "Get a Free Diagnostic",
		emailLabel: "Email the founding team",
		email: "black.dcp@outlook.com",
	},
	currentScope:
		"Configured evidence is customer-visible; parts of collection and recommendations remain Yonaris-operated and human-reviewed.",
	currentScopeClaimIds: [enServiceLedStage.id, enEvidencePlatform.id],
	claims: enClaims,
	limitations: [enHumanAgentDirection.limitation, enServiceLedStage.limitation, enRecursiveForestMethod.limitation],
} as const satisfies CompanyContent;

const zhHumanAgentDirection = {
	id: "company-human-agent-direction",
	status: "direction",
	text: "Yonaris 正在构建一套让人类团队与软件智能体共享市场事实基础的 MarTech",
	limitation: "这是公司的长期方向，并不表示面向智能体的所有设想都已在当前版本中实现",
} as const satisfies CompanyClaim;

const zhServiceLedStage = {
	id: "company-service-led-stage",
	status: "managed-delivery",
	text: "Yonaris 是一家早期公司，正以服务驱动的方式交付一套真实可用的市场证据产品",
	limitation: "当前流程还不是成熟的公开自助 SaaS",
} as const satisfies CompanyClaim;

const zhEvidencePlatform = {
	id: "company-evidence-platform",
	status: "current-software",
	text: "客户可以在工作区中检查已配置的回答样本、提及、引用和可用的公开查询",
	limitation: "覆盖范围取决于已配置的 Program，以及受支持界面实际公开的证据",
} as const satisfies CompanyClaim;

const zhRecursiveForestMethod = {
	id: "company-recursive-forest-method",
	status: "managed-delivery",
	text: "递归森林是 Yonaris 用来组织有限产品事实、条件、关系与证据的工作方法，让问题可以随市场语境继续展开",
	limitation: "它不是已经实现的图谱架构，也不表示系统能够覆盖所有可能的问题",
} as const satisfies CompanyClaim;

const zhClaims = [zhHumanAgentDirection, zhServiceLedStage, zhEvidencePlatform, zhRecursiveForestMethod] as const;

export const pageZh = {
	meta: {
		title: "重构 MarTech，同时面向人，也面向智能体",
		description: "Yonaris 是一家早期、以服务驱动的 AI 原生营销科技公司，正在为 AI 介入的市场建设真实可用的证据平台。",
	},
	category: "AI 原生营销科技",
	vision: {
		eyebrow: "公司 · 品类主张",
		title: "当人和机器共同参与市场，MarTech 需要一层新的事实基础",
		headline: "重构 MarTech，同时面向人，也面向智能体",
		summary: "AI 正在进入产品发现、比较与选择。Yonaris 为这一变化建设可检查的市场证据层",
		claimIds: [zhHumanAgentDirection.id],
	},
	marketShift: {
		eyebrow: "市场变化",
		title: "市场现在有两类读者",
		summary: "购买旅程不再只面对一种读者。人和软件智能体形成判断的方式不同，但都需要能够回到事实、条件与证据的产品主张",
		groupLabel: "选择市场读者",
		annotationLabel: "由此发生的变化",
		readers: [
			{
				id: "human",
				label: "人类决策者",
				summary: "人通过问题、比较、约束与证明理解产品。他们需要足够的语境，在采取行动之前判断一项主张是否成立",
				annotation: "人可以追问证据、检查范围，并判断下一步值得测试什么",
			},
			{
				id: "agent",
				label: "软件智能体",
				summary: "智能体从分散的事实中组织市场理解。它需要明确的关系与成立条件，避免把局部主张误读成普遍答案",
				annotation: "软件智能体需要明确的事实、条件与证据，才能把理解带入下一个购买语境",
			},
		],
		claimIds: [zhHumanAgentDirection.id],
	},
	stage: {
		eyebrow: "当前阶段",
		title: "真实的平台，服务驱动的起点",
		summary: "Yonaris 是一家早期公司，正以服务驱动的方式交付一套真实可用的市场证据产品",
		currentScopeLabel: "今天如何交付",
		claimIds: [zhServiceLedStage.id, zhEvidencePlatform.id],
	},
	forest: {
		eyebrow: "品牌理念",
		name: "Yonaris / 递归森林",
		title: "不穷举每一个问题，构建答案生长的根系",
		summary: "递归森林是一套工作方法：治理有限的产品事实、条件、关系与证据，让理解可以随市场语境继续生长",
		boundary: "它是一套工作方法，不是已经实现的图谱架构，也不表示系统能够覆盖所有可能的问题",
		claimIds: [zhRecursiveForestMethod.id],
	},
	principles: {
		eyebrow: "工作原则",
		title: "四项承诺决定我们如何工作",
		items: [
			{ id: "evidence", title: "证据优先于表演", description: "在包装成功叙事之前，先展示回答原文与可用的来源记录" },
			{ id: "scope", title: "声明范围", description: "每次观察都写明市场、问题、界面、样本集合与时间" },
			{ id: "review", title: "保留人工审核", description: "证据不完整时保留判断，并在建议变成行动之前由人复核" },
			{ id: "truth", title: "沉淀持久的产品事实", description: "让主张边界清楚、可以复核，并同时服务于人和智能体" },
		],
	},
	contact: {
		eyebrow: "从证据开始",
		title: "从一个真正重要的问题开始",
		summary: "告诉我们一个品牌、一个市场和一个决策问题。采集证据之前，我们会先确认测量范围",
		diagnosticLabel: "获取免费诊断",
		emailLabel: "联系创始团队",
		email: "black.dcp@outlook.com",
	},
	currentScope: "已配置的证据对客户可见；部分采集与建议仍由 Yonaris 团队执行，并经过人工审核",
	currentScopeClaimIds: [zhServiceLedStage.id, zhEvidencePlatform.id],
	claims: zhClaims,
	limitations: [zhHumanAgentDirection.limitation, zhServiceLedStage.limitation, zhRecursiveForestMethod.limitation],
} as const satisfies CompanyContent;

export const companyContentByLocale: DeepReadonly<Record<Locale, CompanyContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getCompanyContent(locale: Locale): DeepReadonly<CompanyContent> {
	return companyContentByLocale[locale];
}
