import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { submitDiagnosticRequest } from "@/lib/diagnostic-client";
import type { DiagnosticLead } from "@/lib/diagnostic-schema";

type LeadField = "name" | "contact" | "company";
type LeadValues = { name: string; contact: string; company: string; companyUrl: string };
type FieldErrors = Partial<Record<LeadField, string>>;
type SubmissionState = "idle" | "submitting" | "unconfirmed" | "success";

type LeadFormViewProps = {
	locale: "en" | "zh";
	compact?: boolean;
	requestType: "consultation" | "privacy";
	values: LeadValues;
	submission: SubmissionState;
	errors: FieldErrors;
	validationFailed?: boolean;
	onUpdate: (field: keyof LeadValues, value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

type Subject = {
	LeadFormView?: React.ComponentType<LeadFormViewProps>;
	validateLeadValues?: (values: LeadValues, locale: "en" | "zh") => FieldErrors;
	focusFirstInvalidField?: (
		errors: FieldErrors,
		fields: Partial<Record<LeadField, { focus: () => void } | null>>,
	) => LeadField | null;
	submissionStateFromResult?: (result: { status: "confirmed" } | { status: "unconfirmed" }) => SubmissionState;
};

const subject = (await import("./lead-form")) as Subject;
const noopUpdate = () => undefined;
const noopSubmit = (event: React.FormEvent<HTMLFormElement>) => event.preventDefault();

function renderView(
	props: Omit<LeadFormViewProps, "onUpdate" | "onSubmit" | "requestType"> & {
		requestType?: LeadFormViewProps["requestType"];
	},
): string {
	expect(subject.LeadFormView, "共享表单视图必须可回归测试").toBeDefined();
	if (!subject.LeadFormView) return "";
	return renderToStaticMarkup(
		<subject.LeadFormView
			{...props}
			requestType={props.requestType ?? "consultation"}
			onUpdate={noopUpdate}
			onSubmit={noopSubmit}
		/>,
	);
}

describe("LeadForm field feedback", () => {
	it("associates each global field with a natural inline error", () => {
		expect(subject.validateLeadValues).toBeDefined();
		if (!subject.validateLeadValues) return;
		const values = { name: "", contact: "not-an-email", company: "", companyUrl: "" };
		const errors = subject.validateLeadValues(values, "en");
		expect(errors).toEqual({
			name: "Enter your name.",
			contact: "Enter a valid work email.",
			company: "Enter your company name.",
		});

		const markup = renderView({ locale: "en", values, submission: "idle", errors });
		for (const field of ["name", "contact", "company"] as const) {
			expect(markup).toContain(`aria-invalid="true" aria-describedby="lead-en-${field}-error"`);
			expect(markup).toContain(`id="lead-en-${field}-error"`);
		}
	});

	it("gives the China phone field its own empty and format guidance", () => {
		expect(subject.validateLeadValues).toBeDefined();
		if (!subject.validateLeadValues) return;
		expect(
			subject.validateLeadValues({ name: "陈晓", contact: "", company: "示例科技", companyUrl: "" }, "zh"),
		).toEqual({ contact: "请填写联系电话。" });
		expect(
			subject.validateLeadValues({ name: "陈晓", contact: "abc", company: "示例科技", companyUrl: "" }, "zh"),
		).toEqual({ contact: "请填写有效的联系电话。" });
	});

	it("focuses the first invalid field in visible form order", () => {
		expect(subject.focusFirstInvalidField).toBeDefined();
		if (!subject.focusFirstInvalidField) return;
		const focused: LeadField[] = [];
		const first = subject.focusFirstInvalidField(
			{ name: "missing", company: "missing" },
			{
				name: { focus: () => focused.push("name") },
				contact: { focus: () => focused.push("contact") },
				company: { focus: () => focused.push("company") },
			},
		);
		expect(first).toBe("name");
		expect(focused).toEqual(["name"]);
	});
});

describe("LeadForm delivery states", () => {
	const lead: DiagnosticLead = {
		locale: "en",
		name: "Ava Chen",
		email: "ava@acme.example",
		company: "Acme",
		companyUrl: "",
		requestType: "consultation",
	};
	const values = { name: "Ava Chen", contact: "ava@acme.example", company: "Acme", companyUrl: "" };

	it("replaces the form with one confirmation after an accepted 202 response", async () => {
		expect(subject.submissionStateFromResult).toBeDefined();
		if (!subject.submissionStateFromResult) return;
		const result = await submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", {
			fetchImpl: async () => new Response('{"ok":true}', { status: 202 }),
		});
		const submission = subject.submissionStateFromResult(result);
		const markup = renderView({ locale: "en", values, submission, errors: {} });
		expect(submission).toBe("success");
		expect(markup).toContain('data-lead-state="success"');
		expect(markup).toContain("Thanks. We received your request and will be in touch.");
		expect(markup).not.toMatch(/delivery service|inbox delivery/i);
		expect(markup).not.toContain("<form");
		expect(markup).not.toContain('type="submit"');
	});

	it("uses the concise Chinese confirmation only after a confirmed result", () => {
		expect(subject.submissionStateFromResult).toBeDefined();
		if (!subject.submissionStateFromResult) return;
		const submission = subject.submissionStateFromResult({ status: "confirmed" });
		const markup = renderView({ locale: "zh", values, submission, errors: {} });
		expect(markup).toContain("已收到，我们会尽快联系你。");
		expect(markup).not.toMatch(/投递服务|收件箱/);
		expect(markup).not.toContain("<form");
	});

	it("keeps entered values and a retry action after a 503 response", async () => {
		expect(subject.submissionStateFromResult).toBeDefined();
		if (!subject.submissionStateFromResult) return;
		const result = await submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", {
			fetchImpl: async () => new Response('{"ok":false}', { status: 503 }),
		});
		const submission = subject.submissionStateFromResult(result);
		const markup = renderView({ locale: "en", values, submission, errors: {} });
		expect(submission).toBe("unconfirmed");
		expect(markup).toContain('data-lead-state="unconfirmed"');
		expect(markup).toContain('value="ava@acme.example"');
		expect(markup).toContain("Try again");
		expect(markup).toContain("We couldn’t send that yet. Your details are still here—please try again.");
		expect(markup).not.toContain("mailto:");
		expect(markup).not.toMatch(/[↗→]/);
		expect(markup).not.toContain("Thanks. We received your request");
	});

	it("keeps Chinese failure feedback simple and preserves the retry form", () => {
		const markup = renderView({ locale: "zh", values, submission: "unconfirmed", errors: {} });
		expect(markup).toContain("暂时没能发送。你填写的内容还在，请重试。");
		expect(markup).toContain("重新发送");
		expect(markup).not.toContain("mailto:");
		expect(markup).not.toMatch(/投递服务|收件箱/);
	});

	it.each([
		{
			locale: "en" as const,
			phrases: ["frame one market question", "observed and evidenced", "one useful next action"],
		},
		{
			locale: "zh" as const,
			phrases: ["最怕 AI 答错的客户问题", "能否被观测", "一个有用的下一步"],
		},
	])("explains the first $locale consultation without adding a visible field", ({ locale, phrases }) => {
		const markup = renderView({
			locale,
			values: { name: "", contact: "", company: "", companyUrl: "" },
			submission: "idle",
			errors: {},
		});
		for (const phrase of phrases) expect(markup).toContain(phrase);
		expect(markup.match(/data-lead-field=/g) ?? []).toHaveLength(3);
	});
});

