import { useEffect, useRef, useState } from "react";
import { getDiagnosticContent, type Locale } from "@/content/site";
import {
	type DiagnosticRequestIdentity,
	diagnosticLeadFingerprint,
	resolveDiagnosticRequestIdentity,
	submitDiagnosticRequest,
} from "@/lib/diagnostic-client";
import {
	buildDiagnosticMailto,
	DIAGNOSTIC_LEAD_FIELDS,
	type DiagnosticLeadField,
	type DiagnosticStageId,
	parseDiagnosticLead,
	parseDiagnosticScope,
} from "@/lib/diagnostic-schema";

type TextField = Exclude<DiagnosticLeadField, "consent">;
type SubmissionState = "idle" | "submitting" | "unconfirmed";

interface DiagnosticValues {
	website: string;
	brand: string;
	market: string;
	question: string;
	competitors: string;
	name: string;
	email: string;
	consent: boolean;
	companyUrl: string;
}

const TEXT_FIELD_LIMITS: Record<TextField, number> = {
	website: 300,
	brand: 120,
	market: 160,
	question: 2000,
	competitors: 600,
	name: 120,
	email: 254,
};

function initialValues(initialWebsite: string): DiagnosticValues {
	return {
		website: initialWebsite,
		brand: "",
		market: "",
		question: "",
		competitors: "",
		name: "",
		email: "",
		consent: false,
		companyUrl: "",
	};
}

function scopeInput(values: DiagnosticValues) {
	return {
		website: values.website,
		brand: values.brand,
		market: values.market,
		question: values.question,
	};
}

function leadInput(values: DiagnosticValues, locale: Locale) {
	return { locale, ...values };
}

function issueFields(issues: readonly { path: PropertyKey[] }[]): DiagnosticLeadField[] {
	const paths = new Set(issues.map((issue) => issue.path[0]));
	return DIAGNOSTIC_LEAD_FIELDS.filter((field) => paths.has(field));
}

function focusDiagnosticField(field: DiagnosticLeadField | undefined): void {
	if (!field) return;
	requestAnimationFrame(() => document.getElementById(`diagnostic-${field}`)?.focus());
}

function FieldError({ id, visible, copy }: { id: string; visible: boolean; copy: string }) {
	return (
		<p id={id} className="diagnostic-field__error" hidden={!visible}>
			{copy}
		</p>
	);
}

