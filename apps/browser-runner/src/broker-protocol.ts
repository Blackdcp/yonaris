import type { Readable } from "node:stream";
import { ANSWER_CONTAINER_HTML_MAX_BYTES } from "./answer-container-snapshot.js";
import type { EvidenceArtifact, RunnerTask, SurfaceResponse } from "./contracts.js";

export const BROKER_PROTOCOL_VERSION = 1 as const;
export const BROKER_REQUEST_MAX_BYTES = 1_048_576;
// Match the Portal completion endpoint so a valid UTF-8 answer can cross the
// local broker boundary without becoming an artificial post-submit failure.
export const BROKER_RESPONSE_MAX_BYTES = 6 * 1_048_576;

export type BrokerEvidenceDescriptor = EvidenceArtifact & { artifactId: string };

export type BrokerRequest =
	| { version: 1; requestId: string; operation: "ping" }
	| { version: 1; requestId: string; operation: "create"; task: RunnerTask; attempt: number }
	| {
			version: 1;
			requestId: string;
			operation: "resume";
			task: RunnerTask;
			profileDirectory: string;
			lastPageUrl: string;
			expectedSessionId: string;
	  }
	| { version: 1; requestId: string; operation: "open"; sessionId: string }
	| { version: 1; requestId: string; operation: "prepare"; sessionId: string }
	| { version: 1; requestId: string; operation: "submit"; sessionId: string; promptText: string }
	| { version: 1; requestId: string; operation: "confirm"; sessionId: string; promptText: string }
	| { version: 1; requestId: string; operation: "collect"; sessionId: string }
	| { version: 1; requestId: string; operation: "capture"; sessionId: string }
	| { version: 1; requestId: string; operation: "handoff"; sessionId: string }
	| {
			version: 1;
			requestId: string;
			operation: "close";
			sessionId: string;
			outcome: "succeeded" | "retrying" | "needs_human";
	  }
	| { version: 1; requestId: string; operation: "release_evidence"; sessionId: string; artifactIds: string[] };

export type BrokerSuccessResult =
	| { kind: "pong" }
	| { kind: "session"; sessionId: string }
	| { kind: "ack" }
	| { kind: "response"; response: SurfaceResponse }
	| { kind: "evidence"; evidence: BrokerEvidenceDescriptor[] }
	| {
			kind: "handoff";
			metadata: { sessionId: string; profileDirectory?: string; lastPageUrl: string; fixture: false };
	  };

export type BrokerResponse =
	| { version: 1; requestId: string; ok: true; result: BrokerSuccessResult }
	| {
			version: 1;
			requestId: string;
			ok: false;
			error: {
				code: string;
				phase: "claim" | "session_open" | "pre_submit" | "submit" | "post_submit" | "evidence" | "persist";
				disposition: "safe_pre_submit_retry" | "recover_same_session" | "needs_human";
				message: string;
			};
	  };

