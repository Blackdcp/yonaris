import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { renderResponseSnapshotHtml, renderStructuredResponseSnapshotHtml } from "./html";

const MAX_ANSWER_CHARACTERS = 500_000;
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_COMPRESSED_BUNDLE_BYTES = 8 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function canUseNativeResponseSnapshotHtml(answerHtml: string): boolean {
	return utf8(answerHtml).byteLength <= MAX_HTML_BYTES;
}

export type ResponseSnapshotContentSource =
	| "native_answer_html"
	| "browser_answer_html"
	| "rendered_from_structured_response"
	| "reconstructed_from_historical_run";

export type ResponseSnapshotCaptureMethod =
	| "brightdata_dataset"
	| "brightdata_serp"
	| "consumer_web_browser"
	| "historical_reconstruction";

export type ResponseSnapshotDraft = {
	runId: string;
	brandId: string;
	scopeId: string | null;
	promptId: string;
	promptText: string;
	answerText: string;
	answerHtml?: string;
	citations: Array<{ url: string; title: string | null; domain: string; citationIndex: number }>;
	webQueries: string[];
	queryAvailability: "available" | "unavailable" | "not_applicable";
	brandMentioned: boolean;
	competitorsMentioned: string[];
	channel: string;
	modelVersion: string;
	market: string;
	locale: string;
	timezone: string;
	observedAt: string;
	captureMethod: ResponseSnapshotCaptureMethod;
	contentSource: ResponseSnapshotContentSource;
	sourcePayloadSha256?: string;
};

export type ResponseSnapshotVisualEvidence = {
	artifactId: string;
	mediaType: "image/jpeg";
	sha256: string;
	bytes: number;
};

export type ResponseSnapshotCaptureDiagnostics = {
	answerCount: 1;
	queryCount: number;
	citationCount: number;
	completionCount: 1;
	extractorVersion: string;
	evidenceSource: "dom" | "network" | "dom_and_network" | "none";
	searchBlockCount: number;
	queryCandidateCount: number;
	citationCandidateCount: number;
};

export type ResponseSnapshotDraftV2 = Omit<
	ResponseSnapshotDraft,
	"answerHtml" | "contentSource" | "queryAvailability"
> & {
	schemaVersion: "response-snapshot.v2";
	contentSource: "rendered_from_structured_response";
	visualEvidence: ResponseSnapshotVisualEvidence;
	adapterVersion: string;
	captureDiagnostics: ResponseSnapshotCaptureDiagnostics;
	queryAvailability: "available" | "unavailable" | "not_applicable" | "not_searched" | "unknown";
	answerHtml?: never;
};

type PreparedResponseSnapshotBundleBase = {
	runId: string;
	brandId: string;
	observedAt: string;
	contentSource: ResponseSnapshotContentSource;
	captureMethod: ResponseSnapshotCaptureMethod;
	sourcePayloadSha256: string | null;
	htmlGzip: Uint8Array;
	jsonGzip: Uint8Array;
	manifestJson: Uint8Array;
	htmlSha256: string;
	jsonSha256: string;
	manifestSha256: string;
	htmlBytes: number;
	jsonBytes: number;
	manifestBytes: number;
	htmlGzipBytes: number;
	jsonGzipBytes: number;
};

export type PreparedResponseSnapshotBundle = PreparedResponseSnapshotBundleBase &
	(
		| {
				schemaVersion: "response-snapshot.v1";
				templateVersion: "response-snapshot-html.v1";
		  }
		| {
				schemaVersion: "response-snapshot.v2";
				templateVersion: "response-snapshot-html.v2";
		  }
	);

export class ResponseSnapshotValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotValidationError";
	}
}

export class ResponseSnapshotSizeValidationError extends ResponseSnapshotValidationError {}

export function isResponseSnapshotBundleSizeError(error: unknown): error is ResponseSnapshotSizeValidationError {
	return error instanceof ResponseSnapshotSizeValidationError;
}

