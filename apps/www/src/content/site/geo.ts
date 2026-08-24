import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export type GeoWorkflowStageId = "discovery" | "description" | "comparison" | "citation" | "verification";
export type GeoClaim = FactualClaim & { limitation: string };

export interface GeoWorkflowStage {
	id: GeoWorkflowStageId;
	title: string;
	question: string;
	observedSignal: string;
	boundedAction: string;
	claimIds: readonly GeoClaim["id"][];
}

export interface GeoWorkflowUi {
	workflowLabel: string;
	observedSignalLabel: string;
	boundedActionLabel: string;
	capabilityContextLabel: string;
	currentSoftwareLabel: string;
	managedDeliveryLabel: string;
	limitationLabel: string;
}

export interface GeoEvidenceBoundary {
	title: string;
	summary: string;
	claimIds: readonly GeoClaim["id"][];
}

export interface GeoContent {
	meta: PageMeta;
	category: string;
	eyebrow: string;
	headline: string;
	dek: string;
	boundary: GeoEvidenceBoundary;
	currentScope: string;
	currentScopeClaimIds: readonly GeoClaim["id"][];
	workflow: {
		eyebrow: string;
		title: string;
		summary: string;
		ui: GeoWorkflowUi;
		stages: readonly GeoWorkflowStage[];
		claimIds: readonly GeoClaim["id"][];
	};
	evidenceBoundary: GeoEvidenceBoundary;
	broaderCategory: {
		eyebrow: string;
		title: string;
		summary: string;
		productLabel: string;
		companyLabel: string;
		claimIds: readonly GeoClaim["id"][];
	};
	diagnostic: {
		eyebrow: string;
		title: string;
		summary: string;
		disclosure: string;
		label: string;
		claimIds: readonly GeoClaim["id"][];
	};
	claims: readonly GeoClaim[];
	limitations: readonly string[];
}

const enFirstAppliedWorkflow = {
	id: "geo-first-applied-workflow",
	status: "managed-delivery",
	text: "Yonaris applies its market-evidence workflow to GEO first: discovery, description, comparison, citation, and verification.",
	limitation: "GEO is the first applied workflow, not the completed extent of the Yonaris company direction.",
} as const satisfies GeoClaim;

const enConfiguredSampling = {
	id: "geo-configured-sampling",
	status: "managed-delivery",
	text: "Yonaris operates answer sampling for configured questions within a declared market, language, surface set, and observation period.",
	limitation: "The observation describes only that configured scope and period.",
} as const satisfies GeoClaim;

const enReviewableAnswers = {
	id: "geo-reviewable-answers",
	status: "current-software",
	text: "Customer workspaces make collected answer samples and brand mentions reviewable.",
	limitation: "A sampled answer is evidence from the declared scope, not a statement about the whole market.",
} as const satisfies GeoClaim;

const enConfiguredComparison = {
	id: "geo-configured-comparison",
	status: "current-software",
	text: "Configured-cohort comparisons place the tracked brand beside a configured competitor cohort under the same declared filter.",
	limitation: "The configured competitor cohort is not the entire market.",
} as const satisfies GeoClaim;

const enAvailableSourceEvidence = {
	id: "geo-available-source-evidence",
	status: "current-software",
	text: "Citations and exposed queries are shown when a supported surface exposes them.",
	limitation: "Missing evidence remains unknown and does not establish that no retrieval occurred.",
} as const satisfies GeoClaim;

const enHumanReviewedVerification = {
	id: "geo-human-reviewed-verification",
	status: "managed-delivery",
	text: "Yonaris turns reviewed evidence gaps into bounded, human-reviewed next tests and can repeat the declared observation.",
	limitation: "Change between repeated samples does not independently prove causation.",
} as const satisfies GeoClaim;

const enDiagnosticScopeConfirmation = {
	id: "geo-diagnostic-scope-confirmation",
	status: "managed-delivery",
	text: "The diagnostic measurement scope is confirmed with the Yonaris team before collection begins.",
	limitation: "A request starts a scope review; it does not produce an immediate evidence result.",
} as const satisfies GeoClaim;

const enBroaderMartechDirection = {
	id: "geo-broader-martech-direction",
	status: "direction",
	text: "Yonaris intends to build broader AI market evidence for markets shaped by people and software agents.",
	limitation: "That broader company direction is not presented as a completed set of software modules.",
} as const satisfies GeoClaim;

const enClaims = [
	enFirstAppliedWorkflow,
	enConfiguredSampling,
	enReviewableAnswers,
	enConfiguredComparison,
	enAvailableSourceEvidence,
	enHumanReviewedVerification,
	enDiagnosticScopeConfirmation,
	enBroaderMartechDirection,
] as const;

