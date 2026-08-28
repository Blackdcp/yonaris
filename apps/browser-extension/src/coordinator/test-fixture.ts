import type { CollectedAnswer, ConsumerWebAdapter } from "../adapters/contracts";
import type { BrowserExtensionClaim, BrowserExtensionSurface } from "../contracts";
import { extensionSurfaceDefinition } from "../surface-registry";
import type { RunnerFailureInput, RunnerTab, RunnerTabDriver } from "./task-runner";

export function claimedTask(
	override: Partial<BrowserExtensionClaim> & { taskId?: string } = {},
): BrowserExtensionClaim {
	const surfaceTargetKey = override.surfaceTargetKey ?? "deepseek.consumer_web";
	const definition = extensionSurfaceDefinition(surfaceTargetKey);
	return {
		taskId: override.taskId ?? "task-1",
		batchId: "batch-1",
		brandId: "stepfun",
		scopeId: "scope-1",
		promptId: override.promptId ?? "prompt-1",
		promptText: "Prompt A",
		sampleIndex: override.sampleIndex ?? 1,
		surfaceTargetKey,
		captureRouteKey: definition.captureRoute,
		launchUrl: definition.launchUrl,
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
		evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
		pageUrl: "https://chat.deepseek.com/a/chat/s/test-session",
		observedAt: "2026-08-17T00:00:00.000Z",
		webSearchObserved: null,
		queryAvailability: "unknown",
		webQueries: [],
		citations: [],
		searchEvidenceDiagnostics: {
			extractorVersion: "deepseek-test-evidence-v1",
			evidenceSource: "none",
			searchBlockCount: 0,
			queryCandidateCount: 0,
			citationCandidateCount: 0,
		},
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
		resumeSubmitted: async () => {
			events.push("adapter:resume");
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
		captureEvidence: async () => {
			events.push("tab:capture");
			return {
				expectedSegmentCount: 1,
				segments: [
					{
						bytes: Uint8Array.from([0xff, 0xd8, 0xff]),
						overlapTopCssPx: 0,
						devicePixelRatio: 1,
					},
				],
				composite: Uint8Array.from([0xff, 0xd8, 0xff]),
			};
		},
		close: async () => {
			events.push("tab:close");
		},
	};
	return {
		activate: async (tabId) => {
			events.push(`tab:activate:${tabId}`);
		},
		open: async () => {
			events.push("tab:open");
			if (openFailure) throw openFailure;
			return tab;
		},
		attach: async () => tab,
	};
}

export function fakeRunnerApi(events: string[]) {
	return {
		reconcileTask: async (taskId: string) => ({
			state: "resumable_post" as const,
			task: {
				taskId,
				batchId: "batch-1",
				brandId: "stepfun",
				surfaceTargetKey: "deepseek.consumer_web" as const,
				promptText: "Prompt A",
			},
			runnerSessionId: "session-1",
		}),
		recordSubmitIntent: async () => {
			events.push("api:submit_intent");
		},
		confirmSubmitted: async () => {
			events.push("api:submit_confirmed");
		},
		heartbeatTask: async () => undefined,
		uploadEvidence: async (_claim: unknown, _session: string, _adapter: string, _bytes: Uint8Array, descriptor?: { role: string }) => {
			const role = descriptor?.role ?? "legacy";
			events.push(`api:upload_${role}`);
			return role === "primary" ? "artifact-primary" : "artifact-segment-1";
		},
		completeTask: async () => {
			events.push("api:complete");
		},
		failTask: async (_claim: BrowserExtensionClaim, input: RunnerFailureInput) => {
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
