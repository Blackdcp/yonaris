import type { CollectedAnswer, ConsumerWebAdapter } from "../adapters/contracts";
import type { BrowserExtensionClaim, BrowserExtensionSurface } from "../contracts";
import type { RunnerApi, RunnerTab, RunnerTabDriver } from "./task-runner";

export function claimedTask(
	override: Partial<BrowserExtensionClaim> & { taskId?: string } = {},
): BrowserExtensionClaim {
	const surfaceTargetKey = override.surfaceTargetKey ?? "deepseek.consumer_web";
	return {
		taskId: override.taskId ?? "task-1",
		batchId: "batch-1",
		brandId: "stepfun",
		scopeId: "scope-1",
		promptId: override.promptId ?? "prompt-1",
		promptText: "Prompt A",
		sampleIndex: override.sampleIndex ?? 1,
		surfaceTargetKey,
		captureRouteKey:
			surfaceTargetKey === "doubao.consumer_web" ? "browser_extension.doubao" : "browser_extension.deepseek",
		launchUrl:
			surfaceTargetKey === "doubao.consumer_web" ? "https://www.doubao.com/chat/" : "https://chat.deepseek.com/",
		sessionRequirement: "dedicated_sampling_profile",
		searchRequirement: "platform_default",
		evaluationRole: "scored",
		minimumEvidenceArtifacts: 1,
		automationAttemptCount: 1,
		leaseToken: "l".repeat(43),
		leaseGeneration: 1,
		leaseExpiresAt: "2026-08-17T01:00:00.000Z",
		postSubmitAssist: false,
		submitConfirmed: false,
		runnerSessionId: null,
		...override,
	};
}

export function fakeAdapter(events: string[], collectFailure?: Error): ConsumerWebAdapter {
	const answer: CollectedAnswer = {
		answerText: "Current answer",
		answerHtml: "<article><p>Current answer</p></article>",
		pageUrl: "https://chat.deepseek.com/a/chat/s/test-session",
		observedAt: "2026-08-17T00:00:00.000Z",
		webSearchObserved: null,
		webQueries: [],
		citations: [],
		adapterVersion: "deepseek-test-v1",
	};
	return {
		surface: "deepseek.consumer_web",
		launchUrl: "https://chat.deepseek.com/",
		adapterVersion: "deepseek-test-v1",
		preflight: async () => {
			events.push("adapter:preflight");
		},
		openNewConversation: async () => {
			events.push("adapter:new_conversation");
		},
		prepare: async () => {
			events.push("adapter:prepare");
		},
		submitOnce: async () => {
			events.push("adapter:submit");
		},
		confirmSubmitted: async () => {
			events.push("adapter:confirm");
		},
		collectCurrentAnswer: async () => {
			events.push("adapter:collect");
			if (collectFailure) throw collectFailure;
			return answer;
		},
	};
}

export function fakeTabDriver(events: string[], adapter: ConsumerWebAdapter, openFailure?: Error): RunnerTabDriver {
	const tab: RunnerTab = {
		tabId: 42,
		adapter,
		close: async () => {
			events.push("tab:close");
		},
	};
	return {
		open: async () => {
			events.push("tab:open");
			if (openFailure) throw openFailure;
			return tab;
		},
		attach: async () => tab,
	};
}

export function fakeRunnerApi(events: string[]): RunnerApi {
	return {
		recordSubmitIntent: async () => {
			events.push("api:submit_intent");
		},
		confirmSubmitted: async () => {
			events.push("api:submit_confirmed");
		},
		heartbeatTask: async () => undefined,
		uploadSnapshot: async () => {
			events.push("api:upload");
			return "artifact-1";
		},
		completeTask: async () => {
			events.push("api:complete");
		},
		failTask: async (_claim, input) => {
			if (input.code === "page_load_timeout") {
				events.push(`api:retry:${input.code}`);
				return { retryScheduled: true };
			}
			events.push("api:needs_human");
			return { retryScheduled: false };
		},
	};
}

export function surface(value: BrowserExtensionSurface): BrowserExtensionSurface {
	return value;
}
