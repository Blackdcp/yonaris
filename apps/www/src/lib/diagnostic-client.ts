import {
	DIAGNOSTIC_API_PATH,
	DIAGNOSTIC_IDEMPOTENCY_HEADER,
	type DiagnosticApiResponse,
} from "./diagnostic-api-protocol";
import { type DiagnosticLead, parseDiagnosticLead } from "./diagnostic-schema";

export interface DiagnosticRequestIdentity {
	normalizedLeadFingerprint: string;
	idempotencyKey: string;
}

export type DiagnosticRequestResult = { status: "confirmed" } | { status: "unconfirmed" };

interface DiagnosticRequestOptions {
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
	timeoutMs?: number;
}

const DEFAULT_CLIENT_TIMEOUT_MS = 10_000;

export function diagnosticLeadFingerprint(input: unknown): string | null {
	const result = parseDiagnosticLead(input);
	if (!result.success) return null;
	const lead = result.data;
	return JSON.stringify(
		lead.locale === "en"
			? { locale: lead.locale, name: lead.name, email: lead.email, company: lead.company, companyUrl: lead.companyUrl }
			: { locale: lead.locale, name: lead.name, phone: lead.phone, company: lead.company, companyUrl: lead.companyUrl },
	);
}

export function resolveDiagnosticRequestIdentity(
	current: DiagnosticRequestIdentity | null,
	input: unknown,
	createUuid: () => string = () => crypto.randomUUID(),
): DiagnosticRequestIdentity | null {
	const normalizedLeadFingerprint = diagnosticLeadFingerprint(input);
	if (!normalizedLeadFingerprint) return null;
	if (current?.normalizedLeadFingerprint === normalizedLeadFingerprint) return current;
	return { normalizedLeadFingerprint, idempotencyKey: createUuid() };
}

function isAcceptedResponse(input: unknown): input is { ok: true } {
	return typeof input === "object" && input !== null && (input as DiagnosticApiResponse).ok === true;
}

export async function submitDiagnosticRequest(
	lead: DiagnosticLead,
	idempotencyKey: string,
	options: DiagnosticRequestOptions = {},
): Promise<DiagnosticRequestResult> {
	const parsed = parseDiagnosticLead(lead);
	if (!parsed.success) return { status: "unconfirmed" };

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_CLIENT_TIMEOUT_MS);
	const abortFromCaller = () => controller.abort(options.signal?.reason);
	if (options.signal?.aborted) abortFromCaller();
	else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

	try {
		const response = await (options.fetchImpl ?? fetch)(DIAGNOSTIC_API_PATH, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				[DIAGNOSTIC_IDEMPOTENCY_HEADER]: idempotencyKey,
			},
			body: JSON.stringify(parsed.data),
			signal: controller.signal,
		});
		if (response.status !== 202) return { status: "unconfirmed" };
		const body: unknown = await response.json().catch(() => null);
		return isAcceptedResponse(body) ? { status: "confirmed" } : { status: "unconfirmed" };
	} catch {
		return { status: "unconfirmed" };
	} finally {
		clearTimeout(timeout);
		options.signal?.removeEventListener("abort", abortFromCaller);
	}
}