export function prepareResponseSnapshotBundle(
	draft: ResponseSnapshotDraft | ResponseSnapshotDraftV2,
): PreparedResponseSnapshotBundle {
	const normalized = normalizeDraft(draft);
	const v2 = isV2Draft(normalized);
	const commonSnapshotJson = {
		runId: normalized.runId,
		brandId: normalized.brandId,
		scopeId: normalized.scopeId,
		promptId: normalized.promptId,
		promptText: normalized.promptText,
		answerText: normalized.answerText,
		citations: normalized.citations,
		queryFanout: {
			availability: normalized.queryAvailability,
			queries: normalized.webQueries,
		},
		mentions: {
			brandMentioned: normalized.brandMentioned,
			competitorsMentioned: normalized.competitorsMentioned,
		},
		channel: normalized.channel,
		modelVersion: normalized.modelVersion,
		localization: {
			market: normalized.market,
			locale: normalized.locale,
			timezone: normalized.timezone,
		},
		observedAt: normalized.observedAt,
		captureMethod: normalized.captureMethod,
		contentSource: normalized.contentSource,
		sourcePayloadSha256: normalized.sourcePayloadSha256 ?? null,
	} as const;
	const snapshotJson = v2
		? {
				schemaVersion: "response-snapshot.v2" as const,
				...commonSnapshotJson,
				visualEvidence: normalized.visualEvidence,
				adapterVersion: normalized.adapterVersion,
				captureDiagnostics: normalized.captureDiagnostics,
			}
		: {
				schemaVersion: "response-snapshot.v1" as const,
				runId: normalized.runId,
				brandId: normalized.brandId,
				scopeId: normalized.scopeId,
				promptId: normalized.promptId,
				promptText: normalized.promptText,
				answerText: normalized.answerText,
				answerHtml: normalized.answerHtml,
				citations: normalized.citations,
				queryFanout: {
					availability: normalized.queryAvailability,
					queries: normalized.webQueries,
				},
				mentions: {
					brandMentioned: normalized.brandMentioned,
					competitorsMentioned: normalized.competitorsMentioned,
				},
				channel: normalized.channel,
				modelVersion: normalized.modelVersion,
				localization: {
					market: normalized.market,
					locale: normalized.locale,
					timezone: normalized.timezone,
				},
				observedAt: normalized.observedAt,
				captureMethod: normalized.captureMethod,
				contentSource: normalized.contentSource,
				sourcePayloadSha256: normalized.sourcePayloadSha256 ?? null,
			};
	const jsonBytes = utf8(`${JSON.stringify(snapshotJson)}\n`);
	if (jsonBytes.byteLength > MAX_JSON_BYTES) {
		throw new ResponseSnapshotSizeValidationError(`Snapshot JSON exceeds the ${MAX_JSON_BYTES} byte limit`);
	}
	const htmlInput = {
		answerText: normalized.answerText,
		channel: normalized.channel,
		observedAt: normalized.observedAt,
		citations: normalized.citations,
	};
	const htmlBytes = utf8(
		v2
			? renderStructuredResponseSnapshotHtml(htmlInput)
			: renderResponseSnapshotHtml({ ...htmlInput, answerHtml: normalized.answerHtml }),
	);
	if (htmlBytes.byteLength > MAX_HTML_BYTES) {
		throw new ResponseSnapshotSizeValidationError(`Snapshot HTML exceeds the ${MAX_HTML_BYTES} byte limit`);
	}

	const htmlSha256 = sha256(htmlBytes);
	const jsonSha256 = sha256(jsonBytes);
	const htmlGzip = gzipSync(htmlBytes, { level: 9 });
	const jsonGzip = gzipSync(jsonBytes, { level: 9 });
	if (htmlGzip.byteLength + jsonGzip.byteLength > MAX_COMPRESSED_BUNDLE_BYTES) {
		throw new ResponseSnapshotSizeValidationError(
			`Compressed snapshot exceeds the ${MAX_COMPRESSED_BUNDLE_BYTES} byte limit`,
		);
	}
	const commonManifest = {
		runId: normalized.runId,
		artifacts: {
			html: {
				fileName: "snapshot.html.gz",
				sha256: htmlSha256,
				bytes: htmlBytes.byteLength,
				gzipBytes: htmlGzip.byteLength,
			},
			json: {
				fileName: "snapshot.json.gz",
				sha256: jsonSha256,
				bytes: jsonBytes.byteLength,
				gzipBytes: jsonGzip.byteLength,
			},
		},
	} as const;
	const manifest = v2
		? {
				schemaVersion: "response-snapshot-manifest.v2" as const,
				...commonManifest,
				visualEvidence: normalized.visualEvidence,
			}
		: {
				schemaVersion: "response-snapshot-manifest.v1" as const,
				...commonManifest,
			};
	const manifestJson = utf8(`${JSON.stringify(manifest)}\n`);

	const prepared = {
		runId: normalized.runId,
		brandId: normalized.brandId,
		observedAt: normalized.observedAt,
		contentSource: normalized.contentSource,
		captureMethod: normalized.captureMethod,
		sourcePayloadSha256: normalized.sourcePayloadSha256 ?? null,
		htmlGzip,
		jsonGzip,
		manifestJson,
		htmlSha256,
		jsonSha256,
		manifestSha256: sha256(manifestJson),
		htmlBytes: htmlBytes.byteLength,
		jsonBytes: jsonBytes.byteLength,
		manifestBytes: manifestJson.byteLength,
		htmlGzipBytes: htmlGzip.byteLength,
		jsonGzipBytes: jsonGzip.byteLength,
	};
	return v2
		? {
				...prepared,
				schemaVersion: "response-snapshot.v2",
				templateVersion: "response-snapshot-html.v2",
			}
		: {
				...prepared,
				schemaVersion: "response-snapshot.v1",
				templateVersion: "response-snapshot-html.v1",
			};
}