export function DiagnosticForm({ locale, initialWebsite = "" }: { locale: Locale; initialWebsite?: string }) {
	const content = getDiagnosticContent(locale);
	const copy = content.form;
	const [stage, setStage] = useState<DiagnosticStageId | "success">("scope");
	const [submission, setSubmission] = useState<SubmissionState>("idle");
	const [values, setValues] = useState<DiagnosticValues>(() => initialValues(initialWebsite));
	const [invalidFields, setInvalidFields] = useState<DiagnosticLeadField[]>([]);
	const [validationFailed, setValidationFailed] = useState(false);
	const [fallbackMailto, setFallbackMailto] = useState<string | null>(null);
	const valuesRef = useRef(values);
	const identityRef = useRef<DiagnosticRequestIdentity | null>(null);
	const activeRequestRef = useRef<{ controller: AbortController; fingerprint: string; token: number } | null>(null);
	const requestTokenRef = useRef(0);
	const submittingLockRef = useRef(false);
	const failureRef = useRef<HTMLDivElement>(null);
	const previousStageRef = useRef(stage);
	const previousSubmissionRef = useRef(submission);

	useEffect(() => {
		if (previousStageRef.current === stage) return;
		previousStageRef.current = stage;
		const titleId = stage === "success" ? "diagnostic-success-title" : "diagnostic-stage-title";
		document.getElementById(titleId)?.focus();
	}, [stage]);

	useEffect(() => {
		if (previousSubmissionRef.current === submission) return;
		previousSubmissionRef.current = submission;
		if (submission === "unconfirmed") failureRef.current?.focus();
	}, [submission]);

	useEffect(
		() => () => {
			requestTokenRef.current += 1;
			activeRequestRef.current?.controller.abort();
			activeRequestRef.current = null;
			submittingLockRef.current = false;
		},
		[],
	);

	function replaceValues(next: DiagnosticValues, changedField?: DiagnosticLeadField): void {
		valuesRef.current = next;
		setValues(next);
		if (changedField) setInvalidFields((current) => current.filter((field) => field !== changedField));
		setValidationFailed(false);
		if (submission === "unconfirmed") {
			setSubmission("idle");
			setFallbackMailto(null);
		}

		const active = activeRequestRef.current;
		if (!active) return;
		const currentFingerprint = diagnosticLeadFingerprint(leadInput(next, locale));
		if (currentFingerprint === active.fingerprint) return;
		requestTokenRef.current += 1;
		active.controller.abort();
		activeRequestRef.current = null;
		submittingLockRef.current = false;
		setSubmission("idle");
	}

	function updateText(field: TextField, value: string): void {
		replaceValues({ ...valuesRef.current, [field]: value }, field);
	}

	function updateConsent(consent: boolean): void {
		replaceValues({ ...valuesRef.current, consent }, "consent");
	}

	function continueToContact(): void {
		const result = parseDiagnosticScope(scopeInput(valuesRef.current));
		if (!result.success) {
			const fields = issueFields(result.error.issues);
			setInvalidFields(fields);
			setValidationFailed(true);
			focusDiagnosticField(fields[0]);
			return;
		}
		setInvalidFields([]);
		setValidationFailed(false);
		setSubmission("idle");
		setFallbackMailto(null);
		setStage("contact");
	}

	function backToScope(): void {
		if (submission === "submitting") return;
		setInvalidFields([]);
		setValidationFailed(false);
		setSubmission("idle");
		setFallbackMailto(null);
		setStage("scope");
	}

	async function submitLead(): Promise<void> {
		if (submittingLockRef.current) return;
		const result = parseDiagnosticLead(leadInput(valuesRef.current, locale));
		if (!result.success) {
			const fields = issueFields(result.error.issues);
			setInvalidFields(fields);
			setValidationFailed(true);
			if (fields.some((field) => content.stages[0].fields.includes(field))) setStage("scope");
			focusDiagnosticField(fields[0]);
			return;
		}

		const identity = resolveDiagnosticRequestIdentity(identityRef.current, result.data);
		if (!identity) return;
		identityRef.current = identity;
		const controller = new AbortController();
		const token = requestTokenRef.current + 1;
		requestTokenRef.current = token;
		activeRequestRef.current = { controller, fingerprint: identity.normalizedLeadFingerprint, token };
		submittingLockRef.current = true;
		setInvalidFields([]);
		setValidationFailed(false);
		setFallbackMailto(null);
		setSubmission("submitting");

		const requestResult = await submitDiagnosticRequest(result.data, identity.idempotencyKey, {
			signal: controller.signal,
		});
		const active = activeRequestRef.current;
		const currentFingerprint = diagnosticLeadFingerprint(leadInput(valuesRef.current, locale));
		if (
			!active ||
			active.token !== token ||
			requestTokenRef.current !== token ||
			currentFingerprint !== active.fingerprint
		) {
			return;
		}

		activeRequestRef.current = null;
		submittingLockRef.current = false;
		if (requestResult.status === "confirmed") {
			identityRef.current = null;
			setSubmission("idle");
			setStage("success");
			return;
		}

		setFallbackMailto(buildDiagnosticMailto(result.data));
		setSubmission("unconfirmed");
	}

	function submit(event: React.FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		if (stage === "scope") {
			continueToContact();
			return;
		}
		if (stage === "contact") void submitLead();
	}

	const currentStage = stage === "success" ? null : content.stages.find((item) => item.id === stage);
	const pending = submission === "submitting";
	const reviewItems = ["website", "brand", "market", "question"] as const;

	return (
		<div className="diagnostic-sheet" data-diagnostic-state={stage === "success" ? "success" : submission}>
			<header className="diagnostic-sheet__masthead">
				<p>{copy.requestLabel}</p>
				<ol aria-label={locale === "zh" ? "申请进度" : "Request progress"}>
					{content.stages.map((item) => (
						<li key={item.id} aria-current={stage === item.id ? "step" : undefined}>
							{item.progressLabel}
						</li>
					))}
				</ol>
			</header>

			{stage === "success" ? (
				<section className="diagnostic-confirmation" role="status" aria-live="polite">
					<p className="diagnostic-confirmation__index">02 / 02</p>
					<h2 id="diagnostic-success-title" tabIndex={-1}>
						{copy.success.title}
					</h2>
					<p>{copy.success.body}</p>
					<dl>
						{reviewItems.map((field) => (
							<div key={field}>
								<dt>{copy.fields[field].label}</dt>
								<dd>{values[field]}</dd>
							</div>
						))}
					</dl>
				</section>
			) : (
				<form className="diagnostic-form" onSubmit={submit} noValidate aria-describedby="diagnostic-disclosure">
					<div className="diagnostic-form__heading">
						<p>{currentStage?.progressLabel}</p>
						<h2 id="diagnostic-stage-title" tabIndex={-1}>
							{currentStage?.title}
						</h2>
						<p>{currentStage?.summary}</p>
					</div>

					{stage === "contact" ? (
						<dl className="diagnostic-review" aria-label={copy.reviewLabel}>
							{reviewItems.map((field) => (
								<div key={field}>
									<dt>{copy.fields[field].label}</dt>
									<dd>{values[field]}</dd>
								</div>
							))}
						</dl>
					) : null}

					<fieldset className="diagnostic-fields">
						<legend className="sr-only">{currentStage?.title}</legend>
						{currentStage?.fields.map((field) => {
							if (field === "consent") {
								const invalid = invalidFields.includes(field);
								return (
									<div className="diagnostic-consent" key={field}>
										<label htmlFor="diagnostic-consent">
											<input
												id="diagnostic-consent"
												name="consent"
												type="checkbox"
												value="true"
												checked={values.consent}
												disabled={pending}
												aria-invalid={invalid}
												aria-describedby="diagnostic-consent-error"
												onChange={(event) => updateConsent(event.currentTarget.checked)}
											/>
											<span>{copy.consent.label}</span>
										</label>
										<FieldError id="diagnostic-consent-error" visible={invalid} copy={copy.consent.error} />
									</div>
								);
							}

							const invalid = invalidFields.includes(field);
							const fieldCopy = copy.fields[field];
							const errorId = `diagnostic-${field}-error`;
							const required = field !== "competitors";
							return (
								<div className={`diagnostic-field diagnostic-field--${field}`} key={field}>
									<label
										className="diagnostic-field__label"
										data-required={required || undefined}
										htmlFor={`diagnostic-${field}`}
									>
										{fieldCopy.label}
									</label>
									{field === "question" ? (
										<textarea
											id={`diagnostic-${field}`}
											name={field}
											value={values[field]}
											placeholder={fieldCopy.placeholder}
											maxLength={TEXT_FIELD_LIMITS[field]}
											required
											aria-invalid={invalid}
											aria-describedby={errorId}
											onChange={(event) => updateText(field, event.currentTarget.value)}
										/>
									) : (
										<input
											id={`diagnostic-${field}`}
											name={field}
											type={field === "website" ? "url" : field === "email" ? "email" : "text"}
											value={values[field]}
											placeholder={fieldCopy.placeholder}
											maxLength={TEXT_FIELD_LIMITS[field]}
											required={required}
											aria-invalid={invalid}
											aria-describedby={errorId}
											onChange={(event) => updateText(field, event.currentTarget.value)}
										/>
									)}
									<FieldError id={errorId} visible={invalid} copy={fieldCopy.error} />
								</div>
							);
						})}
					</fieldset>

					<p className="diagnostic-privacy">
						<span>{copy.consent.privacyLeadIn}</span> <a href="/privacy">{copy.consent.privacyLinkLabel}</a>
					</p>

					<div className="diagnostic-honeypot" aria-hidden="true">
						<label htmlFor="diagnostic-company-url">{copy.honeypotLabel}</label>
						<input
							id="diagnostic-company-url"
							name="companyUrl"
							type="text"
							value={values.companyUrl}
							autoComplete="off"
							tabIndex={-1}
							onChange={(event) => replaceValues({ ...valuesRef.current, companyUrl: event.currentTarget.value })}
						/>
					</div>

					{validationFailed ? (
						<p className="diagnostic-validation" role="alert">
							{copy.validationSummary}
						</p>
					) : null}
					{submission === "submitting" ? (
						<p className="diagnostic-submission-status" role="status" aria-live="polite">
							{copy.actions.submitting}
						</p>
					) : null}
					{submission === "unconfirmed" ? (
						<div className="diagnostic-failure" role="alert" tabIndex={-1} ref={failureRef}>
							<h3>{copy.failure.title}</h3>
							<p>{copy.failure.body}</p>
							{fallbackMailto ? <a href={fallbackMailto}>{copy.failure.fallbackLabel}</a> : null}
							<p>{copy.failure.fallbackDisclosure}</p>
						</div>
					) : null}

					<div className="diagnostic-form__actions">
						{stage === "contact" ? (
							<button
								type="button"
								className="diagnostic-action diagnostic-action--back"
								onClick={backToScope}
								disabled={pending}
							>
								{copy.actions.back}
							</button>
						) : null}
						<button type="submit" className="diagnostic-action diagnostic-action--primary" disabled={pending}>
							{stage === "scope"
								? copy.actions.continue
								: pending
									? copy.actions.submitting
									: submission === "unconfirmed"
										? copy.actions.retry
										: copy.actions.submit}
						</button>
					</div>

					<p id="diagnostic-disclosure" className="diagnostic-disclosure">
						{copy.disclosure}
					</p>
				</form>
			)}
		</div>
	);
}
