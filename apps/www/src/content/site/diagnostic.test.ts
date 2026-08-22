import { describe, expect, it } from "vitest";
import { getDiagnosticContent, getPrivacyContent } from "./diagnostic";

const expectedFieldCopy = {
	en: {
		website: ["Website", "https://example.com", "Enter an absolute http or https website."],
		brand: ["Brand", "Your brand or company", "Enter the brand or company name."],
		market: ["Market or category", "What market are you competing in?", "Enter the market or category."],
		question: [
			"Market question",
			"What do you need to understand before your next market decision?",
			"Enter a market question of at least 10 characters.",
		],
		competitors: [
			"Known competitors",
			"Optional names or URLs, separated by commas",
			"Keep competitor context within 600 characters.",
		],
		name: ["Your name", "Name", "Enter your name."],
		email: ["Work email", "you@company.com", "Enter a valid email address."],
	},
	zh: {
		website: ["官网", "https://example.com", "请输入以 http 或 https 开头的完整网址。"],
		brand: ["品牌", "你的品牌或公司", "请输入品牌或公司名称。"],
		market: ["市场或品类", "你正在参与哪个市场的竞争？", "请输入市场或品类。"],
		question: ["市场问题", "下一步市场决策前，你最需要看清什么？", "请输入至少 10 个字符的市场问题。"],
		competitors: ["已知竞品", "选填：名称或网址，用逗号分隔", "竞品信息请控制在 600 个字符以内。"],
		name: ["你的姓名", "姓名", "请输入姓名。"],
		email: ["工作邮箱", "you@company.com", "请输入有效的邮箱地址。"],
	},
} as const;