function normalizeDraft(
	draft: ResponseSnapshotDraft | ResponseSnapshotDraftV2,
): ResponseSnapshotDraft | ResponseSnapshotDraftV2 {
	const runId = requiredText(draft.runId, "runId", 100);
	const brandId = requiredText(draft.brandId, "brandId", 300);
	const promptId = requiredText(draft.promptId, "promptId", 100);
	const promptText = requiredText(draft.promptText, "promptText", 20_000);
	if (typeof draft.answerText !== "string" || !draft.answerText.trim()) {
		throw new ResponseSnapshotValidationError("answerText must not be empty");
	}
	if (draft.answerText.length > MAX_ANSWER_CHARACTERS) {
		throw new ResponseSnapshotValidationError(`answerText exceeds ${MAX_ANSWER_CHARACTERS} characters`);
	}
	const v2 = isV2Draft(draft);
	if (v2 && "answerHtml" in draft) {
		throw new ResponseSnapshotValidationError("response-snapshot.v2 must not contain answerHtml");
	}
	if (v2 && draft.contentSource !== "rendered_from_structured_response") {
		throw new ResponseSnapshotValidationError(
			"response-snapshot.v2 contentSource must be rendered_from_structured_response",
		);
	}
	const answerHtml = v2 || draft.answerHtml === undefined ? undefined : String(draft.answerHtml);
	if (
		(draft.contentSource === "native_answer_html" || draft.contentSource === "browser_answer_html") &&
		!answerHtml?.trim()
	) {
		throw new ResponseSnapshotValidationError(`${draft.contentSource} requires answer HTML`);
	}
	if (answerHtml && !canUseNativeResponseSnapshotHtml(answerHtml)) {
		throw new ResponseSnapshotSizeValidationError(`Snapshot HTML exceeds the ${MAX_HTML_BYTES} byte limit`);
	}
	if (draft.sourcePayloadSha256 !== undefined && !SHA256_PATTERN.test(draft.sourcePayloadSha256)) {
		throw new ResponseSnapshotValidationError("sourcePayloadSha256 must be a lowercase SHA-256 digest");
	}
	const visualEvidence = v2 ? normalizeVisualEvidence(draft.visualEvidence) : undefined;
	const adapterVersion = v2 ? requiredText(draft.adapterVersion, "adapterVersion", 100) : undefined;
	const captureDiagnostics = v2 ? normalizeCaptureDiagnostics(draft.captureDiagnostics, draft) : undefined;
	if (draft.queryAvailability !== "available" && draft.webQueries.length > 0) {
		throw new ResponseSnapshotValidationError("Unavailable query fan-out cannot contain query strings");
	}
	const observedAt = new Date(draft.observedAt);
	if (Number.isNaN(observedAt.getTime()))
		throw new ResponseSnapshotValidationError("observedAt must be a valid timestamp");

	const citationIndexes = new Set<number>();
	const citations = draft.citations
		.map((citation) => {
			if (!Number.isInteger(citation.citationIndex) || citation.citationIndex < 0) {
				throw new ResponseSnapshotValidationError("citationIndex must be a non-negative integer");
			}
			if (citationIndexes.has(citation.citationIndex)) {
				throw new ResponseSnapshotValidationError("citationIndex must be unique");
			}
			citationIndexes.add(citation.citationIndex);
			const url = requiredText(citation.url, "citation.url", 10_000);
			const parsed = new URL(url);
			if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) {
				throw new ResponseSnapshotValidationError("citation.url must be an HTTP(S) URL without credentials");
			}
			return {
				url: parsed.href,
				title: citation.title === null ? null : requiredText(citation.title, "citation.title", 1_000),
				domain: requiredText(citation.domain, "citation.domain", 255),
				citationIndex: citation.citationIndex,
			};
		})
		.sort((left, right) => left.citationIndex - right.citationIndex);

	const common = {
		runId,
		brandId,
		scopeId: draft.scopeId === null ? null : requiredText(draft.scopeId, "scopeId", 100),
		promptId,
		promptText,
		answerText: draft.answerText,
		citations,
		webQueries: draft.webQueries.map((query) => requiredText(query, "webQueries", 2_000)),
		brandMentioned: draft.brandMentioned,
		competitorsMentioned: [...new Set(draft.competitorsMentioned.map((name) => requiredText(name, "competitor", 300)))],
		channel: requiredText(draft.channel, "channel", 100),
		modelVersion: requiredText(draft.modelVersion, "modelVersion", 200),
		market: requiredText(draft.market, "market", 20),
		locale: requiredText(draft.locale, "locale", 50),
		timezone: requiredText(draft.timezone, "timezone", 100),
		observedAt: observedAt.toISOString(),
		captureMethod: draft.captureMethod,
		sourcePayloadSha256: draft.sourcePayloadSha256,
	};
	if (v2) {
		return {
			...common,
			schemaVersion: "response-snapshot.v2" as const,
			contentSource: "rendered_from_structured_response" as const,
			queryAvailability: draft.queryAvailability,
			visualEvidence: visualEvidence as ResponseSnapshotVisualEvidence,
			adapterVersion: adapterVersion as string,
			captureDiagnostics: captureDiagnostics as ResponseSnapshotCaptureDiagnostics,
		};
	}
	return {
		...common,
		answerHtml,
		contentSource: draft.contentSource,
		queryAvailability: draft.queryAvailability,
	};
}

