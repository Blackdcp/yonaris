import type { CollectedAnswer } from "./adapters/contracts";
import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionClaim,
	type BrowserExtensionSurface,
	type DeviceHeartbeatInput,
	type HeartbeatResponse,
	type PairingResponse,
	PORTAL_ORIGIN,
} from "./contracts";
import type { RunnerCompletionInput, RunnerFailureInput } from "./coordinator/task-runner";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEVICE_TOKEN_PATTERN = /^yrd_[A-Za-z0-9_-]{43}$/;

export class BrowserRunnerApiError extends Error {
	constructor(
		message: string,
		public readonly status: number | null = null,
	) {
		super(message);
		this.name = "BrowserRunnerApiError";
	}
}

export class BrowserRunnerApiClient {
	private readonly origin: typeof PORTAL_ORIGIN;
	private readonly token?: string;
	private readonly fetchImplementation: (request: Request) => Promise<Response>;
	private readonly timeoutMs: number;

	constructor(input: {
		baseUrl: string;
		token?: string;
		fetch?: (request: Request) => Promise<Response>;
		timeoutMs?: number;
	}) {
		this.origin = validatePortalBaseUrl(input.baseUrl);
		if (input.token !== undefined && !DEVICE_TOKEN_PATTERN.test(input.token)) {
			throw new BrowserRunnerApiError("Browser Runner device token is invalid");
		}
		this.token = input.token;
		this.fetchImplementation = input.fetch ?? ((request) => fetch(request));
		this.timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1_000 || this.timeoutMs > 60_000) {
			throw new BrowserRunnerApiError("Browser Runner request timeout is invalid");
		}
	}

	async pair(input: { code: string; heartbeat: DeviceHeartbeatInput }): Promise<PairingResponse> {
		return this.request<PairingResponse>("/api/internal/browser-runner/v1/pair", {
			authenticated: false,
			body: { code: input.code.trim(), ...input.heartbeat },
		});
	}

	async heartbeat(input: DeviceHeartbeatInput): Promise<HeartbeatResponse> {
		return this.request<HeartbeatResponse>("/api/internal/browser-runner/v1/device/heartbeat", {
			authenticated: true,
			body: input,
		});
	}

	async claimNext(brandId: string, surface: BrowserExtensionSurface): Promise<BrowserExtensionClaim | null> {
		const response = await this.request<unknown>("/api/internal/browser-runner/v1/tasks/claim", {
			authenticated: true,
			body: { brandId, surfaceTargetKeys: [surface] },
		});
		if (!isRecord(response) || !("claim" in response)) throw invalidProtocol();
		return response.claim === null ? null : parseClaim(response.claim, surface);
	}

	async resume(taskId: string, brandId: string): Promise<BrowserExtensionClaim> {
		return parseClaim(
			await this.request<unknown>(taskPath(taskId, "resume"), { authenticated: true, body: { brandId } }),
		);
	}

	async heartbeatTask(claim: BrowserExtensionClaim): Promise<void> {
		await this.request(taskPath(claim.taskId, "heartbeat"), { authenticated: true, body: leaseBody(claim) });
	}

	async recordSubmitIntent(claim: BrowserExtensionClaim, runnerSessionId: string): Promise<void> {
		await this.request(taskPath(claim.taskId, "submit-intent"), {
			authenticated: true,
			body: { ...leaseBody(claim), runnerSessionId },
		});
	}

	async confirmSubmitted(claim: BrowserExtensionClaim, runnerSessionId: string): Promise<void> {
		await this.request(taskPath(claim.taskId, "submit-confirmed"), {
			authenticated: true,
			body: { ...leaseBody(claim), runnerSessionId },
		});
	}

	async failTask(claim: BrowserExtensionClaim, input: RunnerFailureInput): Promise<{ retryScheduled: boolean }> {
		const response = await this.request<unknown>(taskPath(claim.taskId, "failure"), {
			authenticated: true,
			body: { ...leaseBody(claim), ...input },
		});
		if (!isRecord(response) || typeof response.retryScheduled !== "boolean") throw invalidProtocol();
		return { retryScheduled: response.retryScheduled };
	}

	async uploadSnapshot(claim: BrowserExtensionClaim, html: string): Promise<string> {
		if (!html.startsWith("<!doctype html>") || new TextEncoder().encode(html).byteLength > 1_100_000) {
			throw new BrowserRunnerApiError("Browser Runner response snapshot is invalid");
		}
		const response = await this.requestRaw("/api/internal/browser-runner/v1/evidence/", {
			authenticated: true,
			body: html,
			contentType: "text/html; charset=utf-8",
			headers: {
				"X-Yonaris-Brand-Id": claim.brandId,
				"X-Yonaris-Task-Id": claim.taskId,
				"X-Yonaris-Lease-Token": claim.leaseToken,
				"X-Yonaris-Lease-Generation": String(claim.leaseGeneration),
				"X-Yonaris-Evidence-Kind": "page_snapshot",
				"X-Yonaris-Filename": encodeURIComponent(`response-${claim.taskId}.html`),
			},
		});
		const parsed = await readJson(response);
		if (!isRecord(parsed) || !isRecord(parsed.artifact)) throw invalidProtocol();
		return requiredText(parsed.artifact.id, "artifact id", 200);
	}

	async completeTask(claim: BrowserExtensionClaim, input: RunnerCompletionInput): Promise<void> {
		assertCollectedAnswer(input.answer);
		await this.request(taskPath(claim.taskId, "complete"), {
			authenticated: true,
			body: {
				...leaseBody(claim),
				runnerSessionId: input.runnerSessionId,
				adapterVersion: input.adapterVersion,
				browserVersion: input.browserVersion,
				observation: {
					answerText: input.answer.answerText,
					answerHtml: input.answer.answerHtml,
					observedAt: input.answer.observedAt,
					pageUrl: input.answer.pageUrl,
					sessionMode: "dedicated_sampling_profile",
					searchMode: "native_auto",
					webSearchObserved: input.answer.webSearchObserved,
					evidenceArtifactIds: [input.evidenceArtifactId],
					citations: input.answer.citations,
					webQueries: input.answer.webQueries,
				},
			},
		});
	}

	private async request<T>(path: string, input: { authenticated: boolean; body: unknown }): Promise<T> {
		const response = await this.requestRaw(path, {
			...input,
			body: JSON.stringify(input.body),
			contentType: "application/json",
		});
		return (await readJson(response)) as T;
	}

	private async requestRaw(
		path: string,
		input: {
			authenticated: boolean;
			body: BodyInit;
			contentType: string;
			headers?: Record<string, string>;
		},
	): Promise<Response> {
		const url = new URL(path, this.origin);
		if (url.origin !== this.origin) throw new BrowserRunnerApiError("Browser Runner request escaped the Portal origin");
		const headers = new Headers({
			Accept: "application/json",
			"Cache-Control": "no-store",
			"Content-Type": input.contentType,
			...input.headers,
		});
		if (input.authenticated) {
			if (!this.token) throw new BrowserRunnerApiError("Browser Runner device is not paired");
			headers.set("Authorization", `Bearer ${this.token}`);
		}
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetchImplementation(
				new Request(url, {
					method: "POST",
					headers,
					body: input.body,
					redirect: "error",
					cache: "no-store",
					credentials: "omit",
					signal: controller.signal,
				}),
			);
			if (!response.ok) {
				throw new BrowserRunnerApiError(`Portal request failed with status ${response.status}`, response.status);
			}
			return response;
		} catch (error) {
			if (error instanceof BrowserRunnerApiError) throw error;
			if (controller.signal.aborted) throw new BrowserRunnerApiError("Portal request timed out");
			throw new BrowserRunnerApiError("Portal request failed");
		} finally {
			clearTimeout(timeout);
		}
	}
}

