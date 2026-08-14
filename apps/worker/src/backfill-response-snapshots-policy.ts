import { createHash } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_SHA = /^[0-9a-f]{40}$/u;
const SAFE_KEY = /^[a-z0-9][a-z0-9._-]{0,99}$/u;
const EXPECTED_KEYS = [
	"brandId",
	"channelsExact",
	"expectedRunCount",
	"expectedRunFingerprint",
	"fromObservedAt",
	"operation",
	"requestId",
	"runIds",
	"schemaVersion",
	"sourceCommitSha",
	"toObservedAtExclusive",
] as const;

export const BACKFILL_RESPONSE_SNAPSHOT_WRITE_SET = ["response_snapshots", "response_snapshot_outbox"] as const;

export class ResponseSnapshotBackfillPolicyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotBackfillPolicyError";
	}
}

export type ResponseSnapshotBackfillRequest = {
	schemaVersion: 1;
	operation: "backfill-response-snapshots";
	requestId: string;
	brandId: string;
	fromObservedAt: string;
	toObservedAtExclusive: string;
	channelsExact: string[];
	runIds: string[];
	expectedRunCount: number;
	expectedRunFingerprint: string;
	sourceCommitSha: string;
};

export type BackfillRunIdentity = {
	runId: string;
	brandId: string;
	promptId: string;
	scopeId: string | null;
	promptBrandId: string;
	promptScopeId: string | null;
	promptText: string;
	answerText: string | null;
	model: string;
	provider: string | null;
	version: string;
	surfaceTargetKey: string | null;
	captureRouteKey: string | null;
	webSearchEnabled: boolean;
	webQueries: string[];
	brandMentioned: boolean;
	competitorsMentioned: string[];
	observedAt: Date | null;
	attemptStatus: string | null;
	scopeMarket: string | null;
	scopeLocale: string | null;
	scopeTimezone: string | null;
};

export type BackfillCitationIdentity = {
	promptRunId: string;
	promptId: string;
	brandId: string;
	model: string;
	citationIndex: number;
	url?: string;
	title?: string | null;
	domain?: string;
};

export type PlannedResponseSnapshotBackfillRun = BackfillRunIdentity & {
	answerText: string;
	observedAt: Date;
	contentSource: "reconstructed_from_historical_run";
	captureMethod: "historical_reconstruction";
	citations: BackfillCitationIdentity[];
	sourcePayloadSha256: string;
};

export function parseResponseSnapshotBackfillCli(arguments_: string[]): {
	requestFile: string;
	sourceSha: string;
	apply: boolean;
} {
	let requestFile: string | undefined;
	let sourceSha: string | undefined;
	let apply = false;
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (argument === "--apply") {
			apply = true;
			continue;
		}
		if (argument !== "--request-file" && argument !== "--source-sha") {
			throw new ResponseSnapshotBackfillPolicyError("Unknown backfill option");
		}
		const value = arguments_[index + 1];
		if (!value || value.startsWith("--")) throw new ResponseSnapshotBackfillPolicyError(`Missing ${argument} value`);
		if (argument === "--request-file") requestFile = value;
		else sourceSha = value;
		index += 1;
	}
	if (!requestFile) throw new ResponseSnapshotBackfillPolicyError("Backfill request file is required");
	if (!sourceSha || !GIT_SHA.test(sourceSha)) {
		throw new ResponseSnapshotBackfillPolicyError("An immutable 40-character source SHA is required");
	}
	return { requestFile, sourceSha, apply };
}

