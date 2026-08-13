import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import path from "node:path";
import { readBrokerEvidence } from "./broker-evidence.js";
import {
	BROKER_PROTOCOL_VERSION,
	BROKER_REQUEST_MAX_BYTES,
	BROKER_RESPONSE_MAX_BYTES,
	type BrokerEvidenceDescriptor,
	type BrokerRequest,
	type BrokerSuccessResult,
	encodeBrokerFrame,
	parseBrokerResponse,
	readBrokerFrame,
} from "./broker-protocol.js";
import type {
	EvidenceCapture,
	HandoffMetadata,
	RunnerTask,
	SurfaceResponse,
	SurfaceSession,
	SurfaceSessionFactory,
} from "./contracts.js";
import { BrowserRunnerError } from "./errors.js";

type BrokerRequestInput = BrokerRequest extends infer Request
	? Request extends BrokerRequest
		? Omit<Request, "version" | "requestId">
		: never
	: never;

export interface BrokerTransport {
	request(request: BrokerRequest, timeoutMs: number): Promise<BrokerSuccessResult>;
}

export type BrokeredSurfaceSessionFactoryOptions = {
	socketPath: string;
	evidenceRoot: string;
	expectedBrowserUid: number;
	expectedRpcGid: number;
	transport?: BrokerTransport;
	evidenceReader?: (descriptor: BrokerEvidenceDescriptor) => Promise<Buffer>;
};

const OPERATION_TIMEOUT_MS = {
	create: 60_000,
	resume: 60_000,
	open: 60_000,
	prepare: 30_000,
	submit: 30_000,
	confirm: 30_000,
	collect: 210_000,
	capture: 60_000,
	handoff: 10_000,
	close: 30_000,
	release_evidence: 10_000,
} as const;

export class BrokerTransportError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "BrokerTransportError";
	}
}

export class UnixSocketBrokerTransport implements BrokerTransport {
	constructor(private readonly socketPath: string) {
		if (!socketPath.trim() || socketPath.includes("\0")) throw new Error("Broker socket path is invalid");
	}

	async request(request: BrokerRequest, timeoutMs: number): Promise<BrokerSuccessResult> {
		if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) {
			throw new Error("Broker timeout is invalid");
		}
		const frame = encodeBrokerFrame(request, BROKER_REQUEST_MAX_BYTES);
		const socket = createConnection({ path: this.socketPath, allowHalfOpen: true });
		let timeout: NodeJS.Timeout | undefined;
		try {
			const response = await Promise.race([
				new Promise<unknown>((resolve, reject) => {
					socket.once("error", reject);
					socket.once("connect", () => socket.write(frame));
					readBrokerFrame(socket, BROKER_RESPONSE_MAX_BYTES).then(resolve, reject);
				}),
				new Promise<never>((_, reject) => {
					timeout = setTimeout(
						() => reject(new BrokerTransportError(`Broker request ${request.operation} timed out`)),
						timeoutMs,
					);
				}),
			]);
			const parsed = parseBrokerResponse(response);
			if (parsed.requestId !== request.requestId) throw new BrokerTransportError("Broker response requestId mismatch");
			if (!parsed.ok) {
				throw new BrowserRunnerError(
					parsed.error.code,
					parsed.error.phase,
					parsed.error.disposition,
					parsed.error.message,
				);
			}
			return parsed.result;
		} catch (error) {
			if (error instanceof BrowserRunnerError || error instanceof BrokerTransportError) throw error;
			throw new BrokerTransportError("Broker connection failed", { cause: error });
		} finally {
			if (timeout) clearTimeout(timeout);
			socket.destroy();
		}
	}
}

export class BrokeredSurfaceSessionFactory implements SurfaceSessionFactory {
	readonly #transport: BrokerTransport;
	readonly #evidenceReader: (descriptor: BrokerEvidenceDescriptor) => Promise<Buffer>;

	constructor(options: BrokeredSurfaceSessionFactoryOptions) {
		this.#transport = options.transport ?? new UnixSocketBrokerTransport(options.socketPath);
		this.#evidenceReader =
			options.evidenceReader ??
			((descriptor) =>
				readBrokerEvidence(descriptor, {
					evidenceRoot: options.evidenceRoot,
					expectedOwnerUid: options.expectedBrowserUid,
					expectedGroupGid: options.expectedRpcGid,
				}));
	}

	async create(task: RunnerTask, attempt: number): Promise<SurfaceSession> {
		const result = await this.#request(
			{ operation: "create", task, attempt },
			OPERATION_TIMEOUT_MS.create,
			"session_open",
		);
		if (result.kind !== "session") throw invalidBrokerResult("create");
		return new BrokeredSurfaceSession(task, result.sessionId, this.#transport, this.#evidenceReader, false);
	}

