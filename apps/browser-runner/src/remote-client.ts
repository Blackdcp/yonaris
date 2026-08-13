import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
	ClaimedRunnerTask,
	ClaimedTaskSource,
	ObservationSink,
	RunnerPhase,
	RunnerTask,
	SuccessfulRunnerObservation,
} from "./contracts.js";
import { BrowserRunnerError, sanitizeDiagnostic } from "./errors.js";
import { RUNNER_EVIDENCE_MAX_BYTES } from "./evidence.js";

// The completion endpoint alone accepts 2 MiB; all other internal JSON
// endpoints retain the server's 1 MiB default.
export const RUNNER_INTERNAL_JSON_MAX_BYTES = 2 * 1024 * 1024;

type RemoteClientOptions = {
	baseUrl: string;
	apiToken: string;
	brandId: string;
	batchId?: string;
	adapterVersion?: string;
	fetchImplementation?: typeof fetch;
};

type ActiveClaim = ClaimedRunnerTask & { task: RunnerTask };

export class BrowserRunnerRemoteClient implements ClaimedTaskSource, ObservationSink {
	readonly retainLocalArtifacts = false;
	readonly #baseUrl: URL;
	readonly #apiToken: string;
	readonly #brandId: string;
	readonly #defaultBatchId?: string;
	readonly #adapterVersion: string;
	readonly #fetch: typeof fetch;
	readonly #activeClaims = new Map<string, ActiveClaim>();
	readonly #pendingClaims: ActiveClaim[] = [];
	#queueState: "settled" | "drained" | "waiting" | "unknown" = "unknown";

	constructor(options: RemoteClientOptions) {
		this.#baseUrl = validBaseUrl(options.baseUrl);
		this.#apiToken = requiredSecret(options.apiToken);
		this.#brandId = requiredText(options.brandId, "brandId", 300);
		this.#defaultBatchId = options.batchId;
		this.#adapterVersion = options.adapterVersion ?? "doubao-runner-v1-fixture-verified-live-disabled";
		this.#fetch = options.fetchImplementation ?? fetch;
	}