export function parseResponseSnapshotBackfillRequest(value: unknown): ResponseSnapshotBackfillRequest {
	if (!isRecord(value) || !hasExactKeys(value, EXPECTED_KEYS)) {
		throw new ResponseSnapshotBackfillPolicyError("Backfill request must contain only the exact reviewed fields");
	}
	if (value.schemaVersion !== 1 || value.operation !== "backfill-response-snapshots") {
		throw new ResponseSnapshotBackfillPolicyError("Backfill request contract is invalid");
	}
	if (typeof value.requestId !== "string" || !SAFE_KEY.test(value.requestId)) {
		throw new ResponseSnapshotBackfillPolicyError("Backfill requestId is invalid");
	}
	if (value.brandId !== "stepfun") {
		throw new ResponseSnapshotBackfillPolicyError(
			"Response snapshot backfill is restricted to the reviewed StepFun brand",
		);
	}
	const from = exactTimestamp(value.fromObservedAt, "fromObservedAt");
	const to = exactTimestamp(value.toObservedAtExclusive, "toObservedAtExclusive");
	if (from >= to) throw new ResponseSnapshotBackfillPolicyError("Backfill observation window is invalid");
	if (!Array.isArray(value.channelsExact) || value.channelsExact.length < 1 || value.channelsExact.length > 20) {
		throw new ResponseSnapshotBackfillPolicyError("Backfill channelsExact is invalid");
	}
	const channelsExact = value.channelsExact.map((channel) => {
		if (typeof channel !== "string" || !SAFE_KEY.test(channel)) {
			throw new ResponseSnapshotBackfillPolicyError("Backfill channel is invalid");
		}
		return channel;
	});
	assertSortedUnique(channelsExact, "channelsExact");
	if (!Array.isArray(value.runIds) || value.runIds.length < 1 || value.runIds.length > 10_000) {
		throw new ResponseSnapshotBackfillPolicyError("Backfill runIds is invalid");
	}
	const runIds = value.runIds.map((runId) => {
		if (typeof runId !== "string" || !UUID.test(runId)) {
			throw new ResponseSnapshotBackfillPolicyError("Backfill runId is invalid");
		}
		return runId;
	});
	assertSortedUnique(runIds, "runIds");
	if (!Number.isSafeInteger(value.expectedRunCount) || value.expectedRunCount !== runIds.length) {
		throw new ResponseSnapshotBackfillPolicyError("expectedRunCount must match the exact runIds list");
	}
	if (typeof value.expectedRunFingerprint !== "string" || !SHA256.test(value.expectedRunFingerprint)) {
		throw new ResponseSnapshotBackfillPolicyError("expectedRunFingerprint is invalid");
	}
	if (typeof value.sourceCommitSha !== "string" || !GIT_SHA.test(value.sourceCommitSha)) {
		throw new ResponseSnapshotBackfillPolicyError("sourceCommitSha is invalid");
	}
	return {
		schemaVersion: 1,
		operation: "backfill-response-snapshots",
		requestId: value.requestId,
		brandId: value.brandId,
		fromObservedAt: from.toISOString(),
		toObservedAtExclusive: to.toISOString(),
		channelsExact,
		runIds,
		expectedRunCount: value.expectedRunCount,
		expectedRunFingerprint: value.expectedRunFingerprint,
		sourceCommitSha: value.sourceCommitSha,
	};
}

export function responseSnapshotBackfillFingerprint(
	runs: BackfillRunIdentity[],
	citations: BackfillCitationIdentity[],
): string {
	const citationsByRun = groupCitations(citations);
	const identity = [...runs]
		.sort((left, right) => left.runId.localeCompare(right.runId))
		.map((run) => ({
			runId: run.runId,
			brandId: run.brandId,
			promptId: run.promptId,
			scopeId: run.scopeId,
			promptBrandId: run.promptBrandId,
			promptScopeId: run.promptScopeId,
			promptTextSha256: sha256(run.promptText),
			answerTextSha256: sha256(run.answerText ?? ""),
			model: run.model,
			provider: run.provider,
			version: run.version,
			surfaceTargetKey: run.surfaceTargetKey,
			captureRouteKey: run.captureRouteKey,
			webSearchEnabled: run.webSearchEnabled,
			webQueries: run.webQueries,
			brandMentioned: run.brandMentioned,
			competitorsMentioned: run.competitorsMentioned,
			observedAt: run.observedAt?.toISOString() ?? null,
			attemptStatus: run.attemptStatus,
			scope: [run.scopeMarket, run.scopeLocale, run.scopeTimezone],
			citations: (citationsByRun.get(run.runId) ?? []).map(citationFingerprintIdentity),
		}));
	return sha256(JSON.stringify(identity));
}

