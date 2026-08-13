import { createHash } from "node:crypto";
import type { DeliveryTask } from "./db/schema";

export type DeliveryBatchStatus = "draft" | "frozen" | "in_progress" | "completed" | "cancelled";
export type DeliveryTaskStatus = "planned" | "available" | "claimed" | "succeeded" | "failed" | "cancelled";
export type DeliveryEvaluationRole = "scored" | "observation";
export type DeliverySessionRequirement =
	| "none"
	| "anonymous_clean"
	| "new_account_clean"
	| "dedicated_sampling_profile";
export type DeliverySearchRequirement = "not_applicable" | "required" | "forbidden" | "platform_default";

export interface DeliveryEvidencePolicy {
	minimumArtifacts: number;
	requireSha256: boolean;
	requirePageUrl: boolean;
	allowedUriSchemes: ("http" | "https")[];
}

export interface DeliveryProtocol {
	measurementWindow: {
		startsAt: string;
		endsAt: string;
	};
	evidence: DeliveryEvidencePolicy;
	notes?: string;
}

export const DEFAULT_DELIVERY_EVIDENCE_POLICY: DeliveryEvidencePolicy = {
	minimumArtifacts: 1,
	requireSha256: true,
	requirePageUrl: true,
	allowedUriSchemes: ["https", "http"],
};

export interface DeliveryTaskPlan {
	brandId: string;
	scopeId: string;
	promptId: string;
	promptText: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	sampleIndex: number;
	sessionRequirement: DeliverySessionRequirement;
	searchRequirement: DeliverySearchRequirement;
	evaluationRole?: DeliveryEvaluationRole;
}

export interface NormalizedDeliveryTaskPlan extends Omit<DeliveryTaskPlan, "evaluationRole"> {
	evaluationRole: DeliveryEvaluationRole;
}

export interface DeliveryManifestContext {
	batch: {
		id: string;
		brandId: string;
		scopeId: string;
		idempotencyKey: string;
		name: string;
	};
	scope: {
		id: string;
		key: string;
		name: string;
		market: string;
		locale: string;
		timezone: string;
	};
	brand: {
		id: string;
		name: string;
		website: string;
		additionalDomains: string[];
		aliases: string[];
	};
	competitors: {
		id: string;
		name: string;
		domains: string[];
		aliases: string[];
	}[];
	protocol: DeliveryProtocol;
}

export interface DeliveryManifestTaskSnapshot extends NormalizedDeliveryTaskPlan {
	id: string;
	slotKey: string;
}

export interface DeliveryManifestSnapshot extends DeliveryManifestContext {
	schemaVersion: 1;
	tasks: DeliveryManifestTaskSnapshot[];
}

