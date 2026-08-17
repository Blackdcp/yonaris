import { AdapterError, type CollectedAnswer, type ConsumerWebAdapter } from "../adapters/contracts";
import type { BrowserExtensionClaim } from "../contracts";
import type { DurableTaskJournal } from "./journal";

export type RunnerFailureInput = {
	stage: "pre_submit" | "post_submit";
	code: string;
	reason: string;
};

export type RunnerCompletionInput = {
	runnerSessionId: string;
	adapterVersion: string;
	browserVersion: string;
	answer: CollectedAnswer;
	evidenceArtifactId: string;
};

export interface RunnerApi {
	recordSubmitIntent(claim: BrowserExtensionClaim, runnerSessionId: string): Promise<void>;
	confirmSubmitted(claim: BrowserExtensionClaim, runnerSessionId: string): Promise<void>;
	heartbeatTask(claim: BrowserExtensionClaim): Promise<void>;
	uploadSnapshot(claim: BrowserExtensionClaim, html: string): Promise<string>;
	completeTask(claim: BrowserExtensionClaim, input: RunnerCompletionInput): Promise<void>;
	failTask(claim: BrowserExtensionClaim, input: RunnerFailureInput): Promise<{ retryScheduled: boolean }>;
}

export interface RunnerTab {
	tabId: number;
	adapter: ConsumerWebAdapter;
	close(): Promise<void>;
}

export interface RunnerTabDriver {
	open(claim: BrowserExtensionClaim): Promise<RunnerTab>;
	attach(tabId: number, surface: BrowserExtensionClaim["surfaceTargetKey"]): Promise<RunnerTab>;
}

export type TaskRunResult =
	| { status: "succeeded" }
	| { status: "retry_scheduled"; code: string }
	| { status: "needs_human"; code: string }
	| { status: "incomplete"; code: string };

type RunClaimedTaskDependencies = {
	api: RunnerApi;
	journal: DurableTaskJournal;
	tabs: RunnerTabDriver;
	browserVersion: string;
	randomSessionId?: () => string;
	now?: () => number;
};

export async function runClaimedTask(
	claim: BrowserExtensionClaim,
	dependencies: RunClaimedTaskDependencies,
): Promise<TaskRunResult> {
	const promptSha256 = await sha256(claim.promptText);
	const existing = (await dependencies.journal.entries())[claim.taskId];
	if (existing) assertMatchingJournal(existing, claim, promptSha256);

	if (existing && phaseAtOrAfterIntent(existing.phase) && !claim.postSubmitAssist) {
		return persistNeedsHuman(claim, dependencies, existing.phase, {
			stage: "post_submit",
			code: "durable_submit_intent_requires_resume",
			reason: "A durable submit intent already exists; automatic resubmission is forbidden",
		});
	}

	let tab: RunnerTab | undefined;
	const runnerSessionId = existing?.runnerSessionId ?? dependencies.randomSessionId?.() ?? crypto.randomUUID();
	let phase = existing?.phase ?? "claimed";
	const heartbeat = startLeaseHeartbeat(claim, dependencies.api);
	try {
		if (existing) {
			tab = await dependencies.tabs.attach(existing.tabId, claim.surfaceTargetKey);
		} else {
			tab = await dependencies.tabs.open(claim);
			await dependencies.journal.start(claim, {
				tabId: tab.tabId,
				runnerSessionId,
				promptSha256,
			});
		}

		if (existing && phaseAtOrAfterIntent(existing.phase)) {
			if (!claim.runnerSessionId || claim.runnerSessionId !== existing.runnerSessionId) {
				throw new AdapterError("post_submit_unknown", "post_submit", "Resumed runner session does not match this tab");
			}
			if (existing.phase !== "submit_intent") {
				await dependencies.journal.resumePostSubmit(claim.taskId);
				phase = "submit_intent";
			}
			await tab.adapter.resumeSubmitted(claim.promptText);
			if (!claim.submitConfirmed) await dependencies.api.confirmSubmitted(claim, runnerSessionId);
			await dependencies.journal.advance(claim.taskId, "submitted");
			phase = "submitted";
		} else {
			await tab.adapter.preflight();
			await tab.adapter.openNewConversation();
			await tab.adapter.prepare(claim.promptText);
			await dependencies.journal.advance(claim.taskId, "prepared");
			phase = "prepared";
			await dependencies.journal.advance(claim.taskId, "submit_intent");
			phase = "submit_intent";
			await dependencies.api.recordSubmitIntent(claim, runnerSessionId);
			await tab.adapter.submitOnce(claim.promptText);
			await tab.adapter.confirmSubmitted(claim.promptText);
			await dependencies.api.confirmSubmitted(claim, runnerSessionId);
			await dependencies.journal.advance(claim.taskId, "submitted");
			phase = "submitted";
		}

		const answer = await tab.adapter.collectCurrentAnswer();
		await dependencies.journal.advance(claim.taskId, "collected");
		phase = "collected";
		const artifactId = await dependencies.api.uploadSnapshot(claim, buildResponseSnapshotHtml(claim, answer));
		await dependencies.journal.advance(claim.taskId, "uploaded");
		phase = "uploaded";
		await dependencies.api.completeTask(claim, {
			runnerSessionId,
			adapterVersion: answer.adapterVersion,
			browserVersion: dependencies.browserVersion,
			answer,
			evidenceArtifactId: artifactId,
		});
		await Promise.allSettled([dependencies.journal.remove(claim.taskId), tab.close()]);
		return { status: "succeeded" };
	} catch (error) {
		const failure = classifyFailure(error, phase, Boolean(existing));
		try {
			const persisted = await dependencies.api.failTask(claim, failure);
			if (persisted.retryScheduled) {
				await dependencies.journal.remove(claim.taskId);
				await tab?.close().catch(() => undefined);
				return { status: "retry_scheduled", code: failure.code };
			}
			if ((await dependencies.journal.entries())[claim.taskId]) {
				await dependencies.journal.advance(claim.taskId, "needs_human").catch(() => undefined);
			}
			if (failure.stage === "pre_submit") await tab?.close().catch(() => undefined);
			return { status: "needs_human", code: failure.code };
		} catch {
			return { status: "incomplete", code: "failure_persistence_failed" };
		}
	} finally {
		clearInterval(heartbeat);
	}
}

