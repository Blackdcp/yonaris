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

function renderView(props: Omit<LeadFormViewProps, "onUpdate" | "onSubmit">): string {
	expect(subject.LeadFormView, "共享表单视图必须可回归测试").toBeDefined();
	if (!subject.LeadFormView) return "";
	return renderToStaticMarkup(<subject.LeadFormView {...props} onUpdate={noopUpdate} onSubmit={noopSubmit} />);
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
		expect(markup).toContain("Request accepted for delivery.");
		expect(markup).toContain("This does not confirm inbox delivery.");
		expect(markup).not.toContain("<form");
		expect(markup).not.toContain('type="submit"');
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
		expect(markup).toContain("Delivery is not confirmed.");
		expect(markup).toContain('href="mailto:black.dcp@outlook.com"');
		expect(markup).not.toContain("Request accepted for delivery.");
	});

	it("gives an honest Chinese email fallback when delivery is unconfirmed", () => {
		const markup = renderView({ locale: "zh", values, submission: "unconfirmed", errors: {} });
		expect(markup).toContain("投递尚未确认");
		expect(markup).toContain('href="mailto:black.dcp@outlook.com"');
		expect(markup).not.toContain("投递服务已接受这次申请");
	});
});