function parseClaim(value: unknown, expectedSurface?: BrowserExtensionSurface): BrowserExtensionClaim {
	if (!isRecord(value) || !isRecord(value.task)) throw invalidProtocol();
	const task = value.task;
	const surfaceTargetKey = requiredSurface(task.surfaceTargetKey);
	if (expectedSurface && surfaceTargetKey !== expectedSurface) throw invalidProtocol();
	const expectedRoute =
		surfaceTargetKey === "doubao.consumer_web" ? "browser_extension.doubao" : "browser_extension.deepseek";
	const expectedLaunch =
		surfaceTargetKey === "doubao.consumer_web" ? "https://www.doubao.com/chat/" : "https://chat.deepseek.com/";
	if (
		task.captureRouteKey !== expectedRoute ||
		task.launchUrl !== expectedLaunch ||
		task.sessionRequirement !== "dedicated_sampling_profile" ||
		task.searchRequirement !== "platform_default" ||
		task.evaluationRole !== "scored" ||
		task.minimumEvidenceArtifacts !== 1
	) {
		throw invalidProtocol();
	}
	const leaseExpiresAt = requiredText(value.leaseExpiresAt, "lease expiry", 50);
	if (!Number.isFinite(Date.parse(leaseExpiresAt))) throw invalidProtocol();
	const runnerSessionId =
		value.runnerSessionId === null ? null : requiredText(value.runnerSessionId, "session id", 300);
	return {
		taskId: requiredText(task.id, "task id", 200),
		batchId: requiredText(task.batchId, "batch id", 200),
		brandId: requiredText(task.brandId, "brand id", 300),
		scopeId: requiredText(task.scopeId, "scope id", 200),
		promptId: requiredText(task.promptId, "prompt id", 200),
		promptText: requiredText(task.promptText, "prompt", 20_000),
		sampleIndex: positiveInteger(task.sampleIndex),
		surfaceTargetKey,
		captureRouteKey: expectedRoute,
		launchUrl: expectedLaunch,
		sessionRequirement: "dedicated_sampling_profile",
		searchRequirement: "platform_default",
		evaluationRole: "scored",
		minimumEvidenceArtifacts: 1,
		automationAttemptCount: positiveInteger(task.automationAttemptCount),
		leaseToken: requiredText(value.leaseToken, "lease token", 500),
		leaseGeneration: positiveInteger(value.leaseGeneration),
		leaseExpiresAt,
		postSubmitAssist: requiredBoolean(value.postSubmitAssist),
		submitConfirmed: requiredBoolean(value.submitConfirmed),
		runnerSessionId,
	};
}

