import { useEffect, useRef, useState } from "react";
import {
	type DiagnosticRequestIdentity,
	resolveDiagnosticRequestIdentity,
	submitDiagnosticRequest,
} from "@/lib/diagnostic-client";
import { type DiagnosticLead, parseDiagnosticLead } from "@/lib/diagnostic-schema";

type LeadLocale = "en" | "zh";
type SubmissionState = "idle" | "submitting" | "unconfirmed" | "success";

interface LeadValues {
	name: string;
	contact: string;
	company: string;
	companyUrl: string;
}

const copy = {
	en: {
		label: "Start a conversation",
		title: "Where should we reach you?",
		summary: "Share three details. We’ll come back with a clear first step for your brand and market.",
		name: "Name",
		contact: "Work email",
		company: "Company",
		namePlaceholder: "Your name",
		contactPlaceholder: "you@company.com",
		companyPlaceholder: "Company name",
		submit: "Talk to Yonaris",
		submitting: "Sending…",
		retry: "Try again",
		validation: "Please check all three fields.",
		failure: "We couldn’t send this yet. Your details are still here—please try again.",
		successTitle: "Thanks. We’ll be in touch.",
		successBody: "We’ll contact you at the work email you provided.",
		disclosure: "We’ll use these details only to respond to your request.",
		privacy: "Privacy",
	},
	zh: {
		label: "预约沟通",
		title: "留下联系方式，我们尽快联系你",
		summary: "只填三项。我们会先了解你的业务和目标市场，再给出明确的下一步。",
		name: "姓名",
		contact: "电话",
		company: "公司",
		namePlaceholder: "怎么称呼你",
		contactPlaceholder: "手机号或联系电话",
		companyPlaceholder: "公司名称",
		submit: "提交并预约沟通",
		submitting: "正在发送…",
		retry: "重新发送",
		validation: "请检查姓名、电话和公司。",
		failure: "暂时没有发送成功，你填写的内容还在，请重试。",
		successTitle: "收到，我们会尽快联系你",
		successBody: "我们会通过你留下的电话沟通具体问题。",
		disclosure: "这些信息只用于本次需求沟通。",
		privacy: "隐私说明",
	},
} as const;

function toLead(values: LeadValues, locale: LeadLocale): unknown {
	const base = { locale, name: values.name, company: values.company, companyUrl: values.companyUrl };
	return locale === "en" ? { ...base, email: values.contact } : { ...base, phone: values.contact };
}

export function LeadForm({ locale, compact = false }: { locale: LeadLocale; compact?: boolean }) {
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
			<section className="lead-confirmation" role="status" aria-live="polite" data-lead-state="success">
				<span>{labels.label}</span>
				<h2>{labels.successTitle}</h2>
				<p>{labels.successBody}</p>
			</section>
		);
	}

	return (
		<form
			className={`lead-form${compact ? " lead-form--compact" : ""}`}
			onSubmit={submit}
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
				<label data-lead-field="name" htmlFor={`lead-${locale}-name`}>
					<span>{labels.name}</span>
					<input
						id={`lead-${locale}-name`}
						name="name"
						value={values.name}
						maxLength={120}
						required
						placeholder={labels.namePlaceholder}
						autoComplete="name"
						onChange={(event) => update("name", event.currentTarget.value)}
					/>
				</label>
				<label data-lead-field="contact" htmlFor={`lead-${locale}-contact`}>
					<span>{labels.contact}</span>
					<input
						id={`lead-${locale}-contact`}
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
				<label data-lead-field="company" htmlFor={`lead-${locale}-company`}>
					<span>{labels.company}</span>
					<input
						id={`lead-${locale}-company`}
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
			<div className="lead-trap" aria-hidden="true">
				<label htmlFor={`lead-${locale}-url`}>Website</label>
				<input
					id={`lead-${locale}-url`}
					name="companyUrl"
					value={values.companyUrl}
					tabIndex={-1}
					autoComplete="off"
					onChange={(event) => update("companyUrl", event.currentTarget.value)}
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
				<span aria-hidden="true">↗</span>
			</button>
			<p className="lead-disclosure">
				{labels.disclosure} <a href={locale === "zh" ? "/zh/privacy" : "/privacy"}>{labels.privacy}</a>
			</p>
		</form>
	);
}