export interface DeliveryCoverageCounts {
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

export interface DeliveryCoverage {
	overall: DeliveryCoverageCounts;
	byEvaluationRole: Record<DeliveryEvaluationRole, DeliveryCoverageCounts>;
}

const DELIVERY_BATCH_TRANSITIONS: Record<DeliveryBatchStatus, readonly DeliveryBatchStatus[]> = {
	draft: ["draft", "frozen", "cancelled"],
	frozen: ["frozen", "in_progress", "cancelled"],
	in_progress: ["in_progress", "completed", "cancelled"],
	completed: ["completed"],
	cancelled: ["cancelled"],
};

export function assertDeliveryBatchTransition(from: DeliveryBatchStatus, to: DeliveryBatchStatus): void {
	if (!DELIVERY_BATCH_TRANSITIONS[from].includes(to)) {
		throw new Error(`Delivery batch cannot transition from ${from} to ${to}`);
	}
}

export function normalizeDeliveryProtocol(protocol: DeliveryProtocol): DeliveryProtocol {
	const startsAt = parseProtocolInstant(protocol.measurementWindow.startsAt, "startsAt");
	const endsAt = parseProtocolInstant(protocol.measurementWindow.endsAt, "endsAt");
	if (endsAt.getTime() <= startsAt.getTime()) {
		throw new Error("Delivery measurementWindow endsAt must be after startsAt");
	}
	const minimumArtifacts = protocol.evidence.minimumArtifacts;
	if (!Number.isSafeInteger(minimumArtifacts) || minimumArtifacts < 0) {
		throw new Error("Delivery evidence minimumArtifacts must be a non-negative integer");
	}
	const allowedUriSchemes = [...new Set(protocol.evidence.allowedUriSchemes)].sort();
	if (allowedUriSchemes.some((scheme) => scheme !== "http" && scheme !== "https")) {
		throw new Error("Delivery evidence URI schemes must be http or https");
	}

	return {
		measurementWindow: {
			startsAt: startsAt.toISOString(),
			endsAt: endsAt.toISOString(),
		},
		evidence: {
			minimumArtifacts,
			requireSha256: protocol.evidence.requireSha256,
			requirePageUrl: protocol.evidence.requirePageUrl,
			allowedUriSchemes,
		},
		...(protocol.notes === undefined ? {} : { notes: protocol.notes }),
	};
}

function parseProtocolInstant(value: string, field: "startsAt" | "endsAt"): Date {
	const parsed = new Date(value);
	if (!value || Number.isNaN(parsed.getTime())) {
		throw new Error(`Delivery measurementWindow ${field} must be an ISO timestamp`);
	}
	return parsed;
}

export function normalizeDeliveryTaskPlan(input: DeliveryTaskPlan): NormalizedDeliveryTaskPlan {
	for (const [field, value] of Object.entries({
		brandId: input.brandId,
		scopeId: input.scopeId,
		promptId: input.promptId,
		surfaceTargetKey: input.surfaceTargetKey,
		captureRouteKey: input.captureRouteKey,
	})) {
		if (!value.trim()) throw new Error(`Delivery task ${field} must not be empty`);
	}
	if (!input.promptText.trim()) throw new Error("Delivery task promptText must not be empty");
	if (!Number.isSafeInteger(input.sampleIndex) || input.sampleIndex <= 0 || input.sampleIndex > 32_767) {
		throw new Error("Delivery task sampleIndex must be an integer between 1 and 32767");
	}

	return {
		brandId: input.brandId,
		scopeId: input.scopeId,
		promptId: input.promptId,
		promptText: input.promptText,
		surfaceTargetKey: input.surfaceTargetKey,
		captureRouteKey: input.captureRouteKey,
		sampleIndex: input.sampleIndex,
		sessionRequirement: input.sessionRequirement,
		searchRequirement: input.searchRequirement,
		evaluationRole: input.evaluationRole ?? "scored",
	};
}

export function buildDeliveryTaskSlotKey(input: DeliveryTaskPlan): string {
	return hashCanonicalJson(normalizeDeliveryTaskPlan(input));
}

export function buildDeliveryManifestSnapshot(
	context: DeliveryManifestContext,
	tasks: readonly DeliveryManifestTaskSnapshot[],
): DeliveryManifestSnapshot {
	if (tasks.length === 0) throw new Error("A delivery manifest must contain at least one task");

	const normalizedTasks = tasks
		.map((task) => ({ ...normalizeDeliveryTaskPlan(task), id: task.id, slotKey: task.slotKey }))
		.sort((left, right) => left.slotKey.localeCompare(right.slotKey) || left.id.localeCompare(right.id));
	const slotKeys = new Set(normalizedTasks.map(({ slotKey }) => slotKey));
	if (slotKeys.size !== normalizedTasks.length)
		throw new Error("A delivery manifest cannot contain duplicate task slots");

	return {
		schemaVersion: 1,
		...context,
		brand: {
			...context.brand,
			additionalDomains: [...context.brand.additionalDomains].sort(),
			aliases: [...context.brand.aliases].sort(),
		},
		competitors: context.competitors
			.map((competitor) => ({
				...competitor,
				domains: [...competitor.domains].sort(),
				aliases: [...competitor.aliases].sort(),
			}))
			.sort((left, right) => left.id.localeCompare(right.id)),
		protocol: normalizeDeliveryProtocol(context.protocol),
		tasks: normalizedTasks,
	};
}

export function buildDeliveryManifestHash(snapshot: DeliveryManifestSnapshot): string {
	return hashCanonicalJson(snapshot);
}

export function summarizeDeliveryCoverage(
	rows: readonly Pick<DeliveryTask, "status" | "evaluationRole">[],
): DeliveryCoverage {
	const scored = summarizeDeliveryCoverageCounts(rows.filter(({ evaluationRole }) => evaluationRole === "scored"));
	const observation = summarizeDeliveryCoverageCounts(
		rows.filter(({ evaluationRole }) => evaluationRole === "observation"),
	);

	return {
		overall: summarizeDeliveryCoverageCounts(rows),
		byEvaluationRole: { scored, observation },
	};
}

function summarizeDeliveryCoverageCounts(rows: readonly Pick<DeliveryTask, "status">[]): DeliveryCoverageCounts {
	const counts = {
		planned: 0,
		available: 0,
		claimed: 0,
		succeeded: 0,
		failed: 0,
		cancelled: 0,
	} satisfies Record<DeliveryTaskStatus, number>;
	for (const row of rows) counts[row.status] += 1;

	const total = rows.length;
	const attempted = counts.succeeded + counts.failed;
	const resolved = attempted + counts.cancelled;
	return {
		...counts,
		total,
		attempted,
		resolved,
		successCoverage: total === 0 ? null : counts.succeeded / total,
		completionCoverage: total === 0 ? null : resolved / total,
	};
}

function hashCanonicalJson(value: unknown): string {
	return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error("Delivery manifest cannot contain non-finite numbers");
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => {
				if (record[key] === undefined) throw new Error(`Delivery manifest field ${key} cannot be undefined`);
				return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
			})
			.join(",")}}`;
	}
	throw new Error(`Delivery manifest cannot contain ${typeof value}`);
}
