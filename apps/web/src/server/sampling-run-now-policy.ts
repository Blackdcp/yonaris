import { createHash } from "node:crypto";
import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionCaptureRoute,
	type BrowserExtensionSurface,
	browserExtensionCaptureRoute,
	isBrowserExtensionSurface,
} from "@workspace/lib/browser-extension-contract";
import type { DeliveryTaskPlanInput } from "@workspace/lib/db/delivery-batches";
import type { DeliveryProtocol } from "@workspace/lib/delivery-manifest";

export const SAMPLING_RUN_NOW_SAMPLES = 5;
export const SAMPLING_RUN_NOW_WINDOW_HOURS = 24;
export const SAMPLING_RUN_NOW_MAX_TASKS = 10_000;

export type SamplingRunNowTarget = {
	surfaceTargetKey: BrowserExtensionSurface;
	captureRouteKey: BrowserExtensionCaptureRoute;
	samplesPerPrompt: typeof SAMPLING_RUN_NOW_SAMPLES;
	evaluationRole: "scored";
	sessionRequirement: "dedicated_sampling_profile";
	searchRequirement: "platform_default";
};

export type SamplingRunNowPlan = {
	samplesPerPrompt: typeof SAMPLING_RUN_NOW_SAMPLES;
	taskCount: number;
	targets: SamplingRunNowTarget[];
	tasks: DeliveryTaskPlanInput[];
	protocol: DeliveryProtocol;
	manifestFingerprint: string;
	name: string;
};

export function planSamplingRunNow(input: {
	prompts: readonly { id: string; value: string }[];
	surfaces: readonly BrowserExtensionSurface[];
	now: Date;
}): SamplingRunNowPlan {
	if (!Number.isFinite(input.now.getTime())) throw new Error("Run now requires a valid request time");
	if (input.prompts.length === 0) throw new Error("Run now requires at least one enabled Prompt");
	const promptIds = input.prompts.map(({ id }) => requiredText(id, "Prompt id"));
	if (new Set(promptIds).size !== promptIds.length) throw new Error("Run now received a duplicate Prompt");
	if (input.surfaces.length === 0) throw new Error("Run now requires at least one channel");
	if (new Set(input.surfaces).size !== input.surfaces.length) throw new Error("Run now received a duplicate channel");
	for (const surface of input.surfaces) {
		if (!isBrowserExtensionSurface(surface)) throw new Error(`Run now channel ${surface} is unsupported`);
	}

	const prompts = input.prompts
		.map((prompt) => ({ id: requiredText(prompt.id, "Prompt id"), value: requiredText(prompt.value, "Prompt text") }))
		.sort((left, right) => left.id.localeCompare(right.id));
	const selected = new Set<BrowserExtensionSurface>(input.surfaces);
	const surfaces = BROWSER_EXTENSION_SURFACES.filter((surface) => selected.has(surface));
	const taskCount = prompts.length * surfaces.length * SAMPLING_RUN_NOW_SAMPLES;
	if (taskCount > SAMPLING_RUN_NOW_MAX_TASKS) {
		throw new Error(`Run now cannot contain more than ${SAMPLING_RUN_NOW_MAX_TASKS.toLocaleString("en-US")} tasks`);
	}

	const targets = surfaces.map(
		(surfaceTargetKey): SamplingRunNowTarget => ({
			surfaceTargetKey,
			captureRouteKey: browserExtensionCaptureRoute(surfaceTargetKey),
			samplesPerPrompt: SAMPLING_RUN_NOW_SAMPLES,
			evaluationRole: "scored",
			sessionRequirement: "dedicated_sampling_profile",
			searchRequirement: "platform_default",
		}),
	);
	const tasks: DeliveryTaskPlanInput[] = [];
	for (const prompt of prompts) {
		for (const target of targets) {
			for (let sampleIndex = 1; sampleIndex <= SAMPLING_RUN_NOW_SAMPLES; sampleIndex += 1) {
				tasks.push({
					promptId: prompt.id,
					expectedPromptText: prompt.value,
					surfaceTargetKey: target.surfaceTargetKey,
					captureRouteKey: target.captureRouteKey,
					sampleIndex,
					sessionRequirement: target.sessionRequirement,
					searchRequirement: target.searchRequirement,
					evaluationRole: target.evaluationRole,
				});
			}
		}
	}
	const manifestFingerprint = createHash("sha256")
		.update(JSON.stringify({ schemaVersion: 1, tasks }))
		.digest("hex");
	const startsAt = input.now.toISOString();
	const endsAt = new Date(input.now.getTime() + SAMPLING_RUN_NOW_WINDOW_HOURS * 60 * 60 * 1_000).toISOString();
	return {
		samplesPerPrompt: SAMPLING_RUN_NOW_SAMPLES,
		taskCount,
		targets,
		tasks,
		manifestFingerprint,
		name: `Domestic browser run · ${beijingTimestamp(input.now)}`,
		protocol: {
			measurementWindow: { startsAt, endsAt },
			evidence: {
				minimumArtifacts: 1,
				requireSha256: true,
				requirePageUrl: true,
				allowedUriSchemes: ["https"],
			},
			notes: `run-now:v1:${manifestFingerprint}`,
		},
	};
}

function requiredText(value: string, field: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${field} is required`);
	return normalized;
}

function beijingTimestamp(date: Date): string {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).format(date);
}
