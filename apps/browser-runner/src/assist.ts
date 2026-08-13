import type { ClaimedRunnerTask, HandoffMetadata, SuccessfulRunnerObservation, SurfaceSession } from "./contracts.js";
import { BrowserRunnerError, sanitizeDiagnostic } from "./errors.js";
import { saveEvidence } from "./evidence.js";
import type { RunJournal } from "./journal.js";

type AssistRemote = {
	resume(taskId: string): Promise<ClaimedRunnerTask>;
	confirmPromptSubmitted(claimed: ClaimedRunnerTask, input: { sessionId: string }): Promise<void>;
	submit(observation: SuccessfulRunnerObservation): Promise<void>;
};

type AssistSessionFactory = {
	resume(
		task: ClaimedRunnerTask["task"],
		profileDirectory: string,
		lastPageUrl: string,
		expectedSessionId: string,
	): Promise<SurfaceSession>;
};

export async function resumePostSubmitTask(input: {
	handoff: HandoffMetadata;
	remote: AssistRemote;
	sessionFactory: AssistSessionFactory;
	journal: RunJournal;
}): Promise<void> {
	if (
		input.handoff.phase !== "submit" &&
		input.handoff.phase !== "post_submit" &&
		input.handoff.phase !== "evidence" &&
		input.handoff.phase !== "persist"
	) {
		throw new BrowserRunnerError(
			"assist_pre_submit_not_resumable",
			"pre_submit",
			"needs_human",
			"Pre-submit needs-human tasks must be completed through the admin workbench",
		);
	}
	if (!input.handoff.profileDirectory) {
		throw new BrowserRunnerError(
			"assist_profile_missing",
			"post_submit",
			"needs_human",
			"The retained browser profile is missing; automatic replay is forbidden",
		);
	}
	const claimed = await input.remote.resume(input.handoff.taskId);
	if (!claimed.postSubmitAssist) {
		throw new BrowserRunnerError(
			"assist_resume_contract_invalid",
			"post_submit",
			"needs_human",
			"The server did not grant a post-submit-only assist lease",
		);
	}
	if (!claimed.runnerSessionId || claimed.runnerSessionId !== input.handoff.sessionId) {
		throw new BrowserRunnerError(
			"assist_session_mismatch",
			"post_submit",
			"needs_human",
			"The retained Browser Runner session does not match the durable submit intent",
		);
	}
	const session = await input.sessionFactory.resume(
		claimed.task,
		input.handoff.profileDirectory,
		input.handoff.lastPageUrl,
		claimed.runnerSessionId,
	);
	try {
		if (session.id !== claimed.runnerSessionId) {
			throw new BrowserRunnerError(
				"assist_session_mismatch",
				"post_submit",
				"needs_human",
				"The resumed browser profile does not match the durable submit session",
			);
		}
		await session.confirmSubmission(claimed.task.promptText);
		if (!claimed.submitConfirmed) {
			await input.remote.confirmPromptSubmitted(claimed, { sessionId: session.id });
		}
		const response = await session.collectResponse();
		const evidence = await saveEvidence({
			runDirectory: input.journal.runDirectory,
			taskId: claimed.task.id,
			attempt: claimed.task.automationAttemptCount,
			capture: await session.captureEvidence(),
		});
		await input.remote.submit({
			idempotencyKey: `browser-runner:${claimed.task.batchId}:${claimed.task.id}`,
			sessionId: session.id,
			task: claimed.task,
			response,
			evidence,
			sessionMode: claimed.task.sessionRequirement,
			searchMode: claimed.task.searchRequirement === "platform_default" ? "native_auto" : "off",
			webSearchObserved:
				claimed.task.searchRequirement === "platform_default" ? (response.webSearchObserved ?? null) : false,
		});
		await input.journal.removeUploadedEvidence(evidence).catch(async (cleanupError) => {
			await input.journal.append({
				type: "local_cleanup_blocked",
				taskId: claimed.task.id,
				phase: "persist",
				code: "assist_evidence_cleanup_failed",
				message: sanitizeDiagnostic(cleanupError instanceof Error ? cleanupError.message : String(cleanupError)),
			});
		});
		await session.close("succeeded").catch(async (cleanupError) => {
			await input.journal.append({
				type: "local_cleanup_blocked",
				taskId: claimed.task.id,
				phase: "persist",
				code: "assist_profile_cleanup_failed",
				message: sanitizeDiagnostic(cleanupError instanceof Error ? cleanupError.message : String(cleanupError)),
			});
		});
		await input.journal.removeHandoff(claimed.task.id).catch(async (cleanupError) => {
			await input.journal.append({
				type: "local_cleanup_blocked",
				taskId: claimed.task.id,
				phase: "persist",
				code: "assist_handoff_cleanup_failed",
				message: sanitizeDiagnostic(cleanupError instanceof Error ? cleanupError.message : String(cleanupError)),
			});
		});
	} catch (error) {
		await session.close("needs_human").catch(() => undefined);
		throw error;
	}
}
