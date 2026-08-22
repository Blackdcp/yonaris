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

function isCredentialFreeHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
	} catch {
		return false;
	}
}

const httpUrl = z
	.string()
	.trim()
	.url()
	.refine(isCredentialFreeHttpUrl, "URL must use http or https without embedded credentials");

const citationHttpUrl = z
	.string()
	.trim()
	.min(1)
	.max(10_000)
	.url()
	.refine(isCredentialFreeHttpUrl, "URL must use http or https without embedded credentials");

const citationSchema = z
	.object({
		url: citationHttpUrl,
		title: z.string().trim().min(1).max(1_000).optional(),
		citationIndex: z.number().int().min(0).max(32_767).optional(),
	})
	.strict();

const structuredCitationSchema = z
	.object({
		url: citationHttpUrl,
		title: z.string().trim().min(1).max(1_000),
	})
	.strict();

export const browserAnswerHtmlSchema = z
	.string()
	.trim()
	.min(1)
	.max(2 * 1024 * 1024)
	.refine((value) => Buffer.byteLength(value, "utf8") <= 2 * 1024 * 1024, "Answer HTML exceeds 2 MiB");

export const samplingObservationBaseSchema = z
	.object({
		answerText: z.string().trim().min(1).max(500_000),
		observedAt: z.string().datetime({ offset: true }),
		pageUrl: httpUrl,
		sessionMode: z.enum(["anonymous_clean", "new_account_clean", "dedicated_sampling_profile"]),
		searchMode: z.enum(["on", "off", "native_auto"]),
		webSearchObserved: z.boolean().nullable().optional(),
		modelVersion: z.string().trim().min(1).max(200).optional(),
		evidenceArtifactIds: z.array(z.guid()).min(1).max(20),
		citations: z.array(citationSchema).max(200).default([]),
		webQueries: z.array(z.string().trim().min(1).max(2_000)).max(100).default([]),
	})
	.strict();

export const browserRunnerLegacyObservationSchema = samplingObservationBaseSchema.extend({
	answerHtml: browserAnswerHtmlSchema,
});

export const browserRunnerStructuredObservationSchema = samplingObservationBaseSchema
	.extend({
		schemaVersion: z.literal("browser-runner-observation.v2"),
		queryAvailability: z.enum(["exposed", "unavailable", "not_searched", "unknown"]),
		citations: z.array(structuredCitationSchema).max(200).default([]),
		captureDiagnostics: z
			.object({
				answerCount: z.literal(1),
				queryCount: z.number().int().min(0).max(100),
				citationCount: z.number().int().min(0).max(200),
				completionCount: z.literal(1),
				extractorVersion: z.string().trim().min(1).max(100),
				evidenceSource: z.enum(["dom", "network", "dom_and_network", "none"]),
				searchBlockCount: z.number().int().min(0).max(10_000),
				queryCandidateCount: z.number().int().min(0).max(10_000),
				citationCandidateCount: z.number().int().min(0).max(10_000),
			})
			.strict(),
	})
	.superRefine((observation, context) => {
		if (observation.captureDiagnostics.queryCount !== observation.webQueries.length) {
			context.addIssue({ code: "custom", path: ["captureDiagnostics", "queryCount"], message: "Query count mismatch" });
		}
		if (observation.captureDiagnostics.citationCount !== observation.citations.length) {
			context.addIssue({
				code: "custom",
				path: ["captureDiagnostics", "citationCount"],
				message: "Citation count mismatch",
			});
		}
		const expectedAvailability =
			observation.queryAvailability === "exposed"
				? observation.webSearchObserved === true && observation.webQueries.length > 0
				: observation.queryAvailability === "unavailable"
					? observation.webSearchObserved === true && observation.webQueries.length === 0
					: observation.queryAvailability === "not_searched"
						? observation.webSearchObserved === false && observation.webQueries.length === 0
						: observation.webSearchObserved === null && observation.webQueries.length === 0;
		if (!expectedAvailability) {
			context.addIssue({
				code: "custom",
				path: ["queryAvailability"],
				message: "Query availability is inconsistent with observed search evidence",
			});
		}
		const citationUrls = new Set<string>();
		for (const [index, citation] of observation.citations.entries()) {
			let canonicalUrl: string;
			try {
				canonicalUrl = new URL(citation.url).href;
			} catch {
				continue;
			}
			if (citationUrls.has(canonicalUrl)) {
				context.addIssue({
					code: "custom",
					path: ["citations", index, "url"],
					message: "Citation URLs must be unique",
				});
			}
			citationUrls.add(canonicalUrl);
		}
	});

export type BrowserRunnerLegacyObservation = z.infer<typeof browserRunnerLegacyObservationSchema>;
export type BrowserRunnerStructuredObservation = z.infer<typeof browserRunnerStructuredObservationSchema>;
export type BrowserRunnerObservation = BrowserRunnerLegacyObservation | BrowserRunnerStructuredObservation;

export const samplingObservationInputSchema = samplingObservationBaseSchema.extend({
	operatorAttested: z.literal(true),
});

export type SamplingObservationInput = z.infer<typeof samplingObservationInputSchema>;
export type SamplingObservationBase = z.infer<typeof samplingObservationBaseSchema>;