describe("LeadForm privacy intent", () => {
	it("keeps privacy request metadata hidden without adding visible fields", () => {
		const markup = renderView({
			locale: "en",
			requestType: "privacy",
			values: { name: "", contact: "", company: "", companyUrl: "" },
			submission: "idle",
			errors: {},
		});
		expect(markup.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(markup).toContain('type="hidden" name="requestType" value="privacy"');
	});

	it.each([
		{
			locale: "en" as const,
			title: "Ask Yonaris to review your contact records.",
			summary:
				"Use the same name, work email and company as your earlier request so we can identify it for manual review.",
			submit: "Submit privacy request",
			disclosure: "This form starts a manual privacy review. It does not automatically delete records.",
			successTitle: "Your privacy request is ready for manual review.",
			successBody:
				"We’ll use the details you provided to identify the earlier request and follow up through that contact channel.",
			consultationPhrase: "buying decision",
		},
		{
			locale: "zh" as const,
			title: "请 Yonaris 核对你的联系记录。",
			summary: "请填写与此前申请相同的姓名、电话和公司，方便人工识别并核对对应记录。",
			submit: "提交隐私请求",
			disclosure: "此表单会启动人工隐私核对，不会自动删除记录。",
			successTitle: "隐私请求已收到，将由 Yonaris 人工核对。",
			successBody: "我们会用你填写的联系方式识别此前申请，并通过该渠道跟进。",
			consultationPhrase: "预约沟通",
		},
	])("renders a visible and accessible $locale privacy purpose through confirmation", (fixture) => {
		const idle = renderView({
			locale: fixture.locale,
			requestType: "privacy",
			values: { name: "", contact: "", company: "", companyUrl: "" },
			submission: "idle",
			errors: {},
		});
		expect(idle).toContain(`aria-labelledby="lead-${fixture.locale}-purpose-title"`);
		expect(idle).toContain(
			`aria-describedby="lead-${fixture.locale}-purpose-summary lead-${fixture.locale}-purpose-disclosure"`,
		);
		for (const text of [fixture.title, fixture.summary, fixture.submit, fixture.disclosure])
			expect(idle).toContain(text);
		expect(idle.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(idle).toContain('type="hidden" name="requestType" value="privacy"');
		expect(idle).not.toContain(fixture.consultationPhrase);
		expect(idle).not.toContain("frame one market question");
		expect(idle).not.toContain("最怕 AI 答错的客户问题");

		const success = renderView({
			locale: fixture.locale,
			requestType: "privacy",
			values: { name: "", contact: "", company: "", companyUrl: "" },
			submission: "success",
			errors: {},
		});
		expect(success).toContain(`aria-labelledby="lead-${fixture.locale}-success-title"`);
		expect(success).toContain(`aria-describedby="lead-${fixture.locale}-success-body"`);
		expect(success).toContain(fixture.successTitle);
		expect(success).toContain(fixture.successBody);
		expect(success).not.toContain(fixture.consultationPhrase);
	});
});
