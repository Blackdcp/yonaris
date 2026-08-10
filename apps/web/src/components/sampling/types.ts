import type {
	ManualObservationCaptureRouteKey,
	ManualObservationSurfaceTargetKey,
} from "@workspace/lib/manual-observation-targets";

export type SamplingBatchStatus = "draft" | "frozen" | "in_progress" | "completed" | "cancelled";
export type SamplingTaskStatus = "planned" | "available" | "claimed" | "succeeded" | "failed" | "cancelled";
export type SamplingEvaluationRole = "scored" | "observation";
export type SamplingSessionRequirement = "anonymous_clean" | "new_account_clean";
export type SamplingSearchRequirement = "not_applicable" | "required" | "forbidden";

export interface SamplingCoverageCounts {
	planned: number;
	available: number;
	claimed: number;
	succeeded: number;
	failed: number;
	cancelled: number;
	total: number;
	attempted: number;
	resolved: number;
	successCoverage: number | null;
	completionCoverage: number | null;
}

export interface SamplingCoverage {
	overall: SamplingCoverageCounts;
	byEvaluationRole: Record<SamplingEvaluationRole, SamplingCoverageCounts>;
}

export interface SamplingBatchView {
	id: string;
	brandId: string;
	scopeId: string;
	scopeName: string;
	name: string;
	status: SamplingBatchStatus;
	plannedTaskCount: number;
	claimableTaskCount: number;
	manifestHash: string | null;
	createdAt: string | Date;
	frozenAt: string | Date | null;
	startedAt: string | Date | null;
	completedAt: string | Date | null;
	cancelledAt: string | Date | null;
	coverage: SamplingCoverage;
}

export interface SamplingBrandOption {
	id: string;
	name: string;
}

export interface SamplingScopeOption {
	id: string;
	key: string;
	name: string;
	market: string;
	locale: string;
	timezone: string;
	enabled: boolean;
	manualOnly: boolean;
	samplingEvaluationRole: SamplingEvaluationRole | null;
}

export interface SamplingPromptOption {
	id: string;
	scopeId: string | null;
	value: string;
	tags: string[];
	enabled: boolean;
}

export interface SamplingTargetOption {
	surfaceTargetKey: ManualObservationSurfaceTargetKey;
	captureRouteKey: ManualObservationCaptureRouteKey;
	model: string;
	label: string;
	launchUrl: string;
	surfaceKind: string;
	defaultSessionRequirement: "none" | SamplingSessionRequirement;
	defaultSearchRequirement: SamplingSearchRequirement;
}

export interface SamplingContextView {
	brands: SamplingBrandOption[];
	selectedBrand: {
		id: string;
		name: string;
		scopes: SamplingScopeOption[];
		prompts: SamplingPromptOption[];
	} | null;
	targets: SamplingTargetOption[];
}

export interface CreateSamplingBatchInput {
	brandId: string;
	scopeId: string;
	idempotencyKey: string;
	name: string;
	promptIds: string[];
	targets: Array<{
		surfaceTargetKey: ManualObservationSurfaceTargetKey;
		captureRouteKey?: ManualObservationCaptureRouteKey;
		samplesPerPrompt: number;
		evaluationRole: SamplingEvaluationRole;
		sessionRequirement: SamplingSessionRequirement;
		searchRequirement: SamplingSearchRequirement;
	}>;
	protocol: {
		measurementWindow: { startsAt: string; endsAt: string };
		evidence: {
			minimumArtifacts: number;
			requireSha256: true;
			requirePageUrl: true;
			allowedUriSchemes: Array<"http" | "https">;
		};
	};
}

export interface ProvisionSamplingScopeInput {
	brandId: string;
	key: string;
	name: string;
	market: string;
	locale: string;
	timezone: string;
	evaluationRole: SamplingEvaluationRole;
	sourceScopeId?: string;
}

export interface SamplingTaskView {
	id: string;
	batchId: string;
	batchName: string;
	brandId: string;
	brandName: string;
	status: SamplingTaskStatus;
	promptId: string;
	promptText: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	targetLabel: string;
	model: string;
	launchUrl: string;
	scopeId: string;
	scopeName: string;
	market: string;
	locale: string;
	timezone: string;
	sessionRequirement: SamplingSessionRequirement;
	searchRequirement: SamplingSearchRequirement;
	evaluationRole: SamplingEvaluationRole;
	sampleIndex: number;
	claimCount: number;
	leaseGeneration: number;
	leaseExpiresAt: string | Date | null;
	measurementWindowStartsAt: string;
	measurementWindowEndsAt: string;
	minimumEvidenceArtifacts: number;
	requireEvidenceSha256: boolean;
	requirePageUrl: boolean;
}

export interface SamplingLease {
	leaseToken: string;
	leaseGeneration: number;
	leaseExpiresAt: string | Date | null;
}

export type SamplingEvidenceKind = "screenshot" | "page_snapshot";

export interface SamplingEvidenceArtifactView {
	id: string;
	kind: SamplingEvidenceKind;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	sha256: string;
	status: "staged" | "attached";
	createdAt: string;
	downloadUrl: string;
}

export interface SamplingObservationInput {
	answerText: string;
	observedAt: string;
	pageUrl: string;
	sessionMode: SamplingSessionRequirement;
	searchMode: "on" | "off";
	operatorAttested: true;
	modelVersion?: string;
	evidenceArtifactIds: string[];
	citations?: Array<{ url: string }>;
	webQueries?: string[];
}