describe("diagnostic content", () => {
	it("uses the audited diagnostic hero without implying collection has begun", () => {
		expect(getDiagnosticContent("en")).toMatchObject({
			eyebrow: "Free market diagnostic",
			headline: "See what AI sees before you decide what to change.",
			offer: "One brand. One market. One decision question.",
			confirmation: "We confirm the scope before we collect evidence.",
		});
		expect(getDiagnosticContent("zh")).toMatchObject({
			eyebrow: "免费市场诊断",
			headline: "先看见 AI 看见了什么，再决定改变什么",
			offer: "一个品牌，一个市场，一个决策问题",
			confirmation: "采集证据前，我们会先和你确认范围",
		});
	});

	it("authors the exact two-stage field order in both languages", () => {
		expect(getDiagnosticContent("en").stages).toMatchObject([
			{
				id: "scope",
				progressLabel: "1 / Scope",
				title: "Frame the market question",
				fields: ["website", "brand", "market", "question"],
			},
			{
				id: "contact",
				progressLabel: "2 / Contact",
				title: "Add context and submit",
				fields: ["competitors", "name", "email", "consent"],
			},
		]);
		expect(getDiagnosticContent("zh").stages).toMatchObject([
			{
				id: "scope",
				progressLabel: "1 / 范围",
				title: "界定市场问题",
				fields: ["website", "brand", "market", "question"],
			},
			{
				id: "contact",
				progressLabel: "2 / 联系",
				title: "补充背景并提交",
				fields: ["competitors", "name", "email", "consent"],
			},
		]);
		expect(getDiagnosticContent("en").stages.map(({ summary }) => summary)).toEqual([
			"Tell us what you need to understand before the next decision.",
			"Add any competitors, then tell us how to reach you.",
		]);
		expect(getDiagnosticContent("zh").stages.map(({ summary }) => summary)).toEqual([
			"告诉我们下一步决策前最需要看清什么",
			"补充竞品信息，并留下联系方式",
		]);
	});

	it("keeps field labels, placeholders, and authored validation messages exact", () => {
		for (const locale of ["en", "zh"] as const) {
			const fields = getDiagnosticContent(locale).form.fields;
			for (const field of Object.keys(expectedFieldCopy[locale]) as (keyof typeof fields)[]) {
				expect([fields[field].label, fields[field].placeholder, fields[field].error]).toEqual(
					expectedFieldCopy[locale][field],
				);
			}
		}
	});

	it("pins localized actions, consent, privacy, and honest result states", () => {
		const english = getDiagnosticContent("en").form;
		const chinese = getDiagnosticContent("zh").form;
		expect(english.actions).toEqual({
			continue: "Continue",
			back: "Back",
			submit: "Request a free diagnostic",
			submitting: "Submitting…",
			retry: "Try again",
		});
		expect(chinese.actions).toEqual({
			continue: "继续",
			back: "返回上一步",
			submit: "申请免费诊断",
			submitting: "正在提交…",
			retry: "重试",
		});
		expect(english.consent).toMatchObject({
			label: "I agree that Yonaris may use these details to review my request and contact me.",
			privacyLinkLabel: "How we handle diagnostic request data",
		});
		expect(chinese.consent).toMatchObject({
			label: "我同意 Yonaris 使用这些信息审核本次申请并与我联系。",
			privacyLinkLabel: "我们如何处理诊断申请信息",
		});
		expect(english.success).toEqual({
			title: "Request submitted for review",
			body: "Your request has been submitted for Yonaris review. The team reviews the scope before any evidence collection begins. This is not an instant diagnostic result.",
		});
		expect(chinese.success).toEqual({
			title: "申请已提交审核",
			body: "申请已提交，等待 Yonaris 团队审核。团队会先确认范围，再开始任何证据采集。这不是即时诊断结果。",
		});
		expect(`${english.success.body} ${chinese.success.body}`).toMatch(
			/not an instant diagnostic result|不是即时诊断结果/,
		);
		expect(english.failure).toMatchObject({
			title: "We couldn’t confirm delivery",
			fallbackLabel: "Open email draft",
		});
		expect(chinese.failure).toMatchObject({
			title: "我们无法确认申请是否送达",
			fallbackLabel: "打开邮件草稿",
		});
		expect(`${english.failure.body} ${chinese.failure.body}`).toMatch(/remain on this page|仍保留在本页/);
		expect(`${english.failure.fallbackDisclosure} ${chinese.failure.fallbackDisclosure}`).toMatch(
			/opening an email draft does not send it|打开邮件草稿并不代表已经发送/,
		);
	});

	it("references only the two managed diagnostic claims from every promise surface", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getDiagnosticContent(locale);
			expect(content.claims.map(({ id, status }) => ({ id, status }))).toEqual([
				{ id: "diagnostic-scope-confirmation", status: "managed-delivery" },
				{ id: "diagnostic-likely-output", status: "managed-delivery" },
			]);
			expect(content.currentScopeClaimIds).toEqual(["diagnostic-scope-confirmation"]);
			expect(content.likelyOutput.claimIds).toEqual(["diagnostic-likely-output"]);
			expect(content.homeOffer.claimIds).toEqual(["diagnostic-scope-confirmation", "diagnostic-likely-output"]);
		}
	});

	it("makes the homepage offer truthful and equivalent without promising an instant result", () => {
		const english = getDiagnosticContent("en").homeOffer;
		const chinese = getDiagnosticContent("zh").homeOffer;
		expect(english.title).toBe("Start with the question behind your next market move.");
		expect(chinese.title).toBe("从决定下一步市场行动的问题开始");
		for (const offer of [english, chinese]) {
			expect(offer.body).toMatch(/brand|品牌/);
			expect(offer.body).toMatch(/market|市场/);
			expect(offer.body).toMatch(/question|问题/);
			expect(offer.body).toMatch(/confirm|确认/);
			expect(offer.disclosure).toMatch(/instant scan|即时.*扫描/);
			expect(offer.disclosure).toMatch(/score|分数/);
			expect(offer.disclosure).toMatch(/evidence result|证据结果/);
		}
	});
});