function leaseBody(claim: BrowserExtensionClaim) {
	return { brandId: claim.brandId, leaseToken: claim.leaseToken, leaseGeneration: claim.leaseGeneration };
}

function taskPath(taskId: string, action: string): string {
	return `/api/internal/browser-runner/v1/tasks/${encodeURIComponent(taskId)}/${action}`;
}

function assertCollectedAnswer(answer: CollectedAnswer): void {
	if (!answer.answerText.trim() || !answer.answerHtml.trim() || !Number.isFinite(Date.parse(answer.observedAt))) {
		throw new BrowserRunnerApiError("Browser Runner answer is invalid");
	}
	const pageUrl = new URL(answer.pageUrl);
	if (pageUrl.protocol !== "https:") throw new BrowserRunnerApiError("Browser Runner answer URL is invalid");
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw invalidProtocol();
	}
}

function requiredSurface(value: unknown): BrowserExtensionSurface {
	if (typeof value !== "string" || !(BROWSER_EXTENSION_SURFACES as readonly string[]).includes(value)) {
		throw invalidProtocol();
	}
	return value as BrowserExtensionSurface;
}

function requiredText(value: unknown, label: string, maximum: number): string {
	if (typeof value !== "string" || !value.trim() || value.length > maximum) {
		throw new BrowserRunnerApiError(`Browser Runner ${label} is invalid`);
	}
	return value;
}

function positiveInteger(value: unknown): number {
	if (!Number.isSafeInteger(value) || (value as number) < 1) throw invalidProtocol();
	return value as number;
}

function requiredBoolean(value: unknown): boolean {
	if (typeof value !== "boolean") throw invalidProtocol();
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidProtocol(): BrowserRunnerApiError {
	return new BrowserRunnerApiError("Browser Runner Portal response violates the extension protocol");
}

export function validatePortalBaseUrl(value: string): typeof PORTAL_ORIGIN {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new BrowserRunnerApiError("Portal base URL is invalid");
	}
	if (url.origin !== PORTAL_ORIGIN || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
		throw new BrowserRunnerApiError(`Portal base URL must be exactly ${PORTAL_ORIGIN}`);
	}
	return PORTAL_ORIGIN;
}
