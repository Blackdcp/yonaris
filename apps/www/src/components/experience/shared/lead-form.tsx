import { useEffect, useRef, useState } from "react";
import {
	type DiagnosticRequestIdentity,
	type DiagnosticRequestResult,
	resolveDiagnosticRequestIdentity,
	submitDiagnosticRequest,
} from "@/lib/diagnostic-client";
import { type DiagnosticLead, type DiagnosticRequestType, parseDiagnosticLead } from "@/lib/diagnostic-schema";

export type LeadLocale = "en" | "zh";
export type LeadField = "name" | "contact" | "company";
export type SubmissionState = "idle" | "submitting" | "unconfirmed" | "success";

export interface LeadValues {
	name: string;
	contact: string;
	company: string;
	companyUrl: string;
}

export type FieldErrors = Partial<Record<LeadField, string>>;
type FocusTarget = Pick<HTMLInputElement, "focus">;
type FieldTargets = Partial<Record<LeadField, FocusTarget | null>>;
type FieldRefs = { current: Record<LeadField, HTMLInputElement | null> };

const copy = {
	en: {
		label: "Start a conversation",
		title: "Tell us where we should reach you.",
		summary:
			"The first conversation will frame one market question, determine whether it can be observed and evidenced, and identify one useful next action.",
		name: "Name",
		contact: "Work email",
		company: "Company",
		namePlaceholder: "Your name",
		contactPlaceholder: "you@company.com",
		companyPlaceholder: "Company name",
		nameRequired: "Enter your name.",
		nameInvalid: "Enter a shorter name.",
		contactRequired: "Enter your work email.",
		contactInvalid: "Enter a valid work email.",
		companyRequired: "Enter your company name.",
		companyInvalid: "Enter a shorter company name.",
		submit: "Talk to Yonaris",
		submitting: "Sending…",
		retry: "Try again",
		validation: "Please check the highlighted field.",
		failure: "We couldn’t send that yet. Your details are still here—please try again.",
		successTitle: "Thanks. We received your request and will be in touch.",
		successBody: "We’ll follow up using the details you provided.",
		disclosure: "We’ll use these details only to respond to your request.",
		privacy: "Privacy",
	},
	zh: {
		label: "预约沟通",
		title: "怎么联系你？",
		summary: "第一次沟通会从团队最怕 AI 答错的客户问题开始，判断它能否被观测、能否找到证据，并确定一个有用的下一步。",
		name: "姓名",
		contact: "电话",
		company: "公司",
		namePlaceholder: "怎么称呼你",
		contactPlaceholder: "手机号或联系电话",
		companyPlaceholder: "公司名称",
		nameRequired: "请填写姓名。",
		nameInvalid: "姓名过长，请缩短后重试。",
		contactRequired: "请填写联系电话。",
		contactInvalid: "请填写有效的联系电话。",
		companyRequired: "请填写公司名称。",
		companyInvalid: "公司名称过长，请缩短后重试。",
		submit: "提交并预约沟通",
		submitting: "正在发送…",
		retry: "重新发送",
		validation: "请检查标出的字段。",
		failure: "暂时没能发送。你填写的内容还在，请重试。",
		successTitle: "已收到，我们会尽快联系你。",
		successBody: "我们会使用你填写的联系方式跟进。",
		disclosure: "这些信息只用于本次需求沟通。",
		privacy: "隐私说明",
	},
} as const;

const privacyCopy = {
	en: {
		...copy.en,
		label: "Privacy request",
		title: "Ask Yonaris to review your contact records.",
		summary:
			"Use the same name, work email and company as your earlier request so we can identify it for manual review.",
		submit: "Submit privacy request",
		submitting: "Sending privacy request…",
		successTitle: "Your privacy request is ready for manual review.",
		successBody:
			"We’ll use the details you provided to identify the earlier request and follow up through that contact channel.",
		disclosure: "This form starts a manual privacy review. It does not automatically delete records.",
	},
	zh: {
		...copy.zh,
		label: "隐私请求",
		title: "请 Yonaris 核对你的联系记录。",
		summary: "请填写与此前申请相同的姓名、电话和公司，方便人工识别并核对对应记录。",
		submit: "提交隐私请求",
		submitting: "正在提交隐私请求…",
		successTitle: "隐私请求已收到，将由 Yonaris 人工核对。",
		successBody: "我们会用你填写的联系方式识别此前申请，并通过该渠道跟进。",
		disclosure: "此表单会启动人工隐私核对，不会自动删除记录。",
	},
} as const;

const visibleFieldOrder = ["name", "contact", "company"] as const;

function toLead(values: LeadValues, locale: LeadLocale, requestType: DiagnosticRequestType = "consultation"): unknown {
	const base = { locale, name: values.name, company: values.company, companyUrl: values.companyUrl, requestType };
	return locale === "en" ? { ...base, email: values.contact } : { ...base, phone: values.contact };
}

