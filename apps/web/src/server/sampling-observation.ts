import { createHash } from "node:crypto";
import type { DeliveryTaskView } from "@workspace/lib/db/delivery-batches";
import type { DeliveryManifestSnapshot, DeliveryProtocol } from "@workspace/lib/delivery-manifest";
import {
	assertManualObservationPageUrl,
	resolveManualObservationTarget,
} from "@workspace/lib/manual-observation-targets";
import { analyzeMentions } from "@workspace/lib/mention-analysis";
import type { Citation } from "@workspace/lib/text-extraction";
import { z } from "zod";

const httpUrl = z
	.string()
	.trim()
	.url()
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	}, "URL must use http or https");

const evidenceRefSchema = z.object({
	type: z.enum(["screenshot", "video", "page_snapshot", "other"]),
	uri: httpUrl,
	sha256: z
		.string()
		.trim()
		.regex(/^[a-fA-F0-9]{64}$/, "sha256 must contain 64 hexadecimal characters"),
});

const citationSchema = z.object({
	url: httpUrl,
	title: z.string().trim().max(1_000).optional(),
	citationIndex: z.number().int().min(0).max(32_767).optional(),
});

export const samplingObservationInputSchema = z.object({
	answerText: z.string().trim().min(1).max(500_000),
	observedAt: z.string().datetime({ offset: true }),
	pageUrl: httpUrl,
	sessionMode: z.enum(["anonymous_clean", "new_account_clean"]),
	searchMode: z.enum(["on", "off"]),
	modelVersion: z.string().trim().min(1).max(200).optional(),
	evidenceRefs: z.array(evidenceRefSchema).min(1).max(20),
	citations: z.array(citationSchema).max(200).default([]),
	webQueries: z.array(z.string().trim().min(1).max(2_000)).max(100).default([]),
});

export type SamplingObservationInput = z.infer<typeof samplingObservationInputSchema>;

function normalizeCitations(input: SamplingObservationInput["citations"]): Citation[] {
	const seen = new Set<string>();
	const normalized: Citation[] = [];
	for (const [index, citation] of input.entries()) {
		if (seen.has(citation.url)) continue;
		seen.add(citation.url);
		normalized.push({
			url: citation.url,
			domain: new URL(citation.url).hostname.replace(/^www\./, "").toLowerCase(),
			title: citation.title,
			citationIndex: citation.citationIndex ?? index,
		});
	}
	return normalized;
}

function assertEvidencePolicy(input: SamplingObservationInput, protocol: DeliveryProtocol): void {
	if (input.evidenceRefs.length < protocol.evidence.minimumArtifacts) {
		throw new Error(`At least ${protocol.evidence.minimumArtifacts} evidence artifact(s) are required`);
	}
	for (const evidence of input.evidenceRefs) {
		const scheme = new URL(evidence.uri).protocol.replace(":", "");
		if (!protocol.evidence.allowedUriSchemes.includes(scheme as "http" | "https")) {
			throw new Error(`Evidence URI scheme ${scheme} is not permitted by this delivery batch`);
		}
		if (protocol.evidence.requireSha256 && !evidence.sha256) {
			throw new Error("Every evidence artifact requires a SHA-256 digest");
		}
	}
}

function assertFrozenTask(snapshot: DeliveryManifestSnapshot, task: DeliveryTaskView): void {
	const frozen = snapshot.tasks.find(({ id }) => id === task.id);
	if (!frozen) throw new Error("Delivery task is absent from the frozen manifest");
	if (
		frozen.brandId !== task.brandId ||
		frozen.scopeId !== task.scopeId ||
		frozen.promptId !== task.promptId ||
		frozen.promptText !== task.promptText ||
		frozen.surfaceTargetKey !== task.surfaceTargetKey ||
		frozen.captureRouteKey !== task.captureRouteKey ||
		frozen.sampleIndex !== task.sampleIndex ||
		frozen.sessionRequirement !== task.sessionRequirement ||
		frozen.searchRequirement !== task.searchRequirement ||
		frozen.evaluationRole !== task.evaluationRole ||
		frozen.slotKey !== task.slotKey
	) {
		throw new Error("Delivery task no longer matches its frozen manifest");
	}
}

export function prepareSamplingObservation(input: {
	task: DeliveryTaskView;
	manifest: DeliveryManifestSnapshot;
	observation: SamplingObservationInput;
	operatorUserId: string;
	leaseGeneration: number;
}) {
	assertFrozenTask(input.manifest, input.task);
	assertEvidencePolicy(input.observation, input.manifest.protocol);

	const observedAt = new Date(input.observation.observedAt);
	const measurementStartsAt = new Date(input.manifest.protocol.measurementWindow.startsAt);
	const measurementEndsAt = new Date(input.manifest.protocol.measurementWindow.endsAt);
	if (observedAt < measurementStartsAt || observedAt > measurementEndsAt) {
		throw new Error("Observation time falls outside this batch's frozen measurement window");
	}
	if (observedAt.getTime() > Date.now() + 5 * 60 * 1_000) {
		throw new Error("Observation time cannot be more than five minutes in the future");
	}
	if (input.task.sessionRequirement !== "none" && input.observation.sessionMode !== input.task.sessionRequirement) {
		throw new Error(`This task requires session mode ${input.task.sessionRequirement}`);
	}
	if (input.task.searchRequirement === "required" && input.observation.searchMode !== "on") {
		throw new Error("This task requires search mode to be on");
	}
	if (
		(input.task.searchRequirement === "forbidden" || input.task.searchRequirement === "not_applicable") &&
		input.observation.searchMode !== "off"
	) {
		throw new Error("This task requires search mode to be off");
	}

	const target = resolveManualObservationTarget({
		surfaceTargetKey: input.task.surfaceTargetKey,
		captureRouteKey: input.task.captureRouteKey,
	});
	assertManualObservationPageUrl(target.surfaceTargetKey, input.observation.pageUrl);

	const citations = normalizeCitations(input.observation.citations);
	const mentionResult = analyzeMentions(input.observation.answerText, input.manifest.brand, input.manifest.competitors);
	const config = {
		model: target.model,
		provider: target.captureMode === "manual_import" ? "manual-import" : "assisted-browser",
		version: input.observation.modelVersion,
		webSearch: input.observation.searchMode === "on",
	};
	const captureMetadata = {
		measurementEligibility: "formal_clean_session",
		deliveryBatchId: input.task.batchId,
		deliveryTaskId: input.task.id,
		leaseGeneration: input.leaseGeneration,
		sessionMode: input.observation.sessionMode,
		searchMode: input.observation.searchMode,
		pageUrl: input.observation.pageUrl,
		actualMarket: input.manifest.scope.market,
		actualLocale: input.manifest.scope.locale,
		operatorReference: input.operatorUserId,
		evidenceRefs: input.observation.evidenceRefs,
	};
	const sampleFingerprint = createHash("sha256")
		.update(JSON.stringify({ taskId: input.task.id, observation: input.observation }))
		.digest("hex");

	return {
		observedAt,
		target,
		config,
		captureMetadata,
		sampleFingerprint,
		citations,
		mentionResult,
		rawOutput: {
			schemaVersion: 1,
			captureMode: target.captureMode,
			answerText: input.observation.answerText,
			pageUrl: input.observation.pageUrl,
			citations,
			evidenceRefs: input.observation.evidenceRefs,
			deliveryBatchId: input.task.batchId,
			deliveryTaskId: input.task.id,
		},
	};
}
