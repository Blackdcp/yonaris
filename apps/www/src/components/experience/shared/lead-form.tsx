import { useEffect, useRef, useState } from "react";
import {
	type DiagnosticRequestIdentity,
	type DiagnosticRequestResult,
	resolveDiagnosticRequestIdentity,
	submitDiagnosticRequest,
} from "@/lib/diagnostic-client";
import { type DiagnosticLead, parseDiagnosticLead } from "@/lib/diagnostic-schema";

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
		title: "Where should we reach you?",
		summary: "Share three details to request a scope-setting conversation about your brand and market.",
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
		failure: "Delivery is not confirmed. Your details are still here—please try again.",
		fallback: "The email link opens a draft; nothing is sent until you send it.",
		successTitle: "Request accepted for delivery.",
		successBody: "The delivery service accepted the request. This does not confirm inbox delivery.",
		disclosure: "We’ll use these details only to respond to your request.",
		privacy: "Privacy",
	},
	zh: {
		label: "预约沟通",
		title: "留下联系方式，先确认摸底范围",
		summary: "只填三项，用于申请一次围绕业务和目标市场的范围沟通。",
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
		failure: "投递尚未确认。你填写的内容还在，请重试。",
		fallback: "邮件链接只会打开草稿；在你主动发送前，不会发出任何内容。",
		successTitle: "投递服务已接受这次申请",
		successBody: "这表示服务方已接受请求，不代表邮件已经进入收件箱。",
		disclosure: "这些信息只用于本次需求沟通。",
		privacy: "隐私说明",
	},
} as const;

const visibleFieldOrder = ["name", "contact", "company"] as const;

function toLead(values: LeadValues, locale: LeadLocale): unknown {
	const base = { locale, name: values.name, company: values.company, companyUrl: values.companyUrl };
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
	values,
	submission,
	errors,
	validationFailed = false,
	fieldRefs,
	onUpdate,
	onSubmit,
}: LeadFormViewProps) {
	const labels = copy[locale];
	if (submission === "success") {
		return (
			<section className="lead-confirmation" role="status" aria-live="polite" data-lead-state="success">
				<span>{labels.label}</span>
				<h2>{labels.successTitle}</h2>
				<p>{labels.successBody}</p>
			</section>
		);
	}

	const nameErrorId = `lead-${locale}-name-error`;
	const contactErrorId = `lead-${locale}-contact-error`;
	const companyErrorId = `lead-${locale}-company-error`;

	return (
		<form
			className={`lead-form${compact ? " lead-form--compact" : ""}`}
			onSubmit={onSubmit}
			noValidate
			data-lead-state={submission}
		>
			<header>
				<span>{labels.label}</span>
				<h2>{labels.title}</h2>
				<p>{labels.summary}</p>
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
					{labels.failure} <a href="mailto:black.dcp@outlook.com">black.dcp@outlook.com</a>. {labels.fallback}
				</p>
			) : null}
			<button type="submit" disabled={submission === "submitting"}>
				{submission === "submitting" ? labels.submitting : submission === "unconfirmed" ? labels.retry : labels.submit}
			</button>
			<p className="lead-disclosure">
				{labels.disclosure} <a href={locale === "zh" ? "/zh/privacy" : "/privacy"}>{labels.privacy}</a>
			</p>
		</form>
	);
}

export function LeadForm({ locale, compact = false }: { locale: LeadLocale; compact?: boolean }) {
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

		const parsed = parseDiagnosticLead(toLead(valuesRef.current, locale));
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