export const pageEn = {
	meta: {
		title: "GEO, grounded in evidence.",
		description:
			"Observe how configured AI systems discover, describe, compare, cite, and recommend a brand—then choose a bounded, human-reviewed next test.",
	},
	category: "AI market evidence",
	eyebrow: "GEO · Applied workflow",
	headline: "GEO, grounded in evidence.",
	dek: "Follow how a brand enters an AI answer, how the answer frames it, and which evidence can support the next test.",
	boundary: {
		title: "First workflow. Broader company.",
		summary: "GEO is the first applied workflow—not Yonaris's category ceiling.",
		claimIds: [enFirstAppliedWorkflow.id, enBroaderMartechDirection.id],
	},
	currentScope:
		"Configured questions, market, language, surfaces, competitor cohort, and observation period define every GEO engagement.",
	currentScopeClaimIds: [enConfiguredSampling.id, enConfiguredComparison.id],
	workflow: {
		eyebrow: "Applied evidence field",
		title: "Follow the answer, not a generic score.",
		summary:
			"Five linked questions move from first observation to a bounded retest. Every lane keeps the evidence and its limitation together.",
		ui: {
			workflowLabel: "GEO applied evidence workflow",
			observedSignalLabel: "Observed evidence",
			boundedActionLabel: "Bounded next move",
			capabilityContextLabel: "Capability context",
			currentSoftwareLabel: "Current software",
			managedDeliveryLabel: "Managed delivery",
			limitationLabel: "Boundary",
		},
		stages: [
			{
				id: "discovery",
				title: "Discovery",
				question: "When does the brand enter an answer?",
				observedSignal:
					"Review answer samples for brand inclusion across the configured questions and declared observation window.",
				boundedAction: "Choose one high-value absence or weak entry point and inspect the underlying answer.",
				claimIds: [enConfiguredSampling.id, enReviewableAnswers.id],
			},
			{
				id: "description",
				title: "Description",
				question: "How is the brand described?",
				observedSignal: "Read the attributes, caveats, and omissions in the collected answer text.",
				boundedAction: "Verify one material fact or context gap before framing a human-reviewed test.",
				claimIds: [enReviewableAnswers.id, enHumanReviewedVerification.id],
			},
			{
				id: "comparison",
				title: "Comparison",
				question: "How is the brand compared?",
				observedSignal:
					"Inspect the alternatives and criteria in each answer, then compare mentions inside the configured competitor cohort.",
				boundedAction: "Select one comparison criterion that needs clearer, supportable product evidence.",
				claimIds: [enConfiguredComparison.id, enReviewableAnswers.id],
			},
			{
				id: "citation",
				title: "Citation",
				question: "Which available sources shape the answer?",
				observedSignal: "Inspect citations and exposed queries only when the supported surface makes them available.",
				boundedAction: "Separate source evidence from unknown fields before deciding what deserves another test.",
				claimIds: [enAvailableSourceEvidence.id],
			},
			{
				id: "verification",
				title: "Verification",
				question: "What changes under the same declared test?",
				observedSignal: "Repeat the configured observation after one bounded, reviewed intervention.",
				boundedAction: "Compare the evidence within the same scope without assigning unsupported causality.",
				claimIds: [enHumanReviewedVerification.id, enConfiguredSampling.id],
			},
		],
		claimIds: [enFirstAppliedWorkflow.id, enConfiguredSampling.id],
	},
	evidenceBoundary: {
		title: "Evidence has edges.",
		summary:
			"Citations and exposed queries are evidence only when a supported surface makes them available. Missing evidence remains unknown. Repeated observation can show change but does not independently prove causation. Every next move remains human-reviewed.",
		claimIds: [enAvailableSourceEvidence.id, enHumanReviewedVerification.id],
	},
	broaderCategory: {
		eyebrow: "Beyond GEO",
		title: "The workflow starts here. The category does not end here.",
		summary:
			"GEO applies the Yonaris evidence system to how AI systems discover, describe, compare, and recommend a brand. The broader direction is AI market evidence for markets read by humans and agents.",
		productLabel: "See the evidence product",
		companyLabel: "Read the category thesis",
		claimIds: [enFirstAppliedWorkflow.id, enBroaderMartechDirection.id],
	},
	diagnostic: {
		eyebrow: "Free diagnostic",
		title: "Begin with one market question.",
		summary:
			"Give us one brand, one market, and one question that matters. Yonaris confirms the measurement scope before collecting evidence.",
		disclosure:
			"Submitting a request begins a scope review with the Yonaris team before collection. It does not produce an immediate evidence result.",
		label: "Get a Free Diagnostic",
		claimIds: [enDiagnosticScopeConfirmation.id],
	},
	claims: enClaims,
	limitations: [
		enConfiguredSampling.limitation,
		enConfiguredComparison.limitation,
		enAvailableSourceEvidence.limitation,
		enHumanReviewedVerification.limitation,
		enDiagnosticScopeConfirmation.limitation,
	],
} as const satisfies GeoContent;