function isV2Draft(draft: ResponseSnapshotDraft | ResponseSnapshotDraftV2): draft is ResponseSnapshotDraftV2 {
	return "schemaVersion" in draft && draft.schemaVersion === "response-snapshot.v2";
}

function normalizeVisualEvidence(value: ResponseSnapshotVisualEvidence | undefined): ResponseSnapshotVisualEvidence {
	if (!value || typeof value !== "object") {
		throw new ResponseSnapshotValidationError("visualEvidence is required for response-snapshot.v2");
	}
	if (!UUID_PATTERN.test(value.artifactId)) {
		throw new ResponseSnapshotValidationError("visualEvidence.artifactId must be a UUID");
	}
	if (value.mediaType !== "image/jpeg") {
		throw new ResponseSnapshotValidationError("visualEvidence.mediaType must be image/jpeg");
	}
	if (!SHA256_PATTERN.test(value.sha256)) {
		throw new ResponseSnapshotValidationError("visualEvidence.sha256 must be a lowercase SHA-256 digest");
	}
	if (!Number.isInteger(value.bytes) || value.bytes < 1 || value.bytes > MAX_SCREENSHOT_BYTES) {
		throw new ResponseSnapshotValidationError(`visualEvidence.bytes must be between 1 and ${MAX_SCREENSHOT_BYTES}`);
	}
	return { ...value };
}

function normalizeCaptureDiagnostics(
	value: ResponseSnapshotCaptureDiagnostics,
	draft: ResponseSnapshotDraftV2,
): ResponseSnapshotCaptureDiagnostics {
	if (
		value.answerCount !== 1 ||
		value.completionCount !== 1 ||
		!Number.isInteger(value.queryCount) ||
		value.queryCount !== draft.webQueries.length ||
		!Number.isInteger(value.citationCount) ||
		value.citationCount !== draft.citations.length ||
		typeof value.extractorVersion !== "string" ||
		!value.extractorVersion.trim() ||
		value.extractorVersion.length > 100 ||
		!["dom", "network", "dom_and_network", "none"].includes(value.evidenceSource) ||
		![value.searchBlockCount, value.queryCandidateCount, value.citationCandidateCount].every(
			(count) => Number.isInteger(count) && count >= 0 && count <= 10_000,
		)
	) {
		throw new ResponseSnapshotValidationError("captureDiagnostics must match the structured snapshot counts");
	}
	return { ...value };
}

function requiredText(value: string, name: string, maxLength: number): string {
	if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
		throw new ResponseSnapshotValidationError(`${name} must contain between 1 and ${maxLength} characters`);
	}
	return value;
}

function utf8(value: string): Uint8Array {
	return Buffer.from(value, "utf8");
}

function sha256(value: Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}
