import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import {
	type NewOverseasRunCall,
	type OverseasRunCall,
	type OverseasRunCohort,
	overseasRunCalls,
	overseasRunCohorts,
} from "./schema";

export type OverseasRunCallStatus = OverseasRunCall["status"];

export interface OverseasRunSummary {
	planned: number;
	queued: number;
	running: number;
	succeeded: number;
	failed: number;
}

export class OverseasRunStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OverseasRunStateError";
	}
}

export function summarizeOverseasRunCallStates(states: readonly OverseasRunCallStatus[]): OverseasRunSummary {
	const summary: OverseasRunSummary = { planned: states.length, queued: 0, running: 0, succeeded: 0, failed: 0 };
	for (const state of states) summary[state] += 1;
	return summary;
}

export function canClaimOverseasRunCall(call: Pick<OverseasRunCall, "status" | "paidIntentAt">): boolean {
	return call.status === "queued" && call.paidIntentAt === null;
}

export async function createOverseasRunCohort(input: {
	brandId: string;
	scopeId: string;
	idempotencyKey: string;
	manifest: unknown;
	manifestFingerprint: string;
	createdBy: string;
	calls: readonly Omit<NewOverseasRunCall, "cohortId" | "brandId" | "scopeId">[];
	now?: Date;
}): Promise<{ cohort: OverseasRunCohort; created: boolean }> {
	if (input.calls.length < 1 || input.calls.length > 10_000) {
		throw new OverseasRunStateError("An overseas cohort must contain between 1 and 10,000 calls");
	}
	const now = input.now ?? new Date();
	return db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(overseasRunCohorts)
			.values({
				brandId: input.brandId,
				scopeId: input.scopeId,
				idempotencyKey: input.idempotencyKey,
				manifest: input.manifest,
				manifestFingerprint: input.manifestFingerprint,
				status: "dispatch_pending",
				plannedCallCount: input.calls.length,
				createdBy: input.createdBy,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing({ target: [overseasRunCohorts.brandId, overseasRunCohorts.idempotencyKey] })
			.returning();

		if (!inserted) {
			const [existing] = await tx
				.select()
				.from(overseasRunCohorts)
				.where(
					and(
						eq(overseasRunCohorts.brandId, input.brandId),
						eq(overseasRunCohorts.idempotencyKey, input.idempotencyKey),
					),
				)
				.limit(1)
				.for("update");
			if (
				!existing ||
				existing.scopeId !== input.scopeId ||
				existing.manifestFingerprint !== input.manifestFingerprint ||
				existing.plannedCallCount !== input.calls.length ||
				JSON.stringify(existing.manifest) !== JSON.stringify(input.manifest)
			) {
				throw new OverseasRunStateError("The overseas Run now idempotency key belongs to a different manifest");
			}
			return { cohort: existing, created: false };
		}

		for (let offset = 0; offset < input.calls.length; offset += 500) {
			const values = input.calls.slice(offset, offset + 500).map((call) => ({
				...call,
				cohortId: inserted.id,
				brandId: input.brandId,
				scopeId: input.scopeId,
				status: "queued" as const,
				createdAt: now,
				updatedAt: now,
			}));
			await tx.insert(overseasRunCalls).values(values);
		}
		return { cohort: inserted, created: true };
	});
}

export async function getOverseasRunCohort(cohortId: string): Promise<OverseasRunCohort | null> {
	const [cohort] = await db.select().from(overseasRunCohorts).where(eq(overseasRunCohorts.id, cohortId)).limit(1);
	return cohort ?? null;
}

export async function listOverseasRunCohorts(input: {
	brandId: string;
	scopeId?: string;
	limit?: number;
}): Promise<OverseasRunCohort[]> {
	const where = input.scopeId
		? and(eq(overseasRunCohorts.brandId, input.brandId), eq(overseasRunCohorts.scopeId, input.scopeId))
		: eq(overseasRunCohorts.brandId, input.brandId);
	return db
		.select()
		.from(overseasRunCohorts)
		.where(where)
		.orderBy(desc(overseasRunCohorts.createdAt))
		.limit(Math.min(Math.max(input.limit ?? 20, 1), 100));
}

export async function listOverseasRunCalls(cohortId: string): Promise<OverseasRunCall[]> {
	return db
		.select()
		.from(overseasRunCalls)
		.where(eq(overseasRunCalls.cohortId, cohortId))
		.orderBy(asc(overseasRunCalls.createdAt), asc(overseasRunCalls.id));
}

export async function listUndispatchedOverseasRunCalls(cohortId: string): Promise<OverseasRunCall[]> {
	return db
		.select()
		.from(overseasRunCalls)
		.where(
			and(
				eq(overseasRunCalls.cohortId, cohortId),
				eq(overseasRunCalls.status, "queued"),
				isNull(overseasRunCalls.jobDispatchedAt),
			),
		)
		.orderBy(asc(overseasRunCalls.createdAt), asc(overseasRunCalls.id));
}