const zhFirstAppliedWorkflow = {
	id: "geo-first-applied-workflow",
	status: "managed-delivery",
	text: "Yonaris 首先把市场证据工作流应用在 GEO：发现、描述、比较、引用与验证",
	limitation: "GEO 是第一项落地工作流，不代表 Yonaris 的公司方向已经全部实现",
} as const satisfies GeoClaim;

const zhConfiguredSampling = {
	id: "geo-configured-sampling",
	status: "managed-delivery",
	text: "Yonaris 围绕已配置的问题，在声明过的市场、语言、界面与观察周期内执行回答采样",
	limitation: "观察只描述这一次已配置的范围与周期",
} as const satisfies GeoClaim;

const zhReviewableAnswers = {
	id: "geo-reviewable-answers",
	status: "current-software",
	text: "客户可以在工作区中检查已采集的回答样本与品牌提及",
	limitation: "回答样本是声明范围内的证据，不代表整个市场",
} as const satisfies GeoClaim;

const zhConfiguredComparison = {
	id: "geo-configured-comparison",
	status: "current-software",
	text: "在相同筛选条件下，已配置集合比较会把目标品牌与已配置的竞品集合放在一起观察",
	limitation: "已配置的竞品集合不等于整个市场",
} as const satisfies GeoClaim;

const zhAvailableSourceEvidence = {
	id: "geo-available-source-evidence",
	status: "current-software",
	text: "当受支持界面公开引用或查询改写时，系统会展示这些记录",
	limitation: "证据缺失仍是未知，不能据此认定没有发生检索",
} as const satisfies GeoClaim;

const zhHumanReviewedVerification = {
	id: "geo-human-reviewed-verification",
	status: "managed-delivery",
	text: "Yonaris 把经过检查的证据缺口转化为边界明确、需要人工审核的下一步测试，并可重复同一项观察",
	limitation: "重复采样之间的变化不能独立证明因果关系",
} as const satisfies GeoClaim;

const zhDiagnosticScopeConfirmation = {
	id: "geo-diagnostic-scope-confirmation",
	status: "managed-delivery",
	text: "Yonaris 会在采集前与客户确认范围，再开始诊断证据收集",
	limitation: "提交请求会进入范围审核，不会立刻产生证据结果",
} as const satisfies GeoClaim;

const zhBroaderMartechDirection = {
	id: "geo-broader-martech-direction",
	status: "direction",
	text: "Yonaris 计划构建面向人类与软件智能体共同参与市场的、更广泛的 AI 原生营销科技",
	limitation: "这一公司方向不会被描述成一组已经完成的软件模块",
} as const satisfies GeoClaim;

const zhClaims = [
	zhFirstAppliedWorkflow,
	zhConfiguredSampling,
	zhReviewableAnswers,
	zhConfiguredComparison,
	zhAvailableSourceEvidence,
	zhHumanReviewedVerification,
	zhDiagnosticScopeConfirmation,
	zhBroaderMartechDirection,
] as const;

