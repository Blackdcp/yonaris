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
	requestTypeFromSearch?: (search: string) => "consultation" | "privacy";
	diagnosticLeadInputFromSearch?: (values: LeadValues, locale: "en" | "zh", search: string) => unknown;
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
});

describe("LeadForm privacy intent", () => {
	it("allowlists only the exact privacy query intent and keeps three visible fields", () => {
		expect(subject.requestTypeFromSearch).toBeDefined();
		if (!subject.requestTypeFromSearch) return;
		expect(subject.requestTypeFromSearch("?intent=privacy")).toBe("privacy");
		for (const search of ["", "?intent=deletion", "?intent=privacy%20", "?intent=PRIVACY", "?other=privacy"])
			expect(subject.requestTypeFromSearch(search), search).toBe("consultation");
		expect(subject.diagnosticLeadInputFromSearch).toBeDefined();
		expect(
			subject.diagnosticLeadInputFromSearch?.(
				{ name: "Ava", contact: "ava@example.com", company: "Acme", companyUrl: "" },
				"en",
				"?intent=privacy",
			),
		).toMatchObject({ requestType: "privacy", email: "ava@example.com" });

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
});
