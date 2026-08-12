export type RunnerMode = "fixture" | "live";
export type RunnerSurface = "doubao";

export type RunnerTask = {
	id: string;
	batchId: string;
	brandId: string;
	promptText: string;
	surfaceTargetKey: "doubao.consumer_web";
	captureRouteKey: "browser_runner.doubao";
	sampleIndex: number;
	sessionRequirement: "anonymous_clean" | "new_account_clean";
	searchRequirement: "forbidden";
	evaluationRole: "scored" | "observation";
	minimumEvidenceArtifacts?: number;
	automationAttemptCount: number;
	leaseGeneration: number;
};

export type FixtureScenario =
	| "success"
	| "success_without_brand"
	| "pre_submit_transient_then_success"
	| "post_submit_transient_then_success"
	| "submit_unknown_then_confirmed"
	| "login_required"
	| "captcha"
	| "page_drift";

export type FixtureTask = RunnerTask & {
	scenario?: FixtureScenario;
	fixtureAnswer?: string;
};

export type ClaimedRunnerTask = {
	task: RunnerTask;
	submitConfirmed?: boolean;
	postSubmitAssist?: boolean;
	runnerSessionId?: string | null;
	claim?: {
		leaseToken: string;
		leaseGeneration: number;
	};
};

export type SurfaceResponse = {
	answerText: string;
	pageUrl: string;
	observedAt: string;
	modelVersion?: string;
	browserVersion?: string;
	citations: Array<{ url: string; title?: string; citationIndex?: number }>;
	webQueries: string[];
};

export type EvidenceCapture = {
	domSnapshot: string;
	screenshotPng: Uint8Array;
};

export type EvidenceArtifact = {
	kind: "page_snapshot" | "screenshot";
	path: string;
	mediaType: "text/html" | "image/png";
	sha256: string;
	bytes: number;
};

export type SuccessfulRunnerObservation = {
	idempotencyKey: string;
	sessionId: string;
	task: RunnerTask;
	response: SurfaceResponse;
	evidence: EvidenceArtifact[];
	sessionMode: "anonymous_clean" | "new_account_clean";
	searchMode: "off";
};

export type TaskResult =
	| { taskId: string; status: "succeeded"; observation: SuccessfulRunnerObservation }
	| { taskId: string; status: "retry_queued"; code: string; message: string; phase: "pre_submit" }
	| {
			taskId: string;
			status: "persistence_failed";
			code: "needs_human_persist_failed";
			message: string;
			phase: "persist";
			handoff?: HandoffMetadata;
	  }
	| {
			taskId: string;
			status: "needs_human";
			code: string;
			message: string;
			phase: RunnerPhase;
			handoff?: HandoffMetadata;
	  };

export type RunSummary = {
	runId: string;
	status: "complete" | "needs_human" | "idle" | "incomplete";
	queuedRemaining: number | "unknown";
	startedAt: string;
	completedAt: string;
	total: number;
	succeeded: number;
	retryQueued: number;
	needsHuman: number;
	results: TaskResult[];
};

export type RunnerPhase = "claim" | "session_open" | "pre_submit" | "submit" | "post_submit" | "evidence" | "persist";

export type RunnerJournalEvent = {
	sequence: number;
	at: string;
	runId: string;
	taskId?: string;
	type:
		| "run_started"
		| "task_started"
		| "attempt_started"
		| "pre_submit_retry_scheduled"
		| "submit_intent"
		| "prompt_submitted"
		| "post_submit_recovery"
		| "evidence_saved"
		| "local_cleanup_blocked"
		| "observation_persisted"
		| "task_needs_human"
		| "task_persistence_failed"
		| "run_completed";
	phase?: RunnerPhase;
	attempt?: number;
	code?: string;
	message?: string;
	data?: Record<string, unknown>;
};

export type HandoffMetadata = {
	taskId: string;
	runId: string;
	surface: RunnerSurface;
	sessionId: string;
	profileDirectory?: string;
	lastPageUrl: string;
	phase: RunnerPhase;
	code: string;
	message: string;
	sessionRequirement: RunnerTask["sessionRequirement"];
	createdAt: string;
	fixture: boolean;
};

export interface SurfaceSession {
	readonly id: string;
	open(task: RunnerTask): Promise<void>;
	prepare(task: RunnerTask): Promise<void>;
	submit(promptText: string): Promise<void>;
	confirmSubmission(promptText: string): Promise<void>;
	collectResponse(): Promise<SurfaceResponse>;
	captureEvidence(): Promise<EvidenceCapture>;
	handoffMetadata(): Promise<Pick<HandoffMetadata, "sessionId" | "profileDirectory" | "lastPageUrl" | "fixture">>;
	close(outcome: "succeeded" | "retrying" | "needs_human"): Promise<void>;
}

export interface SurfaceSessionFactory {
	create(task: RunnerTask, attempt: number): Promise<SurfaceSession>;
}

export interface ObservationSink {
	readonly retainLocalArtifacts?: boolean;
	submit(observation: SuccessfulRunnerObservation): Promise<void>;
}

export interface ClaimedTaskSource {
	claimNext(batchId?: string): Promise<ClaimedRunnerTask | null>;
	queueState?(): "settled" | "drained" | "waiting" | "unknown";
	retryPreSubmit?(
		claimed: ClaimedRunnerTask,
		reason: { code: string; message: string },
	): Promise<{ state: "reclaimed"; claimed: ClaimedRunnerTask } | { state: "queued" } | { state: "needs_human" }>;
	heartbeat?(claimed: ClaimedRunnerTask): Promise<void>;
	recordSubmitIntent(claimed: ClaimedRunnerTask, input: { sessionId: string }): Promise<void>;
	confirmPromptSubmitted(claimed: ClaimedRunnerTask, input: { sessionId: string }): Promise<void>;
	markNeedsHuman?(
		claimed: ClaimedRunnerTask,
		reason: { code: string; message: string; phase: RunnerPhase },
	): Promise<void>;
}