	async claimNext(batchId = this.#defaultBatchId): Promise<ClaimedRunnerTask | null> {
		const pendingIndex = this.#pendingClaims.findIndex((claim) => !batchId || claim.task.batchId === batchId);
		if (pendingIndex >= 0) return this.#pendingClaims.splice(pendingIndex, 1)[0] ?? null;
		const response = await this.#json<{ claim: unknown; queueState?: unknown }>("tasks/claim", {
			method: "POST",
			body: { brandId: this.#brandId, ...(batchId ? { batchId } : {}), surfaceTargetKeys: ["doubao.consumer_web"] },
		});
		this.#queueState = parseQueueState(response.queueState);
		if (response.claim === null) return null;
		const claimed = parseClaim(response.claim);
		this.#activeClaims.set(claimed.task.id, claimed);
		return claimed;
	}

	queueState() {
		return this.#queueState;
	}

	async resume(taskId: string): Promise<ClaimedRunnerTask> {
		const response = await this.#json<{ claim: unknown }>(`tasks/${encodeURIComponent(taskId)}/resume`, {
			method: "POST",
			body: { brandId: this.#brandId },
		});
		const claimed = parseClaim(response.claim);
		if (claimed.task.id !== taskId) throw new Error("Resume API returned a different task");
		if (!claimed.postSubmitAssist || !claimed.runnerSessionId) {
			throw new Error("Resume API did not return a durable post-submit session");
		}
		this.#activeClaims.set(claimed.task.id, claimed);
		return claimed;
	}

	async retryPreSubmit(claimed: ClaimedRunnerTask, reason: { code: string; message: string }) {
		const result = await this.#failure(claimed, {
			stage: "pre_submit",
			code: reason.code,
			reason: reason.message,
		});
		this.#activeClaims.delete(claimed.task.id);
		if (!result.retryScheduled) return { state: "needs_human" as const };
		const reclaimed = await this.claimNext(claimed.task.batchId);
		if (!reclaimed) return { state: "queued" as const };
		if (reclaimed.task.id !== claimed.task.id) {
			this.#pendingClaims.push(reclaimed as ActiveClaim);
			return { state: "queued" as const };
		}
		return { state: "reclaimed" as const, claimed: reclaimed };
	}

	async heartbeat(claimed: ClaimedRunnerTask): Promise<void> {
		await this.#leaseRequest(claimed, "heartbeat");
	}

	async recordSubmitIntent(claimed: ClaimedRunnerTask, input: { sessionId: string }): Promise<void> {
		await this.#sessionLeaseRequest(claimed, "submit-intent", input.sessionId);
	}

	async confirmPromptSubmitted(claimed: ClaimedRunnerTask, input: { sessionId: string }): Promise<void> {
		await this.#sessionLeaseRequest(claimed, "submit-confirmed", input.sessionId);
	}

	async markNeedsHuman(
		claimed: ClaimedRunnerTask,
		reason: { code: string; message: string; phase: RunnerPhase },
	): Promise<void> {
		const stage = reason.phase === "session_open" || reason.phase === "pre_submit" ? "pre_submit" : "post_submit";
		const result = await this.#failure(claimed, { stage, code: reason.code, reason: reason.message });
		this.#activeClaims.delete(claimed.task.id);
		if (result.retryScheduled) {
			throw new BrowserRunnerError(
				"server_requeued_nonretryable_failure",
				"persist",
				"needs_human",
				"The server requeued a failure that the adapter classified as requiring human intervention",
			);
		}
	}

	async submit(observation: SuccessfulRunnerObservation): Promise<void> {
		const claimed = this.#activeClaims.get(observation.task.id);
		if (!claimed?.claim) throw new Error(`No active remote claim exists for task ${observation.task.id}`);
		const screenshot = observation.evidence.find(({ kind }) => kind === "screenshot");
		const pageSnapshot = observation.evidence.find(({ kind }) => kind === "page_snapshot");
		if (!screenshot || !pageSnapshot) {
			throw new Error("A Browser Runner observation requires both screenshot and page snapshot evidence");
		}
		const evidence = [] as Array<{ id: string }>;
		for (const item of [screenshot, pageSnapshot]) {
			const content = await readFile(item.path);
			if (content.byteLength === 0 || content.byteLength > RUNNER_EVIDENCE_MAX_BYTES) {
				throw new Error(`${item.kind} evidence is empty or exceeds ${RUNNER_EVIDENCE_MAX_BYTES} bytes`);
			}
			const digest = createHash("sha256").update(content).digest("hex");
			if (digest !== item.sha256) throw new Error(`${item.kind} evidence changed after capture`);
			evidence.push(
				await this.#uploadEvidence(claimed, {
					content,
					kind: item.kind,
					fileName: path.basename(item.path),
					mediaType: item.mediaType,
				}),
			);
		}
		const minimumEvidenceArtifacts = claimed.task.minimumEvidenceArtifacts ?? 2;
		if (minimumEvidenceArtifacts > evidence.length) {
			throw new Error(
				`The frozen task requires ${minimumEvidenceArtifacts} evidence artifacts, but only ${evidence.length} are available`,
			);
		}
		const completionBody = {
			...this.#leaseBody(claimed),
			runnerSessionId: observation.sessionId,
			adapterVersion: this.#adapterVersion,
			browserVersion: observation.response.browserVersion ?? "playwright-chromium-unreported",
			observation: {
				answerText: observation.response.answerText,
				observedAt: observation.response.observedAt,
				pageUrl: observation.response.pageUrl,
				sessionMode: observation.sessionMode,
				searchMode: observation.searchMode,
				webSearchObserved: observation.webSearchObserved,
				...(observation.response.modelVersion ? { modelVersion: observation.response.modelVersion } : {}),
				evidenceArtifactIds: evidence.map(({ id }) => id),
				citations: observation.response.citations,
				webQueries: observation.response.webQueries,
			},
		};
		assertRunnerCompletePayloadWithinLimit(completionBody);
		await this.#json(`tasks/${encodeURIComponent(claimed.task.id)}/complete`, {
			method: "POST",
			body: completionBody,
		});
		this.#activeClaims.delete(observation.task.id);
	}

	async #leaseRequest(claimed: ClaimedRunnerTask, operation: string): Promise<void> {
		await this.#json(`tasks/${encodeURIComponent(claimed.task.id)}/${operation}`, {
			method: "POST",
			body: this.#leaseBody(claimed),
		});
	}

	async #sessionLeaseRequest(claimed: ClaimedRunnerTask, operation: string, runnerSessionId: string): Promise<void> {
		await this.#json(`tasks/${encodeURIComponent(claimed.task.id)}/${operation}`, {
			method: "POST",
			body: { ...this.#leaseBody(claimed), runnerSessionId: requiredText(runnerSessionId, "runnerSessionId", 300) },
		});
	}

	async #failure(
		claimed: ClaimedRunnerTask,
		failure: { stage: "pre_submit" | "post_submit"; code: string; reason: string },
	): Promise<{ retryScheduled: boolean }> {
		return this.#json(`tasks/${encodeURIComponent(claimed.task.id)}/failure`, {
			method: "POST",
			body: { ...this.#leaseBody(claimed), ...failure },
		});
	}

	#leaseBody(claimed: ClaimedRunnerTask) {
		if (!claimed.claim) throw new Error(`Remote task ${claimed.task.id} has no lease`);
		return {
			brandId: claimed.task.brandId,
			leaseToken: claimed.claim.leaseToken,
			leaseGeneration: claimed.claim.leaseGeneration,
		};
	}

	async #uploadEvidence(
		claimed: ClaimedRunnerTask,
		input: {
			content: Uint8Array;
			kind: "screenshot" | "page_snapshot";
			fileName: string;
			mediaType: "image/png" | "text/html";
		},
	): Promise<{ id: string }> {
		if (!claimed.claim) throw new Error(`Remote task ${claimed.task.id} has no lease`);
		const response = await this.#request("evidence/", {
			method: "POST",
			headers: {
				"Content-Type": input.mediaType,
				"X-Yonaris-Brand-Id": claimed.task.brandId,
				"X-Yonaris-Task-Id": claimed.task.id,
				"X-Yonaris-Lease-Token": claimed.claim.leaseToken,
				"X-Yonaris-Lease-Generation": String(claimed.claim.leaseGeneration),
				"X-Yonaris-Evidence-Kind": input.kind,
				"X-Yonaris-Filename": encodeURIComponent(input.fileName),
			},
			body: new Blob([Uint8Array.from(input.content).buffer], { type: input.mediaType }),
		});
		const body = (await response.json()) as { artifact?: { id?: unknown } };
		if (typeof body.artifact?.id !== "string") throw new Error("Evidence API returned an invalid artifact id");
		return { id: body.artifact.id };
	}

	async #json<T = unknown>(endpoint: string, input: { method: "POST"; body: unknown }): Promise<T> {
		const response = await this.#request(endpoint, {
			method: input.method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input.body),
		});
		return (await response.json()) as T;
	}

	async #request(
		endpoint: string,
		input: { method: "POST"; headers?: Record<string, string>; body: BodyInit },
	): Promise<Response> {
		let response: Response;
		try {
			response = await this.#fetch(new URL(endpoint, this.#baseUrl), {
				method: input.method,
				headers: { Authorization: `Bearer ${this.#apiToken}`, ...input.headers },
				body: input.body,
				redirect: "error",
				signal: AbortSignal.timeout(30_000),
			});
		} catch (cause) {
			throw new BrowserRunnerError(
				"runner_api_unreachable",
				"persist",
				"needs_human",
				"Browser Runner API request failed",
				{
					cause,
				},
			);
		}
		if (!response.ok) {
			const message = sanitizeDiagnostic((await response.text()).slice(0, 1_000));
			throw new BrowserRunnerError(
				`runner_api_http_${response.status}`,
				"persist",
				"needs_human",
				`Browser Runner API rejected the request (${response.status}): ${message}`,
			);
		}
		return response;
	}
}