export function buildResponseSnapshotHtml(claim: BrowserExtensionClaim, answer: CollectedAnswer): string {
	const channel = escapeHtml(claim.surfaceTargetKey);
	const observedAt = escapeHtml(answer.observedAt);
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Yonaris response snapshot</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 24px;color:#172033}header{color:#667085;font-size:13px;border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:24px}pre{white-space:pre-wrap}</style></head><body><header>Channel: ${channel} · Observed: ${observedAt}</header><main>${answer.answerHtml}</main></body></html>`;
}

async function persistNeedsHuman(
	claim: BrowserExtensionClaim,
	dependencies: RunClaimedTaskDependencies,
	phase: string,
	failure: RunnerFailureInput,
): Promise<TaskRunResult> {
	void phase;
	try {
		await dependencies.api.failTask(claim, failure);
		await dependencies.journal.advance(claim.taskId, "needs_human").catch(() => undefined);
		return { status: "needs_human", code: failure.code };
	} catch {
		return { status: "incomplete", code: "failure_persistence_failed" };
	}
}

function classifyFailure(error: unknown, phase: string, resuming: boolean): RunnerFailureInput {
	if (error instanceof AdapterError) {
		return { stage: error.stage, code: error.code, reason: safeReason(error.message) };
	}
	const postSubmit = phaseAtOrAfterIntent(phase);
	return {
		stage: postSubmit ? "post_submit" : "pre_submit",
		code: postSubmit ? "post_submit_unknown" : resuming ? "browser_crash_before_submit" : "page_load_timeout",
		reason: safeReason(error instanceof Error ? error.message : "Browser task failed"),
	};
}

function phaseAtOrAfterIntent(phase: string): boolean {
	return ["submit_intent", "submitted", "collected", "uploaded", "needs_human"].includes(phase);
}

function assertMatchingJournal(
	entry: Awaited<ReturnType<DurableTaskJournal["entries"]>>[string],
	claim: BrowserExtensionClaim,
	promptSha256: string,
): void {
	if (
		entry.batchId !== claim.batchId ||
		entry.brandId !== claim.brandId ||
		entry.surfaceTargetKey !== claim.surfaceTargetKey ||
		entry.promptSha256 !== promptSha256
	) {
		throw new Error("Durable task journal does not match the claimed task");
	}
}

function startLeaseHeartbeat(claim: BrowserExtensionClaim, api: RunnerApi): ReturnType<typeof setInterval> {
	return setInterval(() => void api.heartbeatTask(claim).catch(() => undefined), 60_000);
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeReason(value: string): string {
	return (
		value
			.replace(/[\r\n\t]+/gu, " ")
			.replace(/\s+/gu, " ")
			.trim()
			.slice(0, 1_000) || "Browser task failed"
	);
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&#39;";
		}
	});
}
