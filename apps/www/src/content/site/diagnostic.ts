import type { DiagnosticLeadField, DiagnosticStageId } from "@/lib/diagnostic-schema";
import type { PageMeta } from "./global";
import { type DeepReadonly, deepFreeze, type FactualClaim, type Locale } from "./types";

export interface DiagnosticStage {
	id: DiagnosticStageId;
	progressLabel: string;
	title: string;
	summary: string;
	fields: readonly DiagnosticLeadField[];
}

export interface DiagnosticFieldCopy {
	label: string;
	placeholder: string;
	error: string;
}

export interface DiagnosticContent {
	meta: PageMeta;
	eyebrow: string;
	headline: string;
	offer: string;
	confirmation: string;
	currentScope: string;
	currentScopeClaimIds: readonly string[];
	stages: readonly [DiagnosticStage, DiagnosticStage];
	likelyOutput: {
		eyebrow: string;
		title: string;
		introduction: string;
		items: readonly string[];
		claimIds: readonly string[];
	};
	form: {
		fields: Record<Exclude<DiagnosticLeadField, "consent">, DiagnosticFieldCopy>;
		consent: {
			label: string;
			error: string;
			privacyLeadIn: string;
			privacyLinkLabel: string;
		};
		honeypotLabel: string;
		validationSummary: string;
		reviewLabel: string;
		actions: {
			continue: string;
			back: string;
			submit: string;
			submitting: string;
			retry: string;
		};
		success: { title: string; body: string };
		failure: {
			title: string;
			body: string;
			fallbackLabel: string;
			fallbackDisclosure: string;
		};
		disclosure: string;
	};
	homeOffer: {
		eyebrow: string;
		title: string;
		body: string;
		actionLabel: string;
		disclosure: string;
		claimIds: readonly string[];
	};
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export type PrivacySectionId = "submitted-data" | "abuse-control" | "delivery" | "purpose" | "browser-data" | "contact";

export interface PrivacySection {
	id: PrivacySectionId;
	title: string;
	body: readonly string[];
}

export interface PrivacyLanguageContent {
	id: "en" | "zh";
	lang: "en" | "zh-CN";
	title: string;
	introduction: string;
	sections: readonly [PrivacySection, PrivacySection, PrivacySection, PrivacySection, PrivacySection, PrivacySection];
	returnLabel: string;
	returnPath: "/diagnostic" | "/zh/diagnostic";
}

export interface PrivacyContent {
	meta: PageMeta;
	jumpLabel: string;
	languages: readonly [PrivacyLanguageContent, PrivacyLanguageContent];
}

export const pageEn = {
	meta: {
		title: "See what AI sees before you decide what to change.",
		description: "Request a free diagnostic working session; Yonaris confirms scope before evidence collection begins.",
	},
	eyebrow: "Free market diagnostic",
	headline: "See what AI sees before you decide what to change.",
	offer: "One brand. One market. One decision question.",
	confirmation: "We confirm the scope before we collect evidence.",
	currentScope: "A submitted request enters the review queue. It does not trigger a scan or begin evidence collection.",
	currentScopeClaimIds: ["diagnostic-scope-confirmation"],
	stages: [
		{
			id: "scope",
			progressLabel: "1 / Scope",
			title: "Frame the market question",
			summary: "Tell us what you need to understand before the next decision.",
			fields: ["website", "brand", "market", "question"],
		},
		{
			id: "contact",
			progressLabel: "2 / Contact",
			title: "Add context and submit",
			summary: "Add any competitors, then tell us how to reach you.",
			fields: ["competitors", "name", "email", "consent"],
		},
	],
	likelyOutput: {
		eyebrow: "Likely output",
		title: "What a confirmed scope can produce",
		introduction: "Subject to team confirmation and evidence availability, the diagnostic is intended to provide:",
		items: [
			"A scoped baseline",
			"Selected answer and source evidence",
			"The clearest observed gaps",
			"Three next tests to consider",
		],
		claimIds: ["diagnostic-likely-output"],
	},
	form: {
		fields: {
			website: {
				label: "Website",
				placeholder: "https://example.com",
				error: "Enter an absolute http or https website.",
			},
			brand: {
				label: "Brand",
				placeholder: "Your brand or company",
				error: "Enter the brand or company name.",
			},
			market: {
				label: "Market or category",
				placeholder: "What market are you competing in?",
				error: "Enter the market or category.",
			},
			question: {
				label: "Market question",
				placeholder: "What do you need to understand before your next market decision?",
				error: "Enter a market question of at least 10 characters.",
			},
			competitors: {
				label: "Known competitors",
				placeholder: "Optional names or URLs, separated by commas",
				error: "Keep competitor context within 600 characters.",
			},
			name: { label: "Your name", placeholder: "Name", error: "Enter your name." },
			email: { label: "Work email", placeholder: "you@company.com", error: "Enter a valid email address." },
		},
		consent: {
			label: "I agree that Yonaris may use these details to review my request and contact me.",
			error: "Confirm consent before requesting the diagnostic.",
			privacyLeadIn: "How these details are handled:",
			privacyLinkLabel: "How we handle diagnostic request data",
		},
		honeypotLabel: "Company URL (leave blank)",
		validationSummary: "Review the highlighted fields before continuing.",
		reviewLabel: "Review the diagnostic request",
		actions: {
			continue: "Continue",
			back: "Back",
			submit: "Request a free diagnostic",
			submitting: "Submitting…",
			retry: "Try again",
		},
		success: {
			title: "Request submitted for review",
			body: "Your request has been submitted for Yonaris review. The team reviews the scope before any evidence collection begins. This is not an instant diagnostic result.",
		},
		failure: {
			title: "We couldn’t confirm delivery",
			body: "Your details remain on this page. Try again or open an email draft.",
			fallbackLabel: "Open email draft",
			fallbackDisclosure:
				"Opening an email draft does not send it; review the draft and send it from your email client.",
		},
		disclosure:
			"Submitting requests a Yonaris team scope review. It does not create an instant scan, score, or evidence result.",
	},
	homeOffer: {
		eyebrow: "Free diagnostic",
		title: "Start with the question behind your next market move.",
		body: "Give Yonaris one brand, one market, and one important question. The team confirms the measurement scope before evidence collection.",
		actionLabel: "Get a Free Diagnostic",
		disclosure: "Submitting creates no instant scan, score, or evidence result.",
		claimIds: ["diagnostic-scope-confirmation", "diagnostic-likely-output"],
	},
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
		title: "先看见 AI 看见了什么，再决定改变什么",
		description: "申请一次免费诊断工作会；Yonaris 会在采集证据前先确认测量范围。",
	},
	eyebrow: "免费市场诊断",
	headline: "先看见 AI 看见了什么，再决定改变什么",
	offer: "一个品牌，一个市场，一个决策问题",
	confirmation: "采集证据前，我们会先和你确认范围",
	currentScope: "提交申请只会进入审核队列，不会触发扫描，也不会立即开始证据采集。",
	currentScopeClaimIds: ["diagnostic-scope-confirmation"],
	stages: [
		{
			id: "scope",
			progressLabel: "1 / 范围",
			title: "界定市场问题",
			summary: "告诉我们下一步决策前最需要看清什么",
			fields: ["website", "brand", "market", "question"],
		},
		{
			id: "contact",
			progressLabel: "2 / 联系",
			title: "补充背景并提交",
			summary: "补充竞品信息，并留下联系方式",
			fields: ["competitors", "name", "email", "consent"],
		},
	],
	likelyOutput: {
		eyebrow: "可能的交付",
		title: "范围确认后可以形成什么",
		introduction: "在团队确认范围且证据可用的前提下，这项诊断计划提供：",
		items: ["一份范围明确的基线", "选取的回答与来源证据", "最清晰的已观察缺口", "三项可考虑的下一步测试"],
		claimIds: ["diagnostic-likely-output"],
	},
	form: {
		fields: {
			website: {
				label: "官网",
				placeholder: "https://example.com",
				error: "请输入以 http 或 https 开头的完整网址。",
			},
			brand: { label: "品牌", placeholder: "你的品牌或公司", error: "请输入品牌或公司名称。" },
			market: {
				label: "市场或品类",
				placeholder: "你正在参与哪个市场的竞争？",
				error: "请输入市场或品类。",
			},
			question: {
				label: "市场问题",
				placeholder: "下一步市场决策前，你最需要看清什么？",
				error: "请输入至少 10 个字符的市场问题。",
			},
			competitors: {
				label: "已知竞品",
				placeholder: "选填：名称或网址，用逗号分隔",
				error: "竞品信息请控制在 600 个字符以内。",
			},
			name: { label: "你的姓名", placeholder: "姓名", error: "请输入姓名。" },
			email: { label: "工作邮箱", placeholder: "you@company.com", error: "请输入有效的邮箱地址。" },
		},
		consent: {
			label: "我同意 Yonaris 使用这些信息审核本次申请并与我联系。",
			error: "申请诊断前，请确认同意以上说明。",
			privacyLeadIn: "了解这些信息如何处理：",
			privacyLinkLabel: "我们如何处理诊断申请信息",
		},
		honeypotLabel: "公司网址（请留空）",
		validationSummary: "请检查并补全标出的字段。",
		reviewLabel: "确认诊断申请",
		actions: {
			continue: "继续",
			back: "返回上一步",
			submit: "申请免费诊断",
			submitting: "正在提交…",
			retry: "重试",
		},
		success: {
			title: "申请已提交审核",
			body: "申请已提交，等待 Yonaris 团队审核。团队会先确认范围，再开始任何证据采集。这不是即时诊断结果。",
		},
		failure: {
			title: "我们无法确认申请是否送达",
			body: "你填写的信息仍保留在本页，可以重试或打开邮件草稿。",
			fallbackLabel: "打开邮件草稿",
			fallbackDisclosure: "打开邮件草稿并不代表已经发送，请检查草稿并在邮件客户端中发送。",
		},
		disclosure: "提交后将由 Yonaris 团队审核范围，不会即时生成扫描、分数或证据结果。",
	},
	homeOffer: {
		eyebrow: "免费诊断",
		title: "从决定下一步市场行动的问题开始",
		body: "告诉 Yonaris 一个品牌、一个市场和一个重要问题，团队会在采集证据前确认测量范围。",
		actionLabel: "获取免费诊断",
		disclosure: "提交后不会即时生成扫描、分数或证据结果。",
		claimIds: ["diagnostic-scope-confirmation", "diagnostic-likely-output"],
	},
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

const privacyContent: DeepReadonly<PrivacyContent> = deepFreeze({
	meta: {
		title: "How we handle diagnostic request data",
		description: "How Yonaris handles information submitted with a diagnostic request.",
	},
	jumpLabel: "Language / 语言",
	languages: [
		{
			id: "en",
			lang: "en",
			title: "How we handle diagnostic request data",
			introduction:
				"This note explains what the free diagnostic form sends, why we use it, and what stays out of browser analytics.",
			sections: [
				{
					id: "submitted-data",
					title: "Information you submit",
					body: [
						"The request includes your website, brand, market or category, one decision question, optional competitors, name, email, and consent.",
					],
				},
				{
					id: "abuse-control",
					title: "Abuse protection",
					body: [
						"A client IP supplied by our trusted proxy is used only for coarse, short-lived rate limiting to reduce abuse.",
					],
				},
				{
					id: "delivery",
					title: "Email delivery",
					body: ["After the email service accepts a request, it is sent by email to the Yonaris team."],
				},
				{
					id: "purpose",
					title: "Why we use it",
					body: ["We use these details to review the request, confirm a workable scope, and respond."],
				},
				{
					id: "browser-data",
					title: "Browser analytics",
					body: [
						"Diagnostic field values are not added to client analytics events or written to localStorage or cookies.",
					],
				},
				{
					id: "contact",
					title: "Questions",
					body: ["Questions about diagnostic request data can be sent to black.dcp@outlook.com."],
				},
			],
			returnLabel: "Return to the diagnostic",
			returnPath: "/diagnostic",
		},
		{
			id: "zh",
			lang: "zh-CN",
			title: "我们如何处理诊断申请信息",
			introduction: "本说明列出免费诊断表单会发送的信息、使用目的，以及不会进入浏览器分析的数据。",
			sections: [
				{
					id: "submitted-data",
					title: "你提交的信息",
					body: ["申请包含官网、品牌、市场或品类、一个决策问题、选填竞品、姓名、邮箱和同意确认。"],
				},
				{
					id: "abuse-control",
					title: "防滥用保护",
					body: ["为限制短时间内的滥用请求，我们仅将受信任代理提供的客户端 IP 用于粗粒度限流。"],
				},
				{
					id: "delivery",
					title: "邮件传递",
					body: ["邮件服务接受申请后，申请会通过邮件发送给 Yonaris 团队。"],
				},
				{
					id: "purpose",
					title: "信息用途",
					body: ["我们使用这些信息审核申请、确认可执行范围并回复你。"],
				},
				{
					id: "browser-data",
					title: "浏览器分析",
					body: ["诊断字段不会加入客户端分析事件，也不会写入 localStorage 或 Cookie。"],
				},
				{
					id: "contact",
					title: "问题咨询",
					body: ["如对诊断申请信息有疑问，请联系 black.dcp@outlook.com。"],
				},
			],
			returnLabel: "返回诊断申请",
			returnPath: "/zh/diagnostic",
		},
	],
});

export function getDiagnosticContent(locale: Locale): DeepReadonly<DiagnosticContent> {
	return diagnosticContentByLocale[locale];
}

export function getPrivacyContent(): DeepReadonly<PrivacyContent> {
	return privacyContent;
}
