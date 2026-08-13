import { createHash } from "node:crypto";
import type {
	ClaimedRunnerTask,
	ClaimedTaskSource,
	HandoffMetadata,
	ObservationSink,
	RunnerPhase,
	RunSummary,
	SurfaceResponse,
	SurfaceSession,
	SurfaceSessionFactory,
	TaskResult,
} from "./contracts.js";
import { BrowserRunnerError, normalizeRunnerError, sanitizeDiagnostic } from "./errors.js";
import { saveEvidence } from "./evidence.js";
import type { RunJournal } from "./journal.js";

export type RunBatchOptions = {
	taskSource: ClaimedTaskSource;
	sessionFactory: SurfaceSessionFactory;
	journal: RunJournal;
	sink: ObservationSink;
	batchId?: string;
	maximumTasks?: number;
	preSubmitRetries?: 0 | 1;
	postSubmitRecoveries?: 0 | 1;
	heartbeatIntervalMs?: number;
	emptyClaimGracePolls?: number;
	emptyClaimPollMs?: number;
};

export async function runBatch(options: RunBatchOptions): Promise<RunSummary> {
	const startedAt = new Date().toISOString();
	const results: TaskResult[] = [];
	let incomplete = false;
	let drainedToNeedsHuman = false;
	let consecutiveEmptyClaims = 0;
	const maximumTasks = options.maximumTasks ?? Number.POSITIVE_INFINITY;
	const emptyClaimGracePolls = options.emptyClaimGracePolls ?? 3;
	const emptyClaimPollMs = options.emptyClaimPollMs ?? 1_000;
	if (!Number.isSafeInteger(emptyClaimGracePolls) || emptyClaimGracePolls < 1 || emptyClaimGracePolls > 20) {
		throw new Error("emptyClaimGracePolls must be an integer between 1 and 20");
	}
	if (!Number.isSafeInteger(emptyClaimPollMs) || emptyClaimPollMs < 0 || emptyClaimPollMs > 60_000) {
		throw new Error("emptyClaimPollMs must be an integer between 0 and 60000");
	}
	await options.journal.append({ type: "run_started", data: { batchId: options.batchId ?? null } });

	while (results.length < maximumTasks) {
		let claimed: ClaimedRunnerTask | null = null;
		let claimError: BrowserRunnerError | undefined;
		for (let claimAttempt = 1; claimAttempt <= 3; claimAttempt += 1) {
			try {
				claimed = await options.taskSource.claimNext(options.batchId);
				claimError = undefined;
				break;
			} catch (error) {
				claimError = normalizeRunnerError(error, "claim");
				if (claimAttempt < 3) await delay(250 * 2 ** (claimAttempt - 1));
			}
		}
		if (claimError) {
			await options.journal.append({
				type: "task_needs_human",
				phase: claimError.phase,
				code: claimError.code,
				message: claimError.message,
			});
			incomplete = true;
			break;
		}
		if (!claimed) {
			const queueState = options.taskSource.queueState?.();
			if (queueState === "settled") break;
			if (queueState === "drained") {
				drainedToNeedsHuman = true;
				break;
			}
			consecutiveEmptyClaims += 1;
			if (consecutiveEmptyClaims >= emptyClaimGracePolls) {
				incomplete = options.batchId !== undefined || queueState !== "waiting";
				break;
			}
			await delay(emptyClaimPollMs);
			continue;
		}
		consecutiveEmptyClaims = 0;
		const result = await executeClaimedTask(claimed, options);
		results.push(result);
		if (
			result.status === "persistence_failed" ||
			(result.status === "needs_human" && result.code === "retry_coordination_failed")
		) {
			incomplete = true;
		}
	}

	const completedAt = new Date().toISOString();
	const idle = !options.batchId && results.length === 0 && !incomplete;
	const summary: RunSummary = {
		runId: options.journal.runId,
		status: incomplete ? "incomplete" : idle ? "idle" : drainedToNeedsHuman ? "needs_human" : "complete",
		queuedRemaining: incomplete ? "unknown" : 0,
		startedAt,
		completedAt,
		total: results.length,
		succeeded: results.filter(({ status }) => status === "succeeded").length,
		retryQueued: results.filter(({ status }) => status === "retry_queued").length,
		needsHuman: results.filter(({ status }) => status === "needs_human").length,
		results,
	};
	await options.journal.append({ type: "run_completed", data: { ...summary, results: undefined } });
	await options.journal.writeSummary(summary);
	return summary;
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function executeClaimedTask(initialClaim: ClaimedRunnerTask, options: RunBatchOptions): Promise<TaskResult> {
	const taskId = initialClaim.task.id;
	await options.journal.append({ type: "task_started", taskId });
	let claimed = initialClaim;
	const maximumPreSubmitAttempts = 1 + (options.preSubmitRetries ?? 1);

	for (let attempt = 1; attempt <= maximumPreSubmitAttempts; attempt += 1) {
		let session: SurfaceSession | undefined;
		let closeOutcome: "succeeded" | "retrying" | "needs_human" = "needs_human";
		let phase: RunnerPhase = "session_open";
		const heartbeat = startHeartbeat(options.taskSource, claimed, options.heartbeatIntervalMs ?? 60_000);
		try {
			await options.journal.append({ type: "attempt_started", taskId, attempt, phase });
			session = await options.sessionFactory.create(claimed.task, attempt);
			await session.open(claimed.task);
			phase = "pre_submit";
			await session.prepare(claimed.task);
			if (heartbeat.error) throw heartbeat.error;

			phase = "submit";
			await options.taskSource.recordSubmitIntent(claimed, { sessionId: session.id });
			await options.journal.append({
				type: "submit_intent",
				taskId,
				attempt,
				phase,
				data: { sessionId: session.id },
			});
			let submitMayHaveHappened = false;
			try {
				submitMayHaveHappened = true;
				await session.submit(claimed.task.promptText);
			} catch (error) {
				const normalized = normalizeRunnerError(error, "submit");
				if (!submitMayHaveHappened || normalized.disposition !== "recover_same_session") throw normalized;
				await options.journal.append({
					type: "post_submit_recovery",
					taskId,
					attempt,
					phase: "post_submit",
					code: normalized.code,
					message: normalized.message,
					data: { sessionId: session.id, submitCalledAgain: false },
				});
			}

			phase = "post_submit";
			await confirmWithSameSessionRecovery({
				session,
				promptText: claimed.task.promptText,
				taskId,
				attempt,
				maximumRecoveries: options.postSubmitRecoveries ?? 1,
				journal: options.journal,
			});
			await options.taskSource.confirmPromptSubmitted(claimed, { sessionId: session.id });
			await options.journal.append({
				type: "prompt_submitted",
				taskId,
				attempt,
				phase,
				data: { sessionId: session.id },
			});
			const response = await collectWithSameSessionRecovery({
				session,
				taskId,
				attempt,
				maximumRecoveries: options.postSubmitRecoveries ?? 1,
				journal: options.journal,
			});
			if (heartbeat.error) throw heartbeat.error;

			phase = "evidence";
			const evidence = await saveEvidence({
				runDirectory: options.journal.runDirectory,
				taskId,
				attempt,
				capture: await session.captureEvidence(),
			});
			await options.journal.append({
				type: "evidence_saved",
				taskId,
				attempt,
				phase,
				data: {
					evidence: evidence.map(({ kind, sha256, bytes }) => ({ kind, sha256, bytes })),
				},
			});

			phase = "persist";
			const observation = {
				idempotencyKey: createHash("sha256")
					.update(`browser-runner:${claimed.task.batchId}:${claimed.task.id}`)
					.digest("hex"),
				sessionId: session.id,
				task: claimed.task,
				response,
				evidence,
				sessionMode: claimed.task.sessionRequirement,
				searchMode: claimed.task.searchRequirement === "platform_default" ? ("native_auto" as const) : ("off" as const),
				webSearchObserved:
					claimed.task.searchRequirement === "platform_default" ? (response.webSearchObserved ?? null) : false,
			};
			await options.sink.submit(observation);
			if (options.sink.retainLocalArtifacts === false) {
				try {
					await options.journal.removeUploadedEvidence(evidence);
				} catch (cleanupError) {
					await options.journal.append({
						type: "local_cleanup_blocked",
						taskId,
						attempt,
						phase: "persist",
						code: "local_artifact_cleanup_failed",
						message: sanitizeDiagnostic(cleanupError instanceof Error ? cleanupError.message : String(cleanupError)),
					});
				}
			}
			await options.journal.append({ type: "observation_persisted", taskId, attempt, phase });
			closeOutcome = "succeeded";
			return { taskId, status: "succeeded", observation };
		} catch (error) {
			const normalized = normalizeRunnerError(error, phase);
			if (
				normalized.disposition === "safe_pre_submit_retry" &&
				(phase === "session_open" || phase === "pre_submit") &&
				attempt < maximumPreSubmitAttempts &&
				options.taskSource.retryPreSubmit
			) {
				await options.journal.append({
					type: "pre_submit_retry_scheduled",
					taskId,
					attempt,
					phase: normalized.phase,
					code: normalized.code,
					message: normalized.message,
					data: { retryIsCentrallyAccounted: true },
				});
				let retry: Awaited<ReturnType<NonNullable<ClaimedTaskSource["retryPreSubmit"]>>>;
				try {
					retry = await options.taskSource.retryPreSubmit(claimed, {
						code: normalized.code,
						message: normalized.message,
					});
				} catch (retryError) {
					closeOutcome = "retrying";
					const coordinationError = new BrowserRunnerError(
						"retry_coordination_failed",
						"persist",
						"needs_human",
						"The server-side retry result could not be confirmed; the run is incomplete and automatic local replay is forbidden",
						{ cause: retryError },
					);
					const persisted = await markNeedsHuman(options, claimed, coordinationError);
					if (!persisted) return persistenceFailedResult(taskId);
					return {
						taskId,
						status: "needs_human",
						code: coordinationError.code,
						message: coordinationError.message,
						phase: coordinationError.phase,
					};
				}
				if (retry.state === "reclaimed") {
					claimed = retry.claimed;
					closeOutcome = "retrying";
					continue;
				}
				if (retry.state === "queued") {
					closeOutcome = "retrying";
					return {
						taskId,
						status: "retry_queued",
						code: normalized.code,
						message: normalized.message,
						phase: "pre_submit",
					};
				}
				const handoff = session
					? {
							...(await session.handoffMetadata()),
							taskId,
							runId: options.journal.runId,
							surface: "doubao" as const,
							phase: normalized.phase,
							code: normalized.code,
							message: normalized.message,
							sessionRequirement: claimed.task.sessionRequirement,
							createdAt: new Date().toISOString(),
						}
					: undefined;
				if (handoff) await options.journal.writeHandoff(handoff);
				return {
					taskId,
					status: "needs_human",
					code: normalized.code,
					message: normalized.message,
					phase: normalized.phase,
					...(handoff ? { handoff } : {}),
				};
			}
			const handoff = session
				? {
						...(await session.handoffMetadata()),
						taskId,
						runId: options.journal.runId,
						surface: "doubao" as const,
						phase: normalized.phase,
						code: normalized.code,
						message: normalized.message,
						sessionRequirement: claimed.task.sessionRequirement,
						createdAt: new Date().toISOString(),
					}
				: undefined;
			if (handoff) await options.journal.writeHandoff(handoff);
			const persisted = await markNeedsHuman(options, claimed, normalized);
			if (!persisted) return persistenceFailedResult(taskId, handoff);
			return {
				taskId,
				status: "needs_human",
				code: normalized.code,
				message: normalized.message,
				phase: normalized.phase,
				...(handoff ? { handoff } : {}),
			};
		} finally {
			heartbeat.stop();
			await session?.close(closeOutcome).catch(() => undefined);
		}
	}

	const exhausted = new BrowserRunnerError(
		"pre_submit_retry_exhausted",
		"pre_submit",
		"needs_human",
		"The centrally accounted pre-submit retry budget was exhausted",
	);
	const persisted = await markNeedsHuman(options, claimed, exhausted);
	if (!persisted) return persistenceFailedResult(taskId);
	return { taskId, status: "needs_human", code: exhausted.code, message: exhausted.message, phase: exhausted.phase };
}

function persistenceFailedResult(
	taskId: string,
	handoff?: HandoffMetadata,
): Extract<TaskResult, { status: "persistence_failed" }> {
	return {
		taskId,
		status: "persistence_failed",
		code: "needs_human_persist_failed",
		message: "The server did not persist the needs-human state; central task state is unknown",
		phase: "persist",
		...(handoff ? { handoff } : {}),
	};
}

async function confirmWithSameSessionRecovery(input: {
	session: SurfaceSession;
	promptText: string;
	taskId: string;
	attempt: number;
	maximumRecoveries: 0 | 1;
	journal: RunJournal;
}): Promise<void> {
	for (let recovery = 0; recovery <= input.maximumRecoveries; recovery += 1) {
		try {
			await input.session.confirmSubmission(input.promptText);
			return;
		} catch (error) {
			const normalized = normalizeRunnerError(error, "post_submit");
			if (normalized.disposition !== "recover_same_session" || recovery >= input.maximumRecoveries) throw normalized;
			await input.journal.append({
				type: "post_submit_recovery",
				taskId: input.taskId,
				attempt: input.attempt,
				phase: "post_submit",
				code: normalized.code,
				message: normalized.message,
				data: { sessionId: input.session.id, submitCalledAgain: false, confirmationOnly: true },
			});
		}
	}
}

async function collectWithSameSessionRecovery(input: {
	session: SurfaceSession;
	taskId: string;
	attempt: number;
	maximumRecoveries: 0 | 1;
	journal: RunJournal;
}): Promise<SurfaceResponse> {
	for (let recovery = 0; recovery <= input.maximumRecoveries; recovery += 1) {
		try {
			return await input.session.collectResponse();
		} catch (error) {
			const normalized = normalizeRunnerError(error, "post_submit");
			if (normalized.disposition !== "recover_same_session" || recovery >= input.maximumRecoveries) throw normalized;
			await input.journal.append({
				type: "post_submit_recovery",
				taskId: input.taskId,
				attempt: input.attempt,
				phase: "post_submit",
				code: normalized.code,
				message: normalized.message,
				data: { sessionId: input.session.id, submitCalledAgain: false },
			});
		}
	}
	throw new Error("Unreachable post-submit recovery state");
}

async function markNeedsHuman(
	options: RunBatchOptions,
	claimed: ClaimedRunnerTask,
	error: BrowserRunnerError,
): Promise<boolean> {
	try {
		await options.taskSource.markNeedsHuman?.(claimed, {
			code: error.code,
			message: error.message,
			phase: error.phase,
		});
		await options.journal.append({
			type: "task_needs_human",
			taskId: claimed.task.id,
			phase: error.phase,
			code: error.code,
			message: error.message,
		});
		return true;
	} catch (markError) {
		await options.journal.append({
			type: "task_persistence_failed",
			taskId: claimed.task.id,
			phase: "persist",
			code: "needs_human_persist_failed",
			message: sanitizeDiagnostic(markError instanceof Error ? markError.message : String(markError)),
		});
		return false;
	}
}

function startHeartbeat(source: ClaimedTaskSource, claimed: ClaimedRunnerTask, intervalMs: number) {
	let error: BrowserRunnerError | undefined;
	if (!source.heartbeat || !claimed.claim)
		return {
			get error() {
				return error;
			},
			stop() {},
		};
	const timer = setInterval(() => {
		void source.heartbeat?.(claimed).catch((cause) => {
			error = new BrowserRunnerError(
				"lease_heartbeat_failed",
				"persist",
				"needs_human",
				"Task lease heartbeat failed",
				{
					cause,
				},
			);
		});
	}, intervalMs);
	timer.unref();
	return {
		get error() {
			return error;
		},
		stop() {
			clearInterval(timer);
		},
	};
}