export function validateLeadValues(values: LeadValues, locale: LeadLocale): FieldErrors {
	const parsed = parseDiagnosticLead(toLead(values, locale));
	if (parsed.success) return {};

	const labels = copy[locale];
	const errors: FieldErrors = {};
	for (const issue of parsed.error.issues) {
		const field = issue.path[0];
		if (field === "name" && !errors.name) {
			errors.name = values.name.trim() ? labels.nameInvalid : labels.nameRequired;
		}
		if ((field === "email" || field === "phone") && !errors.contact) {
			errors.contact = values.contact.trim() ? labels.contactInvalid : labels.contactRequired;
		}
		if (field === "company" && !errors.company) {
			errors.company = values.company.trim() ? labels.companyInvalid : labels.companyRequired;
		}
	}
	return errors;
}

export function focusFirstInvalidField(errors: FieldErrors, fields: FieldTargets): LeadField | null {
	const first = visibleFieldOrder.find((field) => Boolean(errors[field])) ?? null;
	if (first) fields[first]?.focus();
	return first;
}

export function submissionStateFromResult(result: DiagnosticRequestResult): SubmissionState {
	return result.status === "confirmed" ? "success" : "unconfirmed";
}

export interface LeadFormViewProps {
	locale: LeadLocale;
	compact?: boolean;
	requestType: DiagnosticRequestType;
	values: LeadValues;
	submission: SubmissionState;
	errors: FieldErrors;
	validationFailed?: boolean;
	fieldRefs?: FieldRefs;
	onUpdate: (field: keyof LeadValues, value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function LeadFormView({
	locale,
	compact = false,
	requestType,
	values,
	submission,
	errors,
	validationFailed = false,
	fieldRefs,
	onUpdate,
	onSubmit,
}: LeadFormViewProps) {
	const labels = requestType === "privacy" ? privacyCopy[locale] : copy[locale];
	if (submission === "success") {
		const successTitleId = `lead-${locale}-success-title`;
		const successBodyId = `lead-${locale}-success-body`;
		return (
			<section
				className="lead-confirmation"
				role="status"
				aria-live="polite"
				aria-labelledby={successTitleId}
				aria-describedby={successBodyId}
				data-lead-state="success"
			>
				<span>{labels.label}</span>
				<h2 id={successTitleId}>{labels.successTitle}</h2>
				<p id={successBodyId}>{labels.successBody}</p>
			</section>
		);
	}

	const purposeTitleId = `lead-${locale}-purpose-title`;
	const purposeSummaryId = `lead-${locale}-purpose-summary`;
	const purposeDisclosureId = `lead-${locale}-purpose-disclosure`;
	const nameErrorId = `lead-${locale}-name-error`;
	const contactErrorId = `lead-${locale}-contact-error`;
	const companyErrorId = `lead-${locale}-company-error`;

	return (
		<form
			className={`lead-form${compact ? " lead-form--compact" : ""}`}
			onSubmit={onSubmit}
			noValidate
			data-lead-state={submission}
			aria-labelledby={purposeTitleId}
			aria-describedby={`${purposeSummaryId} ${purposeDisclosureId}`}
		>
			<header>
				<span>{labels.label}</span>
				<h2 id={purposeTitleId}>{labels.title}</h2>
				<p id={purposeSummaryId}>{labels.summary}</p>
			</header>
			<fieldset>
				<legend className="sr-only">{labels.label}</legend>
				<div data-lead-field="name">
					<label htmlFor={`lead-${locale}-name`}>
						<span>{labels.name}</span>
					</label>
					<input
						ref={(node) => {
							if (fieldRefs) fieldRefs.current.name = node;
						}}
						id={`lead-${locale}-name`}
						name="name"
						value={values.name}
						maxLength={120}
						required
						aria-invalid={errors.name ? true : undefined}
						aria-describedby={errors.name ? nameErrorId : undefined}
						placeholder={labels.namePlaceholder}
						autoComplete="name"
						onChange={(event) => onUpdate("name", event.currentTarget.value)}
					/>
					{errors.name ? (
						<p id={nameErrorId} className="lead-field-message">
							{errors.name}
						</p>
					) : null}
				</div>
				<div data-lead-field="contact">
					<label htmlFor={`lead-${locale}-contact`}>
						<span>{labels.contact}</span>
					</label>
					<input
						ref={(node) => {
							if (fieldRefs) fieldRefs.current.contact = node;
						}}
						id={`lead-${locale}-contact`}
						name={locale === "en" ? "email" : "phone"}
						type={locale === "en" ? "email" : "tel"}
						value={values.contact}
						maxLength={locale === "en" ? 254 : 32}
						required
						aria-invalid={errors.contact ? true : undefined}
						aria-describedby={errors.contact ? contactErrorId : undefined}
						placeholder={labels.contactPlaceholder}
						autoComplete={locale === "en" ? "email" : "tel"}
						onChange={(event) => onUpdate("contact", event.currentTarget.value)}
					/>
					{errors.contact ? (
						<p id={contactErrorId} className="lead-field-message">
							{errors.contact}
						</p>
					) : null}
				</div>
				<div data-lead-field="company">
					<label htmlFor={`lead-${locale}-company`}>
						<span>{labels.company}</span>
					</label>
					<input
						ref={(node) => {
							if (fieldRefs) fieldRefs.current.company = node;
						}}
						id={`lead-${locale}-company`}
						name="company"
						value={values.company}
						maxLength={160}
						required
						aria-invalid={errors.company ? true : undefined}
						aria-describedby={errors.company ? companyErrorId : undefined}
						placeholder={labels.companyPlaceholder}
						autoComplete="organization"
						onChange={(event) => onUpdate("company", event.currentTarget.value)}
					/>
					{errors.company ? (
						<p id={companyErrorId} className="lead-field-message">
							{errors.company}
						</p>
					) : null}
				</div>
			</fieldset>
			<input type="hidden" name="requestType" value={requestType} />
			<div className="lead-trap" aria-hidden="true">
				<label htmlFor={`lead-${locale}-url`}>Website</label>
				<input
					id={`lead-${locale}-url`}
					name="companyUrl"
					value={values.companyUrl}
					tabIndex={-1}
					autoComplete="off"
					onChange={(event) => onUpdate("companyUrl", event.currentTarget.value)}
				/>
			</div>
			{validationFailed ? (
				<p className="lead-message" role="alert">
					{labels.validation}
				</p>
			) : null}
			{submission === "unconfirmed" ? (
				<p className="lead-message" role="alert">
					{labels.failure}
				</p>
			) : null}
			<button type="submit" disabled={submission === "submitting"}>
				{submission === "submitting" ? labels.submitting : submission === "unconfirmed" ? labels.retry : labels.submit}
			</button>
			<p className="lead-disclosure" id={purposeDisclosureId}>
				{labels.disclosure} <a href={locale === "zh" ? "/zh/privacy" : "/privacy"}>{labels.privacy}</a>
			</p>
		</form>
	);
}

export function LeadForm({
	locale,
	compact = false,
	requestType = "consultation",
}: {
	locale: LeadLocale;
	compact?: boolean;
	requestType?: DiagnosticRequestType;
}) {
	const [values, setValues] = useState<LeadValues>({ name: "", contact: "", company: "", companyUrl: "" });
	const [submission, setSubmission] = useState<SubmissionState>("idle");
	const [errors, setErrors] = useState<FieldErrors>({});
	const [validationFailed, setValidationFailed] = useState(false);
	const valuesRef = useRef(values);
	const fieldRefs = useRef<Record<LeadField, HTMLInputElement | null>>({ name: null, contact: null, company: null });
	const identityRef = useRef<DiagnosticRequestIdentity | null>(null);
	const controllerRef = useRef<AbortController | null>(null);

	useEffect(() => () => controllerRef.current?.abort(), []);

	function update(field: keyof LeadValues, value: string): void {
		const next = { ...valuesRef.current, [field]: value };
		valuesRef.current = next;
		setValues(next);
		setValidationFailed(false);
		if (field !== "companyUrl") {
			setErrors((current) => {
				if (!current[field]) return current;
				const remaining = { ...current };
				delete remaining[field];
				return remaining;
			});
		}
		if (submission === "unconfirmed") setSubmission("idle");
	}

	async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (submission === "submitting" || submission === "success") return;

		const nextErrors = validateLeadValues(valuesRef.current, locale);
		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors);
			setValidationFailed(false);
			focusFirstInvalidField(nextErrors, fieldRefs.current);
			return;
		}

		const parsed = parseDiagnosticLead(toLead(valuesRef.current, locale, requestType));
		if (!parsed.success) {
			setValidationFailed(true);
			return;
		}

		setErrors({});
		const identity = resolveDiagnosticRequestIdentity(identityRef.current, parsed.data);
		if (!identity) return;
		identityRef.current = identity;
		const controller = new AbortController();
		controllerRef.current?.abort();
		controllerRef.current = controller;
		setSubmission("submitting");
		const result = await submitDiagnosticRequest(parsed.data as DiagnosticLead, identity.idempotencyKey, {
			signal: controller.signal,
		});
		if (controllerRef.current !== controller) return;
		controllerRef.current = null;
		const nextSubmission = submissionStateFromResult(result);
		if (nextSubmission === "success") identityRef.current = null;
		setSubmission(nextSubmission);
	}

	return (
		<LeadFormView
			locale={locale}
			compact={compact}
			requestType={requestType}
			values={values}
			submission={submission}
			errors={errors}
			validationFailed={validationFailed}
			fieldRefs={fieldRefs}
			onUpdate={update}
			onSubmit={submit}
		/>
	);
}