export function parseBrokerRequest(value: unknown): BrokerRequest {
	const record = objectValue(value, "Broker request");
	assertExactKeys(
		record,
		["version", "requestId", "operation"],
		[
			"task",
			"attempt",
			"sessionId",
			"promptText",
			"profileDirectory",
			"lastPageUrl",
			"expectedSessionId",
			"outcome",
			"artifactIds",
		],
	);
	if (record.version !== BROKER_PROTOCOL_VERSION) throw new Error("Unsupported broker protocol version");
	const requestId = textValue(record.requestId, "requestId", 1, 100);
	const operation = textValue(record.operation, "operation", 1, 40);
	const base = { version: BROKER_PROTOCOL_VERSION, requestId } as const;

	switch (operation) {
		case "ping":
			assertExactKeys(record, ["version", "requestId", "operation"]);
			return { ...base, operation };
		case "create":
			assertExactKeys(record, ["version", "requestId", "operation", "task", "attempt"]);
			return {
				...base,
				operation,
				task: parseRunnerTask(record.task),
				attempt: integerValue(record.attempt, "attempt", 1, 2),
			};
		case "resume":
			assertExactKeys(record, [
				"version",
				"requestId",
				"operation",
				"task",
				"profileDirectory",
				"lastPageUrl",
				"expectedSessionId",
			]);
			return {
				...base,
				operation,
				task: parseRunnerTask(record.task),
				profileDirectory: textValue(record.profileDirectory, "profileDirectory", 1, 4_096),
				lastPageUrl: textValue(record.lastPageUrl, "lastPageUrl", 1, 10_000),
				expectedSessionId: textValue(record.expectedSessionId, "expectedSessionId", 1, 300),
			};
		case "open":
		case "prepare":
		case "collect":
		case "capture":
		case "handoff":
			assertExactKeys(record, ["version", "requestId", "operation", "sessionId"]);
			return { ...base, operation, sessionId: textValue(record.sessionId, "sessionId", 1, 300) };
		case "submit":
		case "confirm":
			assertExactKeys(record, ["version", "requestId", "operation", "sessionId", "promptText"]);
			return {
				...base,
				operation,
				sessionId: textValue(record.sessionId, "sessionId", 1, 300),
				promptText: textValue(record.promptText, "promptText", 1, 500_000),
			};
		case "close": {
			assertExactKeys(record, ["version", "requestId", "operation", "sessionId", "outcome"]);
			const outcome = enumValue(record.outcome, "outcome", ["succeeded", "retrying", "needs_human"] as const);
			return { ...base, operation, sessionId: textValue(record.sessionId, "sessionId", 1, 300), outcome };
		}
		case "release_evidence": {
			assertExactKeys(record, ["version", "requestId", "operation", "sessionId", "artifactIds"]);
			if (!Array.isArray(record.artifactIds) || record.artifactIds.length < 1 || record.artifactIds.length > 2) {
				throw new Error("artifactIds must contain one or two artifact identifiers");
			}
			return {
				...base,
				operation,
				sessionId: textValue(record.sessionId, "sessionId", 1, 300),
				artifactIds: record.artifactIds.map((item) => textValue(item, "artifactId", 1, 100)),
			};
		}
		default:
			throw new Error("Unsupported broker operation");
	}
}

export function parseBrokerResponse(value: unknown): BrokerResponse {
	const record = objectValue(value, "Broker response");
	if (record.version !== BROKER_PROTOCOL_VERSION) throw new Error("Unsupported broker protocol version");
	const requestId = textValue(record.requestId, "requestId", 1, 100);
	if (record.ok === true) {
		assertExactKeys(record, ["version", "requestId", "ok", "result"]);
		return {
			version: BROKER_PROTOCOL_VERSION,
			requestId,
			ok: true,
			result: parseSuccessResult(record.result),
		};
	}
	if (record.ok === false) {
		assertExactKeys(record, ["version", "requestId", "ok", "error"]);
		const error = objectValue(record.error, "Broker error");
		assertExactKeys(error, ["code", "phase", "disposition", "message"]);
		return {
			version: BROKER_PROTOCOL_VERSION,
			requestId,
			ok: false,
			error: {
				code: textValue(error.code, "error.code", 1, 100),
				phase: enumValue(error.phase, "error.phase", [
					"claim",
					"session_open",
					"pre_submit",
					"submit",
					"post_submit",
					"evidence",
					"persist",
				] as const),
				disposition: enumValue(error.disposition, "error.disposition", [
					"safe_pre_submit_retry",
					"recover_same_session",
					"needs_human",
				] as const),
				message: textValue(error.message, "error.message", 1, 1_000),
			},
		};
	}
	throw new Error("Broker response ok flag is invalid");
}

export function encodeBrokerFrame(value: unknown, maximumBytes: number): Buffer {
	const body = Buffer.from(JSON.stringify(value), "utf8");
	if (body.byteLength <= 0 || body.byteLength > maximumBytes) {
		throw new Error(`Broker frame exceeds ${maximumBytes} bytes`);
	}
	const header = Buffer.allocUnsafe(4);
	header.writeUInt32BE(body.byteLength);
	return Buffer.concat([header, body]);
}

export async function readBrokerFrame(stream: Readable, maximumBytes: number): Promise<unknown> {
	let buffer = Buffer.alloc(0);
	let declaredLength: number | undefined;
	for await (const value of stream.iterator({ destroyOnReturn: false })) {
		const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
		buffer = Buffer.concat([buffer, chunk]);
		if (declaredLength === undefined && buffer.byteLength >= 4) {
			declaredLength = buffer.readUInt32BE(0);
			if (declaredLength <= 0 || declaredLength > maximumBytes) {
				throw new Error(`Broker frame exceeds ${maximumBytes} bytes`);
			}
		}
		if (declaredLength !== undefined && buffer.byteLength > declaredLength + 4) {
			throw new Error("Broker stream contained trailing bytes");
		}
		if (declaredLength !== undefined && buffer.byteLength === declaredLength + 4) {
			try {
				return JSON.parse(buffer.subarray(4).toString("utf8"));
			} catch {
				throw new Error("Broker frame was not valid JSON");
			}
		}
	}
	throw new Error("Broker frame was truncated");
}