export function assertRunnerCompletePayloadWithinLimit(payload: unknown): void {
	const byteLength = Buffer.byteLength(JSON.stringify(payload), "utf8");
	if (byteLength <= RUNNER_INTERNAL_JSON_MAX_BYTES) return;
	throw new BrowserRunnerError(
		"answer_payload_too_large",
		"post_submit",
		"needs_human",
		`The UTF-8 completion payload exceeds the server's ${RUNNER_INTERNAL_JSON_MAX_BYTES}-byte JSON limit`,
	);
}

function parseClaim(value: unknown): ActiveClaim {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Claim API returned an invalid claim");
	const row = value as Record<string, unknown>;
	if (!row.task || typeof row.task !== "object" || Array.isArray(row.task))
		throw new Error("Claim API returned no task");
	const task = row.task as Record<string, unknown>;
	if (task.surfaceTargetKey !== "doubao.consumer_web" || task.captureRouteKey !== "browser_runner.doubao") {
		throw new Error("Claim API returned a task outside the Doubao Browser Runner route");
	}
	if (task.searchRequirement !== "forbidden" && task.searchRequirement !== "platform_default")
		throw new Error("Doubao Browser Runner requires searchRequirement=forbidden or platform_default");
	if (
		task.sessionRequirement !== "anonymous_clean" &&
		task.sessionRequirement !== "new_account_clean" &&
		task.sessionRequirement !== "dedicated_sampling_profile"
	) {
		throw new Error("Claim API returned an unsupported session requirement");
	}
	if (task.evaluationRole !== "scored" && task.evaluationRole !== "observation") {
		throw new Error("Claim API returned an unsupported evaluation role");
	}
	const runnerTask: RunnerTask = {
		id: readText(task.id, "task.id"),
		batchId: readText(task.batchId, "task.batchId"),
		brandId: readText(task.brandId, "task.brandId"),
		promptText: readText(task.promptText, "task.promptText", 500_000),
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "browser_runner.doubao",
		sampleIndex: readPositiveInteger(task.sampleIndex, "task.sampleIndex"),
		sessionRequirement: task.sessionRequirement,
		searchRequirement: task.searchRequirement,
		evaluationRole: task.evaluationRole,
		minimumEvidenceArtifacts: readPositiveInteger(task.minimumEvidenceArtifacts, "task.minimumEvidenceArtifacts"),
		automationAttemptCount: readPositiveInteger(task.automationAttemptCount, "task.automationAttemptCount"),
		leaseGeneration: readPositiveInteger(row.leaseGeneration, "leaseGeneration"),
	};
	return {
		task: runnerTask,
		submitConfirmed: row.submitConfirmed === true,
		postSubmitAssist: row.postSubmitAssist === true,
		runnerSessionId:
			row.runnerSessionId === null || row.runnerSessionId === undefined
				? null
				: readText(row.runnerSessionId, "runnerSessionId", 300),
		claim: {
			leaseToken: readText(row.leaseToken, "leaseToken"),
			leaseGeneration: readPositiveInteger(row.leaseGeneration, "leaseGeneration"),
		},
	};
}

function validBaseUrl(value: string): URL {
	const url = new URL(value);
	const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
	if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
		throw new Error("Browser Runner API URL must use HTTPS (HTTP is allowed only on localhost)");
	}
	url.pathname = `${url.pathname.replace(/\/$/, "")}/api/internal/browser-runner/v1/`;
	url.search = "";
	url.hash = "";
	return url;
}

function requiredSecret(value: string): string {
	const normalized = value.trim();
	if (normalized.length < 32) throw new Error("BROWSER_RUNNER_API_TOKEN must contain at least 32 characters");
	return normalized;
}

function requiredText(value: string, field: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) throw new Error(`${field} is invalid`);
	return normalized;
}

function readText(value: unknown, field: string, maximum = 10_000): string {
	if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is invalid`);
	const normalized = value.trim();
	if (normalized.length > maximum) throw new Error(`${field} is too long`);
	return normalized;
}

function readPositiveInteger(value: unknown, field: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`${field} is invalid`);
	return value as number;
}

function parseQueueState(value: unknown): "settled" | "drained" | "waiting" | "unknown" {
	if (value === "settled" || value === "drained" || value === "waiting") return value;
	return "unknown";
}
