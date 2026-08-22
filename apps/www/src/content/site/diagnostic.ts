import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export interface DiagnosticStage {
	id: string;
	title: string;
	fields: readonly string[];
}

export interface DiagnosticContent {
	meta: PageMeta;
	eyebrow: string;
	offer: string;
	confirmation: string;
	currentScope: string;
	stages: readonly DiagnosticStage[];
	likelyOutputs: readonly string[];
	deliveryExpectation: string;
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const pageEn = {
	meta: {
		title: "Start with one market question that matters.",
		description: "Request a free diagnostic working session; Yonaris confirms scope before evidence collection begins.",
	},
	eyebrow: "Diagnostic working session",
	offer: "Give us one brand, one market, and one question that matters.",
	confirmation: "Yonaris confirms the measurement scope before collecting evidence.",
	currentScope: "The diagnostic is a team-reviewed request and delivery workflow, not an instant automated scan.",
	stages: [
		{
			id: "scope",
			title: "Describe the decision",
			fields: ["Website", "Brand", "Market or category", "One decision question"],
		},
		{
			id: "review",
			title: "Add context and review",
			fields: ["Known competitors", "Name", "Work email", "Consent and disclosure"],
		},
	],
	likelyOutputs: [
		"A scoped baseline",
		"Selected answer and source evidence",
		"The clearest observed gaps",
		"Three next tests to consider",
	],
	deliveryExpectation:
		"After submission, the Yonaris team reviews the request, confirms a workable scope, and explains what can be collected before beginning evidence work.",
	claims: [
		{
			id: "diagnostic-scope-confirmation",
			status: "managed-delivery",
			text: "A Yonaris team member reviews and confirms the proposed measurement scope before collection.",
			limitation:
				"Submitting the form does not guarantee that every requested market, question, or surface can be supported.",
		},
		{
			id: "diagnostic-likely-output",
			status: "managed-delivery",
			text: "A confirmed diagnostic is intended to provide a scoped baseline, selected evidence, clear gaps, and three candidate next tests.",
			limitation: "Final deliverables depend on scope confirmation and evidence availability.",
		},
	],
	limitations: [
		"Submission produces a request confirmation, not an instant score, report, or evidence collection result.",
		"Available surfaces and evidence fields are confirmed by the Yonaris team before collection.",
	],
} as const satisfies DiagnosticContent;

export const pageZh = {
	meta: {
		title: "从一个真正影响决策的市场问题开始。",
		description: "申请一次免费诊断工作会；Yonaris 会在采集证据前先确认测量范围。",
	},
	eyebrow: "诊断工作会",
	offer: "告诉我们一个品牌、一个市场，以及一个真正重要的问题。",
	confirmation: "Yonaris 会在采集证据之前确认测量范围。",
	currentScope: "这项诊断由团队审核申请并完成交付，不是即时运行的自动扫描。",
	stages: [
		{ id: "scope", title: "描述决策场景", fields: ["网站", "品牌", "市场或品类", "一个决策问题"] },
		{ id: "review", title: "补充背景并确认", fields: ["已知竞品", "姓名", "工作邮箱", "同意与说明"] },
	],
	likelyOutputs: ["一份范围明确的基线", "选取的回答与来源证据", "最清晰的已观察缺口", "三项可考虑的下一步测试"],
	deliveryExpectation: "提交后，Yonaris 团队会审核申请、确认可执行的范围，并在开始证据工作前说明能够采集什么。",
	claims: [
		{
			id: "diagnostic-scope-confirmation",
			status: "managed-delivery",
			text: "Yonaris 团队成员会在采集前审核并确认拟定的测量范围。",
			limitation: "提交表单并不保证每个市场、问题或界面都能获得支持。",
		},
		{
			id: "diagnostic-likely-output",
			status: "managed-delivery",
			text: "范围确认后的诊断，计划交付一份基线、选取的证据、明确缺口和三项候选测试。",
			limitation: "最终交付取决于范围确认与证据是否可用。",
		},
	],
	limitations: [
		"提交后得到的是申请确认，不是即时分数、报告或采集结果。",
		"可用界面与证据字段会由 Yonaris 团队在采集前确认。",
	],
} as const satisfies DiagnosticContent;

export const diagnosticContentByLocale: DeepReadonly<Record<Locale, DiagnosticContent>> = deepFreeze({
	en: pageEn,
	zh: pageZh,
});

export function getDiagnosticContent(locale: Locale): DeepReadonly<DiagnosticContent> {
	return diagnosticContentByLocale[locale];
}
