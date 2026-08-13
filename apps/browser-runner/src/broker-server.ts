import { createHash, randomUUID } from "node:crypto";
import { lstat, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import type { BrokerEvidenceDescriptor, BrokerRequest, BrokerResponse } from "./broker-protocol.js";
import type {
	EvidenceCapture,
	RunnerTask,
	SurfaceResponse,
	SurfaceSession,
	SurfaceSessionFactory,
} from "./contracts.js";
import { BrowserRunnerError, normalizeRunnerError } from "./errors.js";

export interface BrokerSessionFactory extends SurfaceSessionFactory {
	resume(
		task: RunnerTask,
		profileDirectory: string,
		lastPageUrl: string,
		expectedSessionId: string,
	): Promise<SurfaceSession>;
}

export interface BrokerEvidenceStoreContract {
	capture(sessionId: string, capture: EvidenceCapture): Promise<BrokerEvidenceDescriptor[]>;
	release(sessionId: string, artifactIds: string[]): Promise<void>;
}

type SessionState =
	| "created"
	| "opened"
	| "prepared"
	| "submit_unknown"
	| "submitted"
	| "confirmed"
	| "collected"
	| "captured";

type ActiveSession = {
	task: RunnerTask;
	session: SurfaceSession;
	state: SessionState;
	submitStarted: boolean;
	response?: SurfaceResponse;
	evidence?: BrokerEvidenceDescriptor[];
};

export class BrokerService {
	readonly #sessionFactory: BrokerSessionFactory;
	readonly #evidenceStore: BrokerEvidenceStoreContract;
	readonly #sessions = new Map<string, ActiveSession>();
	#operationTail: Promise<void> = Promise.resolve();

	constructor(options: { sessionFactory: BrokerSessionFactory; evidenceStore: BrokerEvidenceStoreContract }) {
		this.#sessionFactory = options.sessionFactory;
		this.#evidenceStore = options.evidenceStore;
	}

	handle(request: BrokerRequest): Promise<BrokerResponse> {
		const response = this.#operationTail.then(() => this.#handleSerial(request));
		this.#operationTail = response.then(
			() => undefined,
			() => undefined,
		);
		return response;
	}

	async #handleSerial(request: BrokerRequest): Promise<BrokerResponse> {
		try {
			const result = await this.#dispatch(request);
			return { version: 1, requestId: request.requestId, ok: true, result };
		} catch (error) {
			const normalized =
				error instanceof BrowserRunnerError ? error : normalizeRunnerError(error, phaseForOperation(request.operation));
			return {
				version: 1,
				requestId: request.requestId,
				ok: false,
				error: {
					code: normalized.code,
					phase: normalized.phase,
					disposition: normalized.disposition,
					message: normalized.message,
				},
			};
		}
	}

	async #dispatch(request: BrokerRequest) {
		switch (request.operation) {
			case "ping":
				return { kind: "pong" as const };
			case "create":
				return this.#create(request.task, request.attempt);
			case "resume":
				return this.#resume(request.task, request.profileDirectory, request.lastPageUrl, request.expectedSessionId);
			case "open": {
				const active = this.#active(request.sessionId);
				if (active.state === "opened") return { kind: "ack" as const };
				this.#requireState(active, ["created"]);
				await active.session.open(active.task);
				active.state = "opened";
				return { kind: "ack" as const };
			}
			case "prepare": {
				const active = this.#active(request.sessionId);
				if (active.state === "prepared") return { kind: "ack" as const };
				this.#requireState(active, ["opened"]);
				await active.session.prepare(active.task);
				active.state = "prepared";
				return { kind: "ack" as const };
			}
			case "submit": {
				const active = this.#active(request.sessionId);
				if (request.promptText !== active.task.promptText) {
					throw new BrowserRunnerError(
						"broker_frozen_prompt_mismatch",
						"submit",
						"needs_human",
						"The broker prompt does not match the frozen task",
					);
				}
				if (active.submitStarted) {
					throw new BrowserRunnerError(
						"broker_duplicate_submit",
						"submit",
						"needs_human",
						"The browser broker refuses a second prompt submission",
					);
				}
				this.#requireState(active, ["prepared"]);
				active.submitStarted = true;
				active.state = "submit_unknown";
				await active.session.submit(request.promptText);
				active.state = "submitted";
				return { kind: "ack" as const };
			}
			case "confirm": {
				const active = this.#active(request.sessionId);
				if (request.promptText !== active.task.promptText) {
					throw new BrowserRunnerError(
						"broker_frozen_prompt_mismatch",
						"post_submit",
						"needs_human",
						"The broker confirmation does not match the frozen task",
					);
				}
				if (active.state === "confirmed") return { kind: "ack" as const };
				this.#requireState(active, ["submit_unknown", "submitted"]);
				await active.session.confirmSubmission(request.promptText);
				active.state = "confirmed";
				return { kind: "ack" as const };
			}
			case "collect": {
				const active = this.#active(request.sessionId);
				if (active.response) return { kind: "response" as const, response: active.response };
				this.#requireState(active, ["submit_unknown", "submitted", "confirmed"]);
				active.response = await active.session.collectResponse();
				active.state = "collected";
				return { kind: "response" as const, response: active.response };
			}
			case "capture": {
				const active = this.#active(request.sessionId);
				if (active.evidence) return { kind: "evidence" as const, evidence: active.evidence };
				this.#requireState(active, ["collected"]);
				active.evidence = await this.#evidenceStore.capture(active.session.id, await active.session.captureEvidence());
				active.state = "captured";
				return { kind: "evidence" as const, evidence: active.evidence };
			}
			case "release_evidence": {
				const active = this.#active(request.sessionId);
				if (!active.evidence) throw sequenceViolation();
				const expected = active.evidence.map(({ artifactId }) => artifactId).sort();
				if (JSON.stringify([...request.artifactIds].sort()) !== JSON.stringify(expected)) {
					throw new BrowserRunnerError(
						"broker_evidence_identity_mismatch",
						"evidence",
						"needs_human",
						"Evidence release identifiers do not match the captured artifacts",
					);
				}
				await this.#evidenceStore.release(active.session.id, request.artifactIds);
				active.evidence = undefined;
				return { kind: "ack" as const };
			}
			case "handoff": {
				const active = this.#active(request.sessionId);
				const metadata = await active.session.handoffMetadata();
				if (metadata.sessionId !== active.session.id || metadata.fixture) {
					throw new BrowserRunnerError(
						"broker_session_identity_mismatch",
						"post_submit",
						"needs_human",
						"The browser broker handoff identity is invalid",
					);
				}
				return { kind: "handoff" as const, metadata: { ...metadata, fixture: false as const } };
			}
			case "close": {
				const active = this.#active(request.sessionId);
				await active.session.close(request.outcome);
				this.#sessions.delete(active.session.id);
				return { kind: "ack" as const };
			}
		}
	}

	async #create(task: RunnerTask, attempt: number) {
		void attempt;
		const existing = [...this.#sessions.values()].find(({ task: current }) => sameFrozenTask(current, task));
		if (existing) return { kind: "session" as const, sessionId: existing.session.id };
		if (this.#sessions.size > 0) {
			throw new BrowserRunnerError(
				"dedicated_profile_busy",
				"session_open",
				"needs_human",
				"The browser broker already owns an active session",
			);
		}
		const session = await this.#sessionFactory.create(task, attempt);
		this.#sessions.set(session.id, { task, session, state: "created", submitStarted: false });
		return { kind: "session" as const, sessionId: session.id };
	}

	async #resume(task: RunnerTask, profileDirectory: string, lastPageUrl: string, expectedSessionId: string) {
		const existing = this.#sessions.get(expectedSessionId);
		if (existing) {
			if (!sameFrozenTask(existing.task, task)) throw sequenceViolation();
			return { kind: "session" as const, sessionId: existing.session.id };
		}
		if (this.#sessions.size > 0) throw sequenceViolation();
		const session = await this.#sessionFactory.resume(task, profileDirectory, lastPageUrl, expectedSessionId);
		if (session.id !== expectedSessionId) throw sequenceViolation();
		this.#sessions.set(session.id, { task, session, state: "submitted", submitStarted: true });
		return { kind: "session" as const, sessionId: session.id };
	}

	#active(sessionId: string): ActiveSession {
		const active = this.#sessions.get(sessionId);
		if (!active) throw sequenceViolation();
		return active;
	}

	#requireState(active: ActiveSession, allowed: SessionState[]): void {
		if (!allowed.includes(active.state)) throw sequenceViolation();
	}
}