export async function markOverseasRunCallDispatched(input: { callId: string; now?: Date }): Promise<boolean> {
	const [updated] = await db
		.update(overseasRunCalls)
		.set({ jobDispatchedAt: input.now ?? new Date(), updatedAt: input.now ?? new Date() })
		.where(
			and(
				eq(overseasRunCalls.id, input.callId),
				eq(overseasRunCalls.status, "queued"),
				isNull(overseasRunCalls.jobDispatchedAt),
			),
		)
		.returning({ id: overseasRunCalls.id });
	return updated !== undefined;
}

export async function claimOverseasRunCall(input: { callId: string; now?: Date }): Promise<OverseasRunCall | null> {
	const now = input.now ?? new Date();
	return db.transaction(async (tx) => {
		const [call] = await tx
			.select()
			.from(overseasRunCalls)
			.where(eq(overseasRunCalls.id, input.callId))
			.limit(1)
			.for("update");
		if (!call || !canClaimOverseasRunCall(call)) return null;
		const [claimed] = await tx
			.update(overseasRunCalls)
			.set({ status: "running", startedAt: now, updatedAt: now })
			.where(
				and(
					eq(overseasRunCalls.id, call.id),
					eq(overseasRunCalls.status, "queued"),
					isNull(overseasRunCalls.paidIntentAt),
				),
			)
			.returning();
		if (!claimed) return null;
		await tx
			.update(overseasRunCohorts)
			.set({ status: "running", startedAt: now, updatedAt: now })
			.where(and(eq(overseasRunCohorts.id, claimed.cohortId), eq(overseasRunCohorts.status, "dispatch_pending")));
		return claimed;
	});
}

export async function recordOverseasPaidIntent(input: { callId: string; now?: Date }): Promise<OverseasRunCall> {
	const now = input.now ?? new Date();
	const [call] = await db
		.update(overseasRunCalls)
		.set({ paidIntentAt: now, updatedAt: now })
		.where(
			and(
				eq(overseasRunCalls.id, input.callId),
				eq(overseasRunCalls.status, "running"),
				isNull(overseasRunCalls.paidIntentAt),
			),
		)
		.returning();
	if (!call) throw new OverseasRunStateError("The overseas call is not ready for paid submission");
	return call;
}

export async function completeOverseasRunCall(input: {
	callId: string;
	observationAttemptId: string;
	promptRunId: string;
	providerSubmissionId?: string;
	now?: Date;
}): Promise<void> {
	const now = input.now ?? new Date();
	await db.transaction(async (tx) => {
		const [call] = await tx
			.update(overseasRunCalls)
			.set({
				status: "succeeded",
				observationAttemptId: input.observationAttemptId,
				promptRunId: input.promptRunId,
				providerSubmissionId: input.providerSubmissionId,
				completedAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(overseasRunCalls.id, input.callId),
					eq(overseasRunCalls.status, "running"),
					isNotNull(overseasRunCalls.paidIntentAt),
					isNull(overseasRunCalls.completedAt),
				),
			)
			.returning();
		if (!call) {
			throw new OverseasRunStateError("The overseas call cannot complete before paid intent");
		}
		await settleCohortIfTerminal(tx, call.cohortId, now);
	});
}

export async function failOverseasRunCall(input: {
	callId: string;
	failureClass: string;
	failureCode: string;
	failureMessage: string;
	now?: Date;
}): Promise<void> {
	const now = input.now ?? new Date();
	await db.transaction(async (tx) => {
		const [call] = await tx
			.update(overseasRunCalls)
			.set({
				status: "failed",
				failureClass: bounded(input.failureClass, 100),
				failureCode: bounded(input.failureCode, 100),
				failureMessage: bounded(input.failureMessage, 2_000),
				completedAt: now,
				updatedAt: now,
			})
			.where(and(eq(overseasRunCalls.id, input.callId), eq(overseasRunCalls.status, "running")))
			.returning();
		if (!call) throw new OverseasRunStateError("The overseas call is not running");
		await settleCohortIfTerminal(tx, call.cohortId, now);
	});
}

export async function summarizeOverseasRunCohort(cohortId: string): Promise<OverseasRunSummary> {
	const states = await db
		.select({ status: overseasRunCalls.status })
		.from(overseasRunCalls)
		.where(eq(overseasRunCalls.cohortId, cohortId));
	return summarizeOverseasRunCallStates(states.map(({ status }) => status));
}

async function settleCohortIfTerminal(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	cohortId: string,
	now: Date,
) {
	const nonterminal = await tx
		.select({ id: overseasRunCalls.id })
		.from(overseasRunCalls)
		.where(and(eq(overseasRunCalls.cohortId, cohortId), inArray(overseasRunCalls.status, ["queued", "running"])))
		.limit(1);
	if (nonterminal.length === 0) {
		await tx
			.update(overseasRunCohorts)
			.set({ status: "completed", completedAt: now, updatedAt: now })
			.where(and(eq(overseasRunCohorts.id, cohortId), eq(overseasRunCohorts.status, "running")));
	}
}

function bounded(value: string, maximum: number): string {
	const normalized = value.trim();
	return normalized.length > maximum ? normalized.slice(0, maximum) : normalized || "unknown";
}