	async resume(
		task: RunnerTask,
		profileDirectory: string,
		lastPageUrl: string,
		expectedSessionId: string,
	): Promise<SurfaceSession> {
		const result = await this.#request(
			{ operation: "resume", task, profileDirectory, lastPageUrl, expectedSessionId },
			OPERATION_TIMEOUT_MS.resume,
			"post_submit",
		);
		if (result.kind !== "session" || result.sessionId !== expectedSessionId) throw invalidBrokerResult("resume");
		return new BrokeredSurfaceSession(task, result.sessionId, this.#transport, this.#evidenceReader, true);
	}

	async #request(
		input: BrokerRequestInput,
		timeoutMs: number,
		phase: "session_open" | "post_submit",
	): Promise<BrokerSuccessResult> {
		const request = { ...input, version: BROKER_PROTOCOL_VERSION, requestId: randomUUID() } as BrokerRequest;
		try {
			return await this.#transport.request(request, timeoutMs);
		} catch (error) {
			if (error instanceof BrowserRunnerError) throw error;
			throw transportFailure(error, input.operation, phase);
		}
	}
}

class BrokeredSurfaceSession implements SurfaceSession {
	readonly id: string;
	readonly #task: RunnerTask;
	readonly #transport: BrokerTransport;
	readonly #evidenceReader: (descriptor: BrokerEvidenceDescriptor) => Promise<Buffer>;
	#submitted: boolean;
	#closed = false;

	constructor(
		task: RunnerTask,
		sessionId: string,
		transport: BrokerTransport,
		evidenceReader: (descriptor: BrokerEvidenceDescriptor) => Promise<Buffer>,
		resumed: boolean,
	) {
		this.#task = task;
		this.id = sessionId;
		this.#transport = transport;
		this.#evidenceReader = evidenceReader;
		this.#submitted = resumed;
	}

	async open(task: RunnerTask): Promise<void> {
		this.#assertTask(task);
		await this.#ack({ operation: "open", sessionId: this.id }, OPERATION_TIMEOUT_MS.open, "session_open");
	}

	async prepare(task: RunnerTask): Promise<void> {
		this.#assertTask(task);
		await this.#ack({ operation: "prepare", sessionId: this.id }, OPERATION_TIMEOUT_MS.prepare, "pre_submit");
	}

	async submit(promptText: string): Promise<void> {
		if (promptText !== this.#task.promptText) throw new Error("Broker submit prompt does not match the frozen prompt");
		if (this.#submitted) throw new Error("Broker session refuses a second prompt submission");
		this.#submitted = true;
		await this.#ack({ operation: "submit", sessionId: this.id, promptText }, OPERATION_TIMEOUT_MS.submit, "submit");
	}

	async confirmSubmission(promptText: string): Promise<void> {
		if (promptText !== this.#task.promptText) throw new Error("Broker confirmation does not match the frozen prompt");
		if (!this.#submitted) throw new Error("Broker session cannot confirm before submission");
		await this.#ack(
			{ operation: "confirm", sessionId: this.id, promptText },
			OPERATION_TIMEOUT_MS.confirm,
			"post_submit",
		);
	}

	async collectResponse(): Promise<SurfaceResponse> {
		const result = await this.#request(
			{ operation: "collect", sessionId: this.id },
			OPERATION_TIMEOUT_MS.collect,
			"post_submit",
		);
		if (result.kind !== "response") throw invalidBrokerResult("collect");
		return result.response;
	}

	async captureEvidence(): Promise<EvidenceCapture> {
		const result = await this.#request(
			{ operation: "capture", sessionId: this.id },
			OPERATION_TIMEOUT_MS.capture,
			"evidence",
		);
		if (result.kind !== "evidence") throw invalidBrokerResult("capture");
		const page = result.evidence.find(({ kind }) => kind === "page_snapshot");
		const screenshot = result.evidence.find(({ kind }) => kind === "screenshot");
		if (!page || !screenshot) throw invalidBrokerResult("capture");
		const pageBytes = await this.#evidenceReader(page);
		const screenshotBytes = await this.#evidenceReader(screenshot);
		await this.#ack(
			{
				operation: "release_evidence",
				sessionId: this.id,
				artifactIds: [page.artifactId, screenshot.artifactId],
			},
			OPERATION_TIMEOUT_MS.release_evidence,
			"evidence",
		);
		return { domSnapshot: pageBytes.toString("utf8"), screenshotPng: screenshotBytes };
	}