function parseRunnerTask(value: unknown): RunnerTask {
	const record = objectValue(value, "task");
	assertExactKeys(
		record,
		[
			"id",
			"batchId",
			"brandId",
			"promptText",
			"surfaceTargetKey",
			"captureRouteKey",
			"sampleIndex",
			"sessionRequirement",
			"searchRequirement",
			"evaluationRole",
			"automationAttemptCount",
			"leaseGeneration",
		],
		["minimumEvidenceArtifacts"],
	);
	return {
		id: textValue(record.id, "task.id", 1, 300),
		batchId: textValue(record.batchId, "task.batchId", 1, 300),
		brandId: textValue(record.brandId, "task.brandId", 1, 300),
		promptText: textValue(record.promptText, "task.promptText", 1, 500_000),
		surfaceTargetKey: enumValue(record.surfaceTargetKey, "task.surfaceTargetKey", ["doubao.consumer_web"] as const),
		captureRouteKey: enumValue(record.captureRouteKey, "task.captureRouteKey", ["browser_runner.doubao"] as const),
		sampleIndex: integerValue(record.sampleIndex, "task.sampleIndex", 1, 1_000_000),
		sessionRequirement: enumValue(record.sessionRequirement, "task.sessionRequirement", [
			"anonymous_clean",
			"new_account_clean",
			"dedicated_sampling_profile",
		] as const),
		searchRequirement: enumValue(record.searchRequirement, "task.searchRequirement", [
			"forbidden",
			"platform_default",
		] as const),
		evaluationRole: enumValue(record.evaluationRole, "task.evaluationRole", ["scored", "observation"] as const),
		...(record.minimumEvidenceArtifacts === undefined
			? {}
			: {
					minimumEvidenceArtifacts: integerValue(
						record.minimumEvidenceArtifacts,
						"task.minimumEvidenceArtifacts",
						1,
						20,
					),
				}),
		automationAttemptCount: integerValue(record.automationAttemptCount, "task.automationAttemptCount", 0, 100),
		leaseGeneration: integerValue(record.leaseGeneration, "task.leaseGeneration", 1, 1_000_000),
	};
}

function parseSuccessResult(value: unknown): BrokerSuccessResult {
	const record = objectValue(value, "Broker result");
	const kind = textValue(record.kind, "result.kind", 1, 30);
	switch (kind) {
		case "pong":
		case "ack":
			assertExactKeys(record, ["kind"]);
			return { kind };
		case "session":
			assertExactKeys(record, ["kind", "sessionId"]);
			return { kind, sessionId: textValue(record.sessionId, "result.sessionId", 1, 300) };
		case "response":
			assertExactKeys(record, ["kind", "response"]);
			return { kind, response: parseSurfaceResponse(record.response) };
		case "evidence": {
			assertExactKeys(record, ["kind", "evidence"]);
			if (!Array.isArray(record.evidence) || record.evidence.length !== 2) {
				throw new Error("Broker evidence result must contain exactly two artifacts");
			}
			return { kind, evidence: record.evidence.map(parseEvidenceDescriptor) };
		}
		case "handoff": {
			assertExactKeys(record, ["kind", "metadata"]);
			const metadata = objectValue(record.metadata, "handoff metadata");
			assertExactKeys(metadata, ["sessionId", "lastPageUrl", "fixture"], ["profileDirectory"]);
			if (metadata.fixture !== false) throw new Error("Broker handoff cannot be marked as fixture data");
			return {
				kind,
				metadata: {
					sessionId: textValue(metadata.sessionId, "metadata.sessionId", 1, 300),
					...(metadata.profileDirectory === undefined
						? {}
						: { profileDirectory: textValue(metadata.profileDirectory, "metadata.profileDirectory", 1, 4_096) }),
					lastPageUrl: textValue(metadata.lastPageUrl, "metadata.lastPageUrl", 1, 10_000),
					fixture: false,
				},
			};
		}
		default:
			throw new Error("Unsupported broker response result");
	}
}