describe("diagnostic Privacy content", () => {
	it("publishes one canonical disclosure with complete language metadata and return paths", () => {
		const privacy = getPrivacyContent();
		expect(
			privacy.languages.map(({ id, lang, title, returnLabel, returnPath }) => ({
				id,
				lang,
				title,
				returnLabel,
				returnPath,
			})),
		).toEqual([
			{
				id: "en",
				lang: "en",
				title: "How we handle diagnostic request data",
				returnLabel: "Return to the diagnostic",
				returnPath: "/diagnostic",
			},
			{
				id: "zh",
				lang: "zh-CN",
				title: "我们如何处理诊断申请信息",
				returnLabel: "返回诊断申请",
				returnPath: "/zh/diagnostic",
			},
		]);
	});

	it("keeps the six allowed facts semantically aligned across English and Chinese", () => {
		const [english, chinese] = getPrivacyContent().languages;
		const sectionIds = ["submitted-data", "abuse-control", "delivery", "purpose", "browser-data", "contact"];
		expect(english.sections.map(({ id }) => id)).toEqual(sectionIds);
		expect(chinese.sections.map(({ id }) => id)).toEqual(sectionIds);

		const en = JSON.stringify(english);
		const zh = JSON.stringify(chinese);
		expect(en).toMatch(
			/website.*brand.*market or category.*decision question.*optional competitors.*name.*email.*consent/i,
		);
		expect(zh).toMatch(/官网.*品牌.*市场或品类.*决策问题.*选填竞品.*姓名.*邮箱.*同意/);
		expect(en).toMatch(/client IP.*trusted proxy.*coarse.*short-lived rate limiting.*abuse/i);
		expect(zh).toMatch(/滥用请求.*受信任代理.*客户端 IP.*粗粒度限流/);
		expect(en).toMatch(/email service.*email.*Yonaris team/i);
		expect(zh).toMatch(/邮件服务.*邮件.*Yonaris 团队/);
		expect(en).toMatch(/review.*confirm.*scope.*respond/i);
		expect(zh).toMatch(/审核.*确认.*范围.*回复/);
		expect(en).toMatch(/not added to client analytics events.*(?:not |or )written to localStorage or cookies/i);
		expect(zh).toMatch(/不会加入客户端分析事件.*不会写入 localStorage 或 Cookie/);
		expect(en).toContain("black.dcp@outlook.com");
		expect(zh).toContain("black.dcp@outlook.com");
	});

	it("pins the audited Privacy introductions, section labels, and factual paragraphs", () => {
		const [english, chinese] = getPrivacyContent().languages;
		expect(english.introduction).toBe(
			"This note explains what the free diagnostic form sends, why we use it, and what stays out of browser analytics.",
		);
		expect(english.sections.map(({ title, body }) => [title, body[0]])).toEqual([
			[
				"Information you submit",
				"The request includes your website, brand, market or category, one decision question, optional competitors, name, email, and consent.",
			],
			[
				"Abuse protection",
				"A client IP supplied by our trusted proxy is used only for coarse, short-lived rate limiting to reduce abuse.",
			],
			["Email delivery", "After the email service accepts a request, it is sent by email to the Yonaris team."],
			["Why we use it", "We use these details to review the request, confirm a workable scope, and respond."],
			[
				"Browser analytics",
				"Diagnostic field values are not added to client analytics events or written to localStorage or cookies.",
			],
			["Questions", "Questions about diagnostic request data can be sent to black.dcp@outlook.com."],
		]);
		expect(chinese.introduction).toBe("本说明列出免费诊断表单会发送的信息、使用目的，以及不会进入浏览器分析的数据。");
		expect(chinese.sections.map(({ title, body }) => [title, body[0]])).toEqual([
			["你提交的信息", "申请包含官网、品牌、市场或品类、一个决策问题、选填竞品、姓名、邮箱和同意确认。"],
			["防滥用保护", "为限制短时间内的滥用请求，我们仅将受信任代理提供的客户端 IP 用于粗粒度限流。"],
			["邮件传递", "邮件服务接受申请后，申请会通过邮件发送给 Yonaris 团队。"],
			["信息用途", "我们使用这些信息审核申请、确认可执行范围并回复你。"],
			["浏览器分析", "诊断字段不会加入客户端分析事件，也不会写入 localStorage 或 Cookie。"],
			["问题咨询", "如对诊断申请信息有疑问，请联系 black.dcp@outlook.com。"],
		]);
	});

	it("does not invent legal, retention, security, sale, or deletion promises", () => {
		const serialized = JSON.stringify(getPrivacyContent());
		expect(serialized).not.toMatch(
			/retention period|retain for|GDPR|legal basis|jurisdiction|\bDPO\b|encrypted|encryption guarantee|never sell|never share|deletion SLA|delete within|保留期限|保留.*天|法律依据|司法管辖|数据保护官|加密保证|绝不出售|绝不共享|删除时限/i,
		);
	});
});
