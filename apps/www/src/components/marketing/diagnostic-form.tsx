import { useState } from "react";
import { getDiagnosticContent, type Locale } from "@/content/site";
import {
	buildDiagnosticMailto,
	DIAGNOSTIC_LEAD_FIELDS,
	type DiagnosticLeadField,
	parseDiagnosticLead,
} from "@/lib/diagnostic-schema";

const FORM_FIELD_ORDER = DIAGNOSTIC_LEAD_FIELDS.filter(
	(field): field is Exclude<DiagnosticLeadField, "consent"> => field !== "consent",
);

function inputFromForm(form: HTMLFormElement, locale: Locale) {
	const data = new FormData(form);
	return {
		locale,
		website: String(data.get("website") ?? ""),
		brand: String(data.get("brand") ?? ""),
		market: String(data.get("market") ?? ""),
		question: String(data.get("question") ?? ""),
		competitors: String(data.get("competitors") ?? ""),
		name: String(data.get("name") ?? ""),
		email: String(data.get("email") ?? ""),
		consent: data.get("consent") === "true",
		companyUrl: String(data.get("companyUrl") ?? ""),
	};
}

function issueFields(issues: readonly { path: PropertyKey[] }[]): DiagnosticLeadField[] {
	const paths = new Set(issues.map((issue) => issue.path[0]));
	return DIAGNOSTIC_LEAD_FIELDS.filter((field) => paths.has(field));
}

export function DiagnosticForm({ locale, initialWebsite = "" }: { locale: Locale; initialWebsite?: string }) {
	const content = getDiagnosticContent(locale);
	const copy = content.form;
	const [invalidFields, setInvalidFields] = useState<DiagnosticLeadField[]>([]);
	const [validationFailed, setValidationFailed] = useState(false);

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const result = parseDiagnosticLead(inputFromForm(event.currentTarget, locale));
		if (!result.success) {
			const fields = issueFields(result.error.issues);
			setInvalidFields(fields);
			setValidationFailed(true);
			requestAnimationFrame(() => document.getElementById(`diagnostic-${fields[0]}`)?.focus());
			return;
		}

		setInvalidFields([]);
		setValidationFailed(false);
		const mailto = buildDiagnosticMailto(result.data);
		if (mailto) window.location.href = mailto;
	}

	const inputClass =
		"marketing-paper-focus mt-3 min-h-12 w-full border border-[var(--yonaris-ink)]/18 bg-transparent px-4 text-base text-[var(--yonaris-ink)] outline-none transition-colors placeholder:text-[var(--yonaris-stone)] focus:border-[var(--yonaris-signal)]";

	return (
		<form
			onSubmit={submit}
			noValidate
			className="border-t border-[var(--yonaris-ink)]/18 pt-8"
			aria-describedby="diagnostic-disclosure diagnostic-error"
		>
			<div className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
				{FORM_FIELD_ORDER.map((field) => {
					const fieldCopy = copy.fields[field];
					const required = field !== "competitors";
					const invalid = invalidFields.includes(field);
					const errorId = `diagnostic-${field}-error`;
					const commonProps = {
						id: `diagnostic-${field}`,
						name: field,
						required,
						placeholder: fieldCopy.placeholder,
						"aria-invalid": invalid,
						"aria-describedby": errorId,
					};

					return (
						<label
							key={field}
							htmlFor={`diagnostic-${field}`}
							className={`text-xs font-medium text-[var(--yonaris-slate)] ${field === "question" ? "sm:col-span-2" : ""}`}
						>
							{fieldCopy.label}
							{required ? <span className="ml-1 text-[var(--yonaris-signal)]">*</span> : null}
							{field === "question" ? (
								<textarea {...commonProps} rows={5} className={`${inputClass} resize-y py-3`} />
							) : (
								<input
									{...commonProps}
									type={field === "website" ? "url" : field === "email" ? "email" : "text"}
									defaultValue={field === "website" ? initialWebsite : undefined}
									className={inputClass}
								/>
							)}
							<span id={errorId} className={`mt-2 text-xs leading-5 text-[#9f290f] ${invalid ? "block" : "hidden"}`}>
								{fieldCopy.error}
							</span>
						</label>
					);
				})}
				<div className="sm:col-span-2">
					<label
						htmlFor="diagnostic-consent"
						className="flex items-start gap-3 text-sm leading-6 text-[var(--yonaris-slate)]"
					>
						<input
							id="diagnostic-consent"
							name="consent"
							type="checkbox"
							value="true"
							required
							aria-invalid={invalidFields.includes("consent")}
							aria-describedby="diagnostic-consent-error"
							className="marketing-paper-focus mt-1 size-4 shrink-0 accent-[var(--yonaris-signal)]"
						/>
						<span>{copy.consent.label}</span>
					</label>
					<p className="mt-2 pl-7 text-xs leading-5 text-[var(--yonaris-slate)]/68">
						{copy.consent.privacyLeadIn}{" "}
						<a
							href="/privacy"
							target="_blank"
							rel="noreferrer"
							className="marketing-paper-focus underline decoration-[var(--yonaris-signal)] underline-offset-4"
						>
							{copy.consent.privacyLinkLabel}
						</a>
					</p>
					<p
						id="diagnostic-consent-error"
						className={`mt-2 pl-7 text-xs leading-5 text-[#9f290f] ${invalidFields.includes("consent") ? "block" : "hidden"}`}
					>
						{copy.consent.error}
					</p>
				</div>
				<div hidden aria-hidden="true">
					<label htmlFor="diagnostic-company-url">
						{copy.honeypotLabel}
						<input
							id="diagnostic-company-url"
							name="companyUrl"
							type="text"
							defaultValue=""
							autoComplete="off"
							tabIndex={-1}
						/>
					</label>
				</div>
			</div>
			<p
				id="diagnostic-error"
				role="alert"
				className={`mt-6 text-sm text-[#9f290f] ${validationFailed ? "block" : "hidden"}`}
			>
				{copy.validationSummary}
			</p>
			<div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<button
					type="submit"
					className="marketing-paper-focus inline-flex min-h-12 items-center justify-center gap-3 border border-[var(--yonaris-signal)] bg-[var(--yonaris-signal)] px-5 text-xs font-medium text-[var(--yonaris-ink)] transition-colors hover:border-[var(--yonaris-ink)] hover:bg-[var(--yonaris-ink)] hover:text-[var(--yonaris-paper)]"
				>
					{copy.actions.submit}
					<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="size-3.5">
						<path d="M4 12 12 4M6.5 4H12v5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
					</svg>
				</button>
				<p id="diagnostic-disclosure" className="max-w-md text-xs leading-5 text-[var(--yonaris-slate)]/58">
					{copy.disclosure}
				</p>
			</div>
		</form>
	);
}
