import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/content/site";
import {
	type DiagnosticRequestIdentity,
	resolveDiagnosticRequestIdentity,
	submitDiagnosticRequest,
} from "@/lib/diagnostic-client";
import { type DiagnosticLead, parseDiagnosticLead } from "@/lib/diagnostic-schema";

type SubmissionState = "idle" | "submitting" | "unconfirmed" | "success";

interface LeadValues {
	name: string;
	contact: string;
	company: string;
	companyUrl: string;
}

const copy = {
	en: {
		label: "Diagnostic request",
		title: "Tell us where to reach you.",
		summary: "Three details are enough to begin. We will review the request before any observation starts.",
		name: "Name",
		contact: "Work email",
		company: "Company",
		namePlaceholder: "Your name",
		contactPlaceholder: "you@company.com",
		companyPlaceholder: "Company name",
		submit: "Submit request",
		submitting: "Submitting…",
		retry: "Try again",
		error: "Check the three fields and try again.",
		failure: "We could not confirm delivery. Your entries remain here; please try again.",
		successTitle: "Request received.",
		successBody: "Yonaris will review the request and contact you at the work email provided.",
		disclosure: "By submitting, you allow Yonaris to use these details to review your request and contact you.",
		privacy: "How we handle request data",
	},
	zh: {
		label: "需求沟通",
		title: "留下联系方式，我们来和你一起判断下一步。",
		summary: "只需要三项信息。收到后，我们会先了解你的问题，不会自动生成扫描或报告。",
		name: "姓名",
		contact: "电话",
		company: "公司",
		namePlaceholder: "你的姓名",
		contactPlaceholder: "手机号或联系电话",
		companyPlaceholder: "公司名称",
		submit: "提交需求",
		submitting: "正在提交…",
		retry: "重试",
		error: "请检查姓名、电话和公司后重试。",
		failure: "暂时无法确认是否送达。你填写的信息仍保留在本页，请重试。",
		successTitle: "需求已收到",
		successBody: "我们会先了解你的实际问题，再通过所留电话与你沟通。",
		disclosure: "提交后，我们会通过你留下的联系方式沟通需求，并仅将这些信息用于本次联系。",
		privacy: "查看信息处理说明",
	},
} as const;

function toLead(values: LeadValues, locale: Locale): unknown {
	const base = { locale, name: values.name, company: values.company, companyUrl: values.companyUrl };
	return locale === "en" ? { ...base, email: values.contact } : { ...base, phone: values.contact };
}

export function DiagnosticForm({ locale }: { locale: Locale; initialWebsite?: string }) {
	const labels = copy[locale];
	const [values, setValues] = useState<LeadValues>({ name: "", contact: "", company: "", companyUrl: "" });
	const [submission, setSubmission] = useState<SubmissionState>("idle");
	const [validationFailed, setValidationFailed] = useState(false);
	const valuesRef = useRef(values);
	const identityRef = useRef<DiagnosticRequestIdentity | null>(null);
	const controllerRef = useRef<AbortController | null>(null);

	useEffect(() => () => controllerRef.current?.abort(), []);

	function update(field: keyof LeadValues, value: string): void {
		const next = { ...valuesRef.current, [field]: value };
		valuesRef.current = next;
		setValues(next);
		setValidationFailed(false);
		if (submission === "unconfirmed") setSubmission("idle");
	}

	async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (submission === "submitting") return;
		const parsed = parseDiagnosticLead(toLead(valuesRef.current, locale));
		if (!parsed.success) {
			setValidationFailed(true);
			return;
		}

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
		if (result.status === "confirmed") {
			identityRef.current = null;
			setSubmission("success");
		} else {
			setSubmission("unconfirmed");
		}
	}

	if (submission === "success") {
		return (
			<section className="diagnostic-confirmation" role="status" aria-live="polite" data-diagnostic-state="success">
				<p>{labels.label}</p>
				<h2>{labels.successTitle}</h2>
				<p>{labels.successBody}</p>
			</section>
		);
	}

	return (
		<form
			className="diagnostic-form diagnostic-form--compact"
			onSubmit={submit}
			noValidate
			data-diagnostic-state={submission}
		>
			<header className="diagnostic-form__heading">
				<p>{labels.label}</p>
				<h2>{labels.title}</h2>
				<p>{labels.summary}</p>
			</header>
			<fieldset className="diagnostic-fields">
				<legend className="sr-only">{labels.label}</legend>
				<label className="diagnostic-field" htmlFor={`diagnostic-${locale}-name`}>
					<span>{labels.name}</span>
					<input
						id={`diagnostic-${locale}-name`}
						name="name"
						value={values.name}
						maxLength={120}
						required
						placeholder={labels.namePlaceholder}
						autoComplete="name"
						onChange={(event) => update("name", event.currentTarget.value)}
					/>
				</label>
				<label className="diagnostic-field" htmlFor={`diagnostic-${locale}-contact`}>
					<span>{labels.contact}</span>
					<input
						id={`diagnostic-${locale}-contact`}
						name={locale === "en" ? "email" : "phone"}
						type={locale === "en" ? "email" : "tel"}
						value={values.contact}
						maxLength={locale === "en" ? 254 : 32}
						required
						placeholder={labels.contactPlaceholder}
						autoComplete={locale === "en" ? "email" : "tel"}
						onChange={(event) => update("contact", event.currentTarget.value)}
					/>
				</label>
				<label className="diagnostic-field" htmlFor={`diagnostic-${locale}-company`}>
					<span>{labels.company}</span>
					<input
						id={`diagnostic-${locale}-company`}
						name="company"
						value={values.company}
						maxLength={160}
						required
						placeholder={labels.companyPlaceholder}
						autoComplete="organization"
						onChange={(event) => update("company", event.currentTarget.value)}
					/>
				</label>
			</fieldset>
			<div className="diagnostic-honeypot" aria-hidden="true">
				<label htmlFor={`diagnostic-${locale}-company-url`}>Company URL</label>
				<input
					id={`diagnostic-${locale}-company-url`}
					name="companyUrl"
					value={values.companyUrl}
					tabIndex={-1}
					autoComplete="off"
					onChange={(event) => update("companyUrl", event.currentTarget.value)}
				/>
			</div>
			{validationFailed ? (
				<p className="diagnostic-validation" role="alert">
					{labels.error}
				</p>
			) : null}
			{submission === "unconfirmed" ? (
				<p className="diagnostic-failure" role="alert">
					{labels.failure}
				</p>
			) : null}
			<button
				className="diagnostic-action diagnostic-action--primary"
				type="submit"
				disabled={submission === "submitting"}
			>
				{submission === "submitting" ? labels.submitting : submission === "unconfirmed" ? labels.retry : labels.submit}
			</button>
			<p className="diagnostic-disclosure">
				{labels.disclosure} <a href={locale === "zh" ? "/zh/privacy" : "/privacy"}>{labels.privacy}</a>
			</p>
		</form>
	);
}