	async handoffMetadata(): Promise<
		Pick<HandoffMetadata, "sessionId" | "profileDirectory" | "lastPageUrl" | "fixture">
	> {
		const result = await this.#request(
			{ operation: "handoff", sessionId: this.id },
			OPERATION_TIMEOUT_MS.handoff,
			"post_submit",
		);
		if (result.kind !== "handoff" || result.metadata.sessionId !== this.id) throw invalidBrokerResult("handoff");
		return result.metadata;
	}

	async close(outcome: "succeeded" | "retrying" | "needs_human"): Promise<void> {
		if (this.#closed) return;
		await this.#ack(
			{ operation: "close", sessionId: this.id, outcome },
			OPERATION_TIMEOUT_MS.close,
			this.#submitted ? "post_submit" : "session_open",
		);
		this.#closed = true;
	}

	#assertTask(task: RunnerTask): void {
		if (!sameFrozenTask(task, this.#task)) throw new Error("Broker session task does not match the frozen task");
	}

	async #ack(
		input: BrokerRequestInput,
		timeoutMs: number,
		phase: "session_open" | "pre_submit" | "submit" | "post_submit" | "evidence",
	): Promise<void> {
		const result = await this.#request(input, timeoutMs, phase);
		if (result.kind !== "ack") throw invalidBrokerResult(input.operation);
	}

	async #request(
		input: BrokerRequestInput,
		timeoutMs: number,
		phase: "session_open" | "pre_submit" | "submit" | "post_submit" | "evidence",
	): Promise<BrokerSuccessResult> {
		if (this.#closed) throw new Error("Broker session is closed");
		const request = { ...input, version: BROKER_PROTOCOL_VERSION, requestId: randomUUID() } as BrokerRequest;
		try {
			return await this.#transport.request(request, timeoutMs);
		} catch (error) {
			if (error instanceof BrowserRunnerError) throw error;
			throw transportFailure(error, input.operation, phase);
		}
	}
}

export function brokeredFactoryOptionsFromEnvironment(
	environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
	currentUid = process.getuid?.(),
): BrokeredSurfaceSessionFactoryOptions {
	const socketPath = requiredEnvironmentPath(environment, "BROWSER_BROKER_SOCKET");
	const evidenceRoot = requiredEnvironmentPath(environment, "BROWSER_BROKER_EVIDENCE_DIR");
	const expectedBrowserUid = requiredEnvironmentInteger(environment, "BROWSER_BROKER_UID");
	if (currentUid !== undefined && currentUid === expectedBrowserUid) {
		throw new Error("Control and browser broker require separate UIDs");
	}
	return {
		socketPath,
		evidenceRoot,
		expectedBrowserUid,
		expectedRpcGid: requiredEnvironmentInteger(environment, "BROWSER_BROKER_RPC_GID"),
	};
}

function requiredEnvironmentPath(
	environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
	name: string,
): string {
	const value = environment[name]?.trim();
	if (!value || value.includes("\0") || !path.posix.isAbsolute(value))
		throw new Error(`${name} must be an absolute path`);
	return path.posix.normalize(value);
}

function requiredEnvironmentInteger(
	environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
	name: string,
): number {
	const value = environment[name]?.trim();
	if (!value || !/^\d+$/.test(value)) throw new Error(`${name} must be an integer`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
	return parsed;
}

function sameFrozenTask(left: RunnerTask, right: RunnerTask): boolean {
	return (
		left.id === right.id &&
		left.batchId === right.batchId &&
		left.brandId === right.brandId &&
		left.promptText === right.promptText &&
		left.surfaceTargetKey === right.surfaceTargetKey &&
		left.captureRouteKey === right.captureRouteKey &&
		left.sampleIndex === right.sampleIndex &&
		left.sessionRequirement === right.sessionRequirement &&
		left.searchRequirement === right.searchRequirement &&
		left.evaluationRole === right.evaluationRole &&
		left.minimumEvidenceArtifacts === right.minimumEvidenceArtifacts &&
		left.automationAttemptCount === right.automationAttemptCount &&
		left.leaseGeneration === right.leaseGeneration
	);
}

function transportFailure(
	error: unknown,
	operation: BrokerRequest["operation"],
	phase: "session_open" | "pre_submit" | "submit" | "post_submit" | "evidence",
): BrowserRunnerError {
	const postSubmit = phase === "submit" || phase === "post_submit";
	return new BrowserRunnerError(
		`broker_${operation}_transport_failure`,
		phase,
		postSubmit ? "recover_same_session" : phase === "evidence" ? "needs_human" : "safe_pre_submit_retry",
		postSubmit
			? "The browser broker response is unknown after durable submit intent; automatic prompt replay is forbidden"
			: "The browser broker could not complete the request",
		{ cause: error },
	);
}

function invalidBrokerResult(operation: string): BrowserRunnerError {
	return new BrowserRunnerError(
		"broker_protocol_violation",
		operation === "create" ? "session_open" : "post_submit",
		"needs_human",
		`The browser broker returned an invalid ${operation} result`,
	);
}