export class BrokerEvidenceStore implements BrokerEvidenceStoreContract {
	readonly #root: string;
	readonly #expectedBrowserUid: number;
	readonly #expectedRpcGid: number;
	readonly #artifacts = new Map<string, Map<string, string>>();

	constructor(options: { evidenceRoot: string; expectedBrowserUid: number; expectedRpcGid: number }) {
		this.#root = path.resolve(options.evidenceRoot);
		this.#expectedBrowserUid = options.expectedBrowserUid;
		this.#expectedRpcGid = options.expectedRpcGid;
	}

	async capture(sessionId: string, capture: EvidenceCapture): Promise<BrokerEvidenceDescriptor[]> {
		await this.#assertRoot();
		const pageBytes = Buffer.from(capture.domSnapshot, "utf8");
		const screenshotBytes = Buffer.from(capture.screenshotPng);
		if (
			pageBytes.byteLength <= 0 ||
			screenshotBytes.byteLength <= 0 ||
			pageBytes.byteLength > 7_500_000 ||
			screenshotBytes.byteLength > 7_500_000 ||
			pageBytes.byteLength + screenshotBytes.byteLength > 15_000_000
		) {
			throw new BrowserRunnerError(
				"broker_evidence_too_large",
				"evidence",
				"needs_human",
				"Broker evidence is empty or exceeds the bounded handoff size",
			);
		}
		const descriptors: BrokerEvidenceDescriptor[] = [];
		try {
			descriptors.push(await this.#seal(sessionId, "page_snapshot", "text/html", "html", pageBytes));
			descriptors.push(await this.#seal(sessionId, "screenshot", "image/png", "png", screenshotBytes));
			this.#artifacts.set(sessionId, new Map(descriptors.map(({ artifactId, path }) => [artifactId, path])));
			return descriptors;
		} catch (error) {
			await Promise.all(descriptors.map(({ path: filePath }) => unlink(filePath).catch(() => undefined)));
			throw error;
		}
	}

	async release(sessionId: string, artifactIds: string[]): Promise<void> {
		const artifacts = this.#artifacts.get(sessionId);
		if (!artifacts || artifactIds.some((artifactId) => !artifacts.has(artifactId))) {
			throw new Error("Broker evidence release identity is invalid");
		}
		for (const artifactId of artifactIds) {
			const filePath = artifacts.get(artifactId);
			if (!filePath) throw new Error("Broker evidence release identity is invalid");
			const fileStat = await lstat(filePath);
			if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.nlink !== 1) {
				throw new Error("Broker evidence file is unsafe to release");
			}
			await unlink(filePath);
			artifacts.delete(artifactId);
		}
		if (artifacts.size === 0) this.#artifacts.delete(sessionId);
	}

	async #seal(
		sessionId: string,
		kind: "page_snapshot" | "screenshot",
		mediaType: "text/html" | "image/png",
		extension: string,
		content: Buffer,
	): Promise<BrokerEvidenceDescriptor> {
		const artifactId = randomUUID();
		const prefix = createHash("sha256").update(sessionId).digest("hex").slice(0, 20);
		const finalPath = path.join(this.#root, `${prefix}-${artifactId}.${extension}`);
		const temporaryPath = `${finalPath}.tmp`;
		const handle = await open(temporaryPath, "wx", 0o640);
		try {
			await handle.writeFile(content);
			await handle.sync();
			await handle.chmod(0o640);
		} finally {
			await handle.close();
		}
		await rename(temporaryPath, finalPath);
		return {
			artifactId,
			kind,
			path: finalPath,
			mediaType,
			sha256: createHash("sha256").update(content).digest("hex"),
			bytes: content.byteLength,
		};
	}

	async #assertRoot(): Promise<void> {
		const rootStat = await lstat(this.#root);
		if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Broker evidence root is unsafe");
		if (process.platform !== "win32") {
			if (rootStat.uid !== this.#expectedBrowserUid || rootStat.gid !== this.#expectedRpcGid) {
				throw new Error("Broker evidence root owner is invalid");
			}
			if ((rootStat.mode & 0o777) !== 0o750) throw new Error("Broker evidence root mode must be 0750");
		}
	}
}

const FORBIDDEN_BROWSER_ENVIRONMENT = [
	"BROWSER_RUNNER_API_TOKEN",
	"DATABASE_URL",
	"ADMIN_API_KEYS",
	"BETTER_AUTH_SECRET",
	"ELMO_ENCRYPTION_KEY",
] as const;

export function assertBrokerEnvironmentSafe(environment: NodeJS.ProcessEnv | Record<string, string | undefined>): void {
	for (const name of FORBIDDEN_BROWSER_ENVIRONMENT) {
		if (environment[name]?.trim()) throw new Error(`${name} must be absent from the browser broker environment`);
	}
}

function sequenceViolation(): BrowserRunnerError {
	return new BrowserRunnerError(
		"broker_sequence_violation",
		"post_submit",
		"needs_human",
		"The browser broker operation is out of sequence or references an unknown session",
	);
}

function phaseForOperation(operation: BrokerRequest["operation"]) {
	if (operation === "create" || operation === "open") return "session_open" as const;
	if (operation === "prepare") return "pre_submit" as const;
	if (operation === "submit") return "submit" as const;
	if (operation === "capture" || operation === "release_evidence") return "evidence" as const;
	return "post_submit" as const;
}

function sameFrozenTask(left: RunnerTask, right: RunnerTask): boolean {
	return (
		left.id === right.id &&
		left.batchId === right.batchId &&
		left.brandId === right.brandId &&
		left.promptText === right.promptText &&
		left.sampleIndex === right.sampleIndex &&
		left.sessionRequirement === right.sessionRequirement &&
		left.searchRequirement === right.searchRequirement &&
		left.evaluationRole === right.evaluationRole &&
		left.automationAttemptCount === right.automationAttemptCount &&
		left.leaseGeneration === right.leaseGeneration
	);
}