export function buildResponseSnapshotBackfillPlan(
	request: ResponseSnapshotBackfillRequest,
	runs: BackfillRunIdentity[],
	citations: BackfillCitationIdentity[],
): { expectedRunCount: number; runFingerprint: string; runs: PlannedResponseSnapshotBackfillRun[] } {
	if (runs.length !== request.expectedRunCount) {
		throw new ResponseSnapshotBackfillPolicyError("Backfill did not resolve the exact expected run count");
	}
	const expectedIds = new Set(request.runIds);
	const actualIds = new Set(runs.map((run) => run.runId));
	if (
		actualIds.size !== runs.length ||
		actualIds.size !== expectedIds.size ||
		[...actualIds].some((id) => !expectedIds.has(id))
	) {
		throw new ResponseSnapshotBackfillPolicyError("Backfill did not resolve the exact run identity set");
	}
	const start = new Date(request.fromObservedAt);
	const end = new Date(request.toObservedAtExclusive);
	const channels = new Set(request.channelsExact);
	const citationsByRun = groupCitations(citations);
	const planned = runs.map((run): PlannedResponseSnapshotBackfillRun => {
		if (
			run.brandId !== request.brandId ||
			run.promptBrandId !== run.brandId ||
			run.promptScopeId !== run.scopeId ||
			!channels.has(run.model)
		) {
			throw new ResponseSnapshotBackfillPolicyError("Backfill prompt, brand, scope or channel identity mismatch");
		}
		if (run.attemptStatus !== "succeeded") {
			throw new ResponseSnapshotBackfillPolicyError("Backfill requires an existing succeeded observation attempt");
		}
		if (!run.answerText?.trim() || !run.observedAt || run.observedAt < start || run.observedAt >= end) {
			throw new ResponseSnapshotBackfillPolicyError("Backfill run content or observation window mismatch");
		}
		const runCitations = citationsByRun.get(run.runId) ?? [];
		const indexes = new Set<number>();
		for (const citation of runCitations) {
			if (
				citation.promptId !== run.promptId ||
				citation.brandId !== run.brandId ||
				citation.model !== run.model ||
				!Number.isInteger(citation.citationIndex) ||
				citation.citationIndex < 0 ||
				indexes.has(citation.citationIndex)
			) {
				throw new ResponseSnapshotBackfillPolicyError("Backfill citation identity mismatch");
			}
			indexes.add(citation.citationIndex);
		}
		return {
			...run,
			answerText: run.answerText,
			observedAt: run.observedAt,
			contentSource: "reconstructed_from_historical_run",
			captureMethod: "historical_reconstruction",
			citations: runCitations,
			sourcePayloadSha256: responseSnapshotRunSourceFingerprint(run, runCitations),
		};
	});
	const runFingerprint = responseSnapshotBackfillFingerprint(runs, citations);
	if (runFingerprint !== request.expectedRunFingerprint) {
		throw new ResponseSnapshotBackfillPolicyError("Backfill run fingerprint does not match the reviewed request");
	}
	return { expectedRunCount: request.expectedRunCount, runFingerprint, runs: planned };
}

function responseSnapshotRunSourceFingerprint(run: BackfillRunIdentity, citations: BackfillCitationIdentity[]): string {
	return sha256(
		JSON.stringify({
			runId: run.runId,
			promptText: run.promptText,
			answerText: run.answerText,
			webQueries: run.webQueries,
			citations: citations.map(citationFingerprintIdentity),
		}),
	);
}

function citationFingerprintIdentity(citation: BackfillCitationIdentity) {
	return {
		promptRunId: citation.promptRunId,
		promptId: citation.promptId,
		brandId: citation.brandId,
		model: citation.model,
		citationIndex: citation.citationIndex,
		url: citation.url ?? null,
		title: citation.title ?? null,
		domain: citation.domain ?? null,
	};
}

function groupCitations(citations: BackfillCitationIdentity[]): Map<string, BackfillCitationIdentity[]> {
	const grouped = new Map<string, BackfillCitationIdentity[]>();
	for (const citation of citations) {
		const values = grouped.get(citation.promptRunId) ?? [];
		values.push(citation);
		grouped.set(citation.promptRunId, values);
	}
	for (const values of grouped.values()) {
		values.sort((left, right) => left.citationIndex - right.citationIndex);
	}
	return grouped;
}

function exactTimestamp(value: unknown, field: string): Date {
	if (typeof value !== "string") throw new ResponseSnapshotBackfillPolicyError(`${field} is invalid`);
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
		throw new ResponseSnapshotBackfillPolicyError(`${field} must be an exact UTC ISO timestamp`);
	}
	return parsed;
}

function assertSortedUnique(values: string[], field: string): void {
	const isOutOfOrder = values.some((value, index) => {
		const previous = values[index - 1];
		return previous !== undefined && previous >= value;
	});
	if (new Set(values).size !== values.length || isOutOfOrder) {
		throw new ResponseSnapshotBackfillPolicyError(`${field} must be sorted and unique`);
	}
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Object.keys(value).sort();
	return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}