export const pageZh = {
	meta: {
		title: "让 GEO 建立在证据之上",
		description: "观察 AI 系统如何发现、描述、比较、引用与推荐一个品牌，再选择一项边界清楚、经过人工审核的下一步测试。",
	},
	category: "AI 原生营销科技",
	eyebrow: "GEO · 落地工作流",
	headline: "让 GEO 建立在证据之上",
	dek: "沿着回答去看：品牌怎样进入 AI 的市场理解，答案如何描述它，又有哪些证据足以支撑下一步测试",
	boundary: {
		title: "第一项工作流 更广的公司方向",
		summary: "GEO 是 Yonaris 第一项落地工作流，而不是公司的品类上限",
		claimIds: [zhFirstAppliedWorkflow.id, zhBroaderMartechDirection.id],
	},
	currentScope: "已配置的问题、市场、语言、界面、竞品集合与观察周期，共同定义每一次 GEO 工作范围",
	currentScopeClaimIds: [zhConfiguredSampling.id, zhConfiguredComparison.id],
	workflow: {
		eyebrow: "落地证据场",
		title: "沿着回答观察 不止于一个分数",
		summary: "五个相连的问题，从第一次观察走向一次边界明确的复测。每一段都把证据和它的限制放在一起",
		ui: {
			workflowLabel: "GEO 落地证据工作流",
			observedSignalLabel: "观察到的证据",
			boundedActionLabel: "边界明确的下一步",
			capabilityContextLabel: "能力说明",
			currentSoftwareLabel: "当前软件能力",
			managedDeliveryLabel: "服务交付",
			limitationLabel: "边界",
		},
		stages: [
			{
				id: "discovery",
				title: "发现",
				question: "品牌在什么情况下进入回答",
				observedSignal: "在已配置的问题与声明过的观察周期内，检查回答样本是否包含品牌",
				boundedAction: "选择一个重要但缺席、或进入方式较弱的问题，再检查对应回答原文",
				claimIds: [zhConfiguredSampling.id, zhReviewableAnswers.id],
			},
			{
				id: "description",
				title: "描述",
				question: "答案如何描述品牌",
				observedSignal: "阅读回答样本中的属性、限定条件与遗漏",
				boundedAction: "先核实一项重要事实或语境缺口，再设计一项需要人工审核的测试",
				claimIds: [zhReviewableAnswers.id, zhHumanReviewedVerification.id],
			},
			{
				id: "comparison",
				title: "比较",
				question: "答案如何比较品牌",
				observedSignal: "检查每条回答中的替代方案与比较标准，再观察已配置竞品集合内的提及",
				boundedAction: "选择一项需要更清晰、且能被产品证据支持的比较标准",
				claimIds: [zhConfiguredComparison.id, zhReviewableAnswers.id],
			},
			{
				id: "citation",
				title: "引用",
				question: "哪些可用来源参与了回答",
				observedSignal: "只在受支持界面提供相关字段时，检查引用与公开的查询改写",
				boundedAction: "先把来源证据与未知字段分开，再判断什么值得进入下一次测试",
				claimIds: [zhAvailableSourceEvidence.id],
			},
			{
				id: "verification",
				title: "验证",
				question: "在同一项测试下，哪些证据发生了变化",
				observedSignal: "完成一项边界明确、经过审核的干预后，重复同一项已配置观察",
				boundedAction: "在相同范围内比较证据，不为变化添加证据之外的因果解释",
				claimIds: [zhHumanReviewedVerification.id, zhConfiguredSampling.id],
			},
		],
		claimIds: [zhFirstAppliedWorkflow.id, zhConfiguredSampling.id],
	},
	evidenceBoundary: {
		title: "证据有它的边界",
		summary:
			"只有受支持界面提供的引用与查询改写，才能成为可检查的来源证据。证据缺失仍是未知。重复观察可以显示变化，但不能独立证明因果关系。每一项下一步动作都需要人工审核",
		claimIds: [zhAvailableSourceEvidence.id, zhHumanReviewedVerification.id],
	},
	broaderCategory: {
		eyebrow: "GEO 之外",
		title: "工作流从这里开始 品类不止于此",
		summary:
			"GEO 把 Yonaris 的证据系统应用在 AI 如何发现、描述、比较与推荐品牌上。更广的方向，是服务于人类与软件智能体共同参与市场的 AI 原生营销科技",
		productLabel: "查看证据产品",
		companyLabel: "阅读品类主张",
		claimIds: [zhFirstAppliedWorkflow.id, zhBroaderMartechDirection.id],
	},
	diagnostic: {
		eyebrow: "免费诊断",
		title: "从一个真正重要的市场问题开始",
		summary: "给我们一个品牌、一个市场和一个真正重要的问题。Yonaris 会先确认测量范围，再开始收集证据",
		disclosure: "提交请求会先进入范围审核，再开始采集，不会立即产生证据结果",
		label: "获取免费诊断",
		claimIds: [zhDiagnosticScopeConfirmation.id],
	},
	claims: zhClaims,
	limitations: [
		zhConfiguredSampling.limitation,
		zhConfiguredComparison.limitation,
		zhAvailableSourceEvidence.limitation,
		zhHumanReviewedVerification.limitation,
		zhDiagnosticScopeConfirmation.limitation,
	],
} as const satisfies GeoContent;

export const geoContentByLocale: DeepReadonly<Record<Locale, GeoContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getGeoContent(locale: Locale): DeepReadonly<GeoContent> {
	return geoContentByLocale[locale];
}