function parseSurfaceResponse(value: unknown): SurfaceResponse {
	const record = objectValue(value, "surface response");
	assertExactKeys(
		record,
		["answerText", "answerHtml", "pageUrl", "observedAt", "citations", "webQueries"],
		["modelVersion", "browserVersion", "webSearchObserved"],
	);
	if (!Array.isArray(record.citations) || record.citations.length > 200) {
		throw new Error("response.citations is invalid");
	}
	if (!Array.isArray(record.webQueries) || record.webQueries.length > 200) {
		throw new Error("response.webQueries is invalid");
	}
	const citations = record.citations.map((value, index) => {
		const citation = objectValue(value, `citation ${index}`);
		assertExactKeys(citation, ["url"], ["title", "citationIndex"]);
		return {
			url: textValue(citation.url, "citation.url", 1, 10_000),
			...(citation.title === undefined ? {} : { title: textValue(citation.title, "citation.title", 1, 1_000) }),
			...(citation.citationIndex === undefined
				? {}
				: { citationIndex: integerValue(citation.citationIndex, "citation.citationIndex", 0, 1_000) }),
		};
	});
	const webSearchObserved = record.webSearchObserved;
	if (webSearchObserved !== undefined && webSearchObserved !== null && typeof webSearchObserved !== "boolean") {
		throw new Error("response.webSearchObserved is invalid");
	}
	const answerHtml = textValue(record.answerHtml, "response.answerHtml", 1, ANSWER_CONTAINER_HTML_MAX_BYTES);
	if (Buffer.byteLength(answerHtml, "utf8") > ANSWER_CONTAINER_HTML_MAX_BYTES) {
		throw new Error("response.answerHtml is invalid");
	}
	return {
		answerText: textValue(record.answerText, "response.answerText", 1, 500_000),
		answerHtml,
		pageUrl: textValue(record.pageUrl, "response.pageUrl", 1, 10_000),
		observedAt: textValue(record.observedAt, "response.observedAt", 1, 100),
		...(record.modelVersion === undefined
			? {}
			: { modelVersion: textValue(record.modelVersion, "response.modelVersion", 1, 1_000) }),
		...(record.browserVersion === undefined
			? {}
			: { browserVersion: textValue(record.browserVersion, "response.browserVersion", 1, 1_000) }),
		citations,
		webQueries: record.webQueries.map((item) => textValue(item, "response.webQuery", 1, 10_000)),
		...(webSearchObserved === undefined ? {} : { webSearchObserved }),
	};
}

function parseEvidenceDescriptor(value: unknown): BrokerEvidenceDescriptor {
	const record = objectValue(value, "evidence descriptor");
	assertExactKeys(record, ["artifactId", "kind", "path", "mediaType", "sha256", "bytes"]);
	const kind = enumValue(record.kind, "evidence.kind", ["page_snapshot", "screenshot"] as const);
	const mediaType = enumValue(record.mediaType, "evidence.mediaType", ["text/html", "image/png"] as const);
	if ((kind === "page_snapshot" && mediaType !== "text/html") || (kind === "screenshot" && mediaType !== "image/png")) {
		throw new Error("Evidence kind and media type do not match");
	}
	const sha256 = textValue(record.sha256, "evidence.sha256", 64, 64);
	if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("evidence.sha256 is invalid");
	return {
		artifactId: textValue(record.artifactId, "evidence.artifactId", 1, 100),
		kind,
		path: textValue(record.path, "evidence.path", 1, 4_096),
		mediaType,
		sha256,
		bytes: integerValue(record.bytes, "evidence.bytes", 1, 7_500_000),
	};
}

function objectValue(value: unknown, name: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
	return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, required: string[], optional: string[] = []): void {
	const allowed = new Set([...required, ...optional]);
	for (const key of Object.keys(record)) {
		if (!allowed.has(key)) throw new Error(`Broker request contains unknown field ${key}`);
	}
	for (const key of required) {
		if (!(key in record)) throw new Error(`Broker request is missing ${key}`);
	}
}

function textValue(value: unknown, name: string, minimum: number, maximum: number): string {
	if (typeof value !== "string" || value.length < minimum || value.length > maximum || value.includes("\0")) {
		throw new Error(`${name} is invalid`);
	}
	return value;
}

function integerValue(value: unknown, name: string, minimum: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		throw new Error(`${name} is invalid`);
	}
	return value as number;
}

function enumValue<const Values extends readonly string[]>(
	value: unknown,
	name: string,
	values: Values,
): Values[number] {
	if (typeof value !== "string" || !values.includes(value)) throw new Error(`${name} is invalid`);
	return value as Values[number];
}