function normalizeCitations(input: SamplingObservationBase["citations"]): Citation[] {
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

function assertEvidencePolicy(input: SamplingObservationBase, protocol: DeliveryProtocol): void {
	if (input.evidenceArtifactIds.length < protocol.evidence.minimumArtifacts) {
		throw new Error(`At least ${protocol.evidence.minimumArtifacts} evidence artifact(s) are required`);
	}
	if (new Set(input.evidenceArtifactIds).size !== input.evidenceArtifactIds.length) {
		throw new Error("Evidence artifact IDs must not contain duplicates");
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
	observation: SamplingObservationBase & {
		operatorAttested?: true;
		answerHtml?: string;
		schemaVersion?: "browser-runner-observation.v2";
		queryAvailability?: BrowserRunnerStructuredObservation["queryAvailability"];
		captureDiagnostics?: BrowserRunnerStructuredObservation["captureDiagnostics"];
	};
	captureActor?:
		| { kind: "operator"; id: string }
		| {
				kind: "browser_runner";
				id: string;
				adapterVersion: string;
				browserVersion: string;
				market: "CN";
				locale: "zh-CN";
				timezone: "Asia/Shanghai";
		  };
	operatorUserId?: string;
	leaseGeneration: number;
}) {
	const captureActor =
		input.captureActor ?? (input.operatorUserId ? { kind: "operator" as const, id: input.operatorUserId } : undefined);
	if (!captureActor) throw new Error("A capture actor is required");
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
	if (input.task.searchRequirement === "platform_default" && input.observation.searchMode !== "native_auto") {
		throw new Error("This task requires platform-default native-auto search mode");
	}
	if (
		(input.task.searchRequirement === "forbidden" || input.task.searchRequirement === "not_applicable") &&
		input.observation.searchMode !== "off"
	) {
		throw new Error("This task requires search mode to be off");
	}
	if (input.observation.searchMode === "off" && input.observation.webSearchObserved === true) {
		throw new Error("Search cannot be observed when search mode is off");
	}

	const target = resolveManualObservationTarget({
		surfaceTargetKey: input.task.surfaceTargetKey,
		captureRouteKey: input.task.captureRouteKey,
	});
	assertManualObservationPageUrl(target.surfaceTargetKey, input.observation.pageUrl);

	const citations = normalizeCitations(input.observation.citations);
	const mentionResult = analyzeMentions(input.observation.answerText, input.manifest.brand, input.manifest.competitors);
	const webSearchObserved =
		input.observation.searchMode === "native_auto"
			? (input.observation.webSearchObserved ?? null)
			: input.observation.searchMode === "on"
				? (input.observation.webSearchObserved ?? true)
				: false;
	const config = {
		model: target.model,
		provider:
			target.captureMode === "manual_import"
				? "manual-import"
				: target.captureMode === "browser_runner"
					? "browser-runner"
					: "assisted-browser",
		version: input.observation.modelVersion,
		webSearch: input.observation.searchMode !== "off",
	};
	const structuredCaptureDiagnostics =
		input.observation.schemaVersion === "browser-runner-observation.v2"
			? input.observation.captureDiagnostics
			: undefined;
	const structuredQueryAvailability =
		input.observation.schemaVersion === "browser-runner-observation.v2"
			? input.observation.queryAvailability
			: undefined;
	if (
		input.observation.schemaVersion === "browser-runner-observation.v2" &&
		(!structuredCaptureDiagnostics || !structuredQueryAvailability)
	) {
		throw new Error("Structured Browser Runner observations require search evidence metadata");
	}
	const captureMetadata = {
		measurementEligibility:
			captureActor.kind === "operator" ? "operator_attested_clean_session" : "browser_runner_clean_session",
		deliveryBatchId: input.task.batchId,
		deliveryTaskId: input.task.id,
		leaseGeneration: input.leaseGeneration,
		sessionMode: input.observation.sessionMode,
		searchMode: input.observation.searchMode,
		webSearchObserved,
		pageUrl: input.observation.pageUrl,
		reportedMarket: input.manifest.scope.market,
		reportedLocale: input.manifest.scope.locale,
		executionMarketVerified: false,
		localizationEvidence: captureActor.kind === "operator" ? "operator_attested" : "runner_registered_cn_unverified",
		...(captureActor.kind === "operator"
			? { operatorAttested: input.observation.operatorAttested, operatorReference: captureActor.id }
			: {}),
		captureActorKind: captureActor.kind,
		captureActorId: captureActor.id,
		...(captureActor.kind === "browser_runner"
			? {
					adapterVersion: captureActor.adapterVersion,
					browserVersion: captureActor.browserVersion,
					registeredMarket: captureActor.market,
					registeredLocale: captureActor.locale,
					registeredTimezone: captureActor.timezone,
					localizationRegistrationSource: "server_bound_runner_registration",
				}
			: {}),
		...(input.observation.schemaVersion === "browser-runner-observation.v2"
			? {
					responseSnapshotSchemaVersion: "response-snapshot.v2",
					queryAvailability: structuredQueryAvailability,
					captureDiagnostics: structuredCaptureDiagnostics,
				}
			: {}),
	};
	// Artifact IDs are lease-generation-local handles, while answer HTML is an
	// archive representation that can contain harmless renderer attributes. Neither
	// changes metric identity; evidence ownership and HTML integrity are validated
	// independently before persistence.
	const { answerHtml, captureDiagnostics, evidenceArtifactIds, schemaVersion, ...fingerprintedObservation } =
		input.observation;
	void answerHtml;
	void captureDiagnostics;
	void evidenceArtifactIds;
	void schemaVersion;
	const sampleFingerprint = createHash("sha256")
		.update(JSON.stringify({ taskId: input.task.id, observation: fingerprintedObservation }))
		.digest("hex");

	return {
		observedAt,
		target,
		config,
		webSearchObserved,
		captureMetadata,
		sampleFingerprint,
		citations,
		mentionResult,
		rawOutput: {
			schemaVersion: 1,
			captureMode: target.captureMode,
			answerText: input.observation.answerText,
			pageUrl: input.observation.pageUrl,
			webSearchObserved,
			citations,
			deliveryBatchId: input.task.batchId,
			deliveryTaskId: input.task.id,
		},
	};
}
