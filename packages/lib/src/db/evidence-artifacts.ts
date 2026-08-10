import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
	assertActiveDeliveryClaimInTransaction,
	type DeliveryClaimProof,
	type DeliveryTransaction,
} from "./delivery-batches";
import { deliveryTasks, type EvidenceArtifact, evidenceArtifacts } from "./schema";

export const EVIDENCE_ARTIFACT_MAX_BYTES = 8 * 1024 * 1024;
export const EVIDENCE_TASK_MAX_BYTES = 40 * 1024 * 1024;
export const EVIDENCE_BATCH_MAX_BYTES = 512 * 1024 * 1024;
export const EVIDENCE_ARTIFACT_MAX_COUNT = 20;
export const EVIDENCE_STAGED_TTL_MS = 24 * 60 * 60 * 1_000;

export type EvidenceArtifactKind = EvidenceArtifact["kind"];
export type EvidenceArtifactView = Omit<EvidenceArtifact, "content">;

export interface EvidenceArtifactReference {
	artifactId: string;
	type: EvidenceArtifactKind;
	uri: string;
	sha256: string;
	mediaType: string;
	byteSize: number;
}

export interface EvidenceArtifactDownload {
	artifact: EvidenceArtifactView;
	content: Buffer;
}

export type EvidenceArtifactValidationCode = "too_large" | "unsupported_media" | "kind_mismatch" | "invalid";

export class EvidenceArtifactValidationError extends Error {
	constructor(
		message: string,
		public readonly code: EvidenceArtifactValidationCode = "invalid",
	) {
		super(message);
		this.name = "EvidenceArtifactValidationError";
	}
}

export class EvidenceArtifactNotFoundError extends Error {
	constructor(public readonly artifactId: string) {
		super(`Evidence artifact ${artifactId} was not found`);
		this.name = "EvidenceArtifactNotFoundError";
	}
}

export class EvidenceArtifactStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EvidenceArtifactStateError";
	}
}

export async function stageEvidenceArtifact(input: {
	brandId: string;
	claim: DeliveryClaimProof;
	uploadedBy: string;
	originalFilename?: string;
	expectedKind?: EvidenceArtifactKind;
	content: Uint8Array;
}): Promise<EvidenceArtifactView> {
	const uploadedBy = requiredText(input.uploadedBy, "uploadedBy", 300);
	if (uploadedBy !== input.claim.claimedBy) {
		throw new EvidenceArtifactValidationError("The evidence uploader must own the active delivery claim");
	}
	const prepared = prepareEvidenceArtifact(input.content, input.expectedKind);
	const originalFilename = normalizeFilename(input.originalFilename);

	return db.transaction(async (tx) => {
		const active = await assertActiveDeliveryClaimInTransaction(tx, input.claim);
		if (active.task.brandId !== input.brandId || active.batch.brandId !== input.brandId) {
			throw new EvidenceArtifactStateError("The evidence task does not belong to the requested brand");
		}
		await tx
			.delete(evidenceArtifacts)
			.where(
				and(
					eq(evidenceArtifacts.taskId, active.task.id),
					eq(evidenceArtifacts.status, "staged"),
					ne(evidenceArtifacts.leaseGeneration, input.claim.leaseGeneration),
				),
			);

		const existing = await tx.query.evidenceArtifacts.findFirst({
			where: and(
				eq(evidenceArtifacts.taskId, active.task.id),
				eq(evidenceArtifacts.leaseGeneration, input.claim.leaseGeneration),
				eq(evidenceArtifacts.sha256, prepared.sha256),
			),
		});
		if (existing) {
			if (existing.uploadedBy !== uploadedBy || existing.status !== "staged") {
				throw new EvidenceArtifactStateError("An incompatible evidence artifact already occupies this task slot");
			}
			return redactEvidenceArtifact(existing);
		}

		const [usage] = await tx
			.select({
				artifactCount: sql<number>`count(*)::int`,
				byteSize: sql<number>`coalesce(sum(${evidenceArtifacts.byteSize}), 0)::int`,
			})
			.from(evidenceArtifacts)
			.where(eq(evidenceArtifacts.taskId, active.task.id));
		const artifactCount = Number(usage?.artifactCount ?? 0);
		const taskByteSize = Number(usage?.byteSize ?? 0);
		if (artifactCount >= EVIDENCE_ARTIFACT_MAX_COUNT) {
			throw new EvidenceArtifactValidationError(
				`A delivery task may contain at most ${EVIDENCE_ARTIFACT_MAX_COUNT} evidence artifacts`,
			);
		}
		if (!isEvidenceByteCapacityAvailable(taskByteSize, prepared.byteSize, EVIDENCE_TASK_MAX_BYTES)) {
			throw new EvidenceArtifactValidationError(
				`Evidence for one delivery task may not exceed ${EVIDENCE_TASK_MAX_BYTES} bytes`,
				"too_large",
			);
		}

		// assertActiveDeliveryClaimInTransaction holds the batch row lock, so this aggregate and insert
		// form one serialization fence for every evidence upload in the batch.
		const [batchUsage] = await tx
			.select({
				byteSize: sql<number>`coalesce(sum(${evidenceArtifacts.byteSize}), 0)::bigint`,
			})
			.from(evidenceArtifacts)
			.where(eq(evidenceArtifacts.batchId, active.task.batchId));
		const batchByteSize = Number(batchUsage?.byteSize ?? 0);
		if (!isEvidenceByteCapacityAvailable(batchByteSize, prepared.byteSize, EVIDENCE_BATCH_MAX_BYTES)) {
			throw new EvidenceArtifactValidationError(
				`Evidence for one delivery batch may not exceed ${EVIDENCE_BATCH_MAX_BYTES} bytes`,
				"too_large",
			);
		}

		const artifactId = randomUUID();
		const [inserted] = await tx
			.insert(evidenceArtifacts)
			.values({
				id: artifactId,
				taskId: active.task.id,
				batchId: active.task.batchId,
				brandId: active.task.brandId,
				scopeId: active.task.scopeId,
				leaseGeneration: input.claim.leaseGeneration,
				uploadedBy,
				kind: prepared.kind,
				mediaType: prepared.mediaType,
				originalFilename,
				byteSize: prepared.byteSize,
				sha256: prepared.sha256,
				storageBackend: "postgres",
				storageKey: `evidence/${artifactId}`,
				content: prepared.content,
			})
			.onConflictDoNothing({
				target: [evidenceArtifacts.taskId, evidenceArtifacts.leaseGeneration, evidenceArtifacts.sha256],
			})
			.returning();
		if (inserted) return redactEvidenceArtifact(inserted);

		const concurrentlyInserted = await tx.query.evidenceArtifacts.findFirst({
			where: and(
				eq(evidenceArtifacts.taskId, active.task.id),
				eq(evidenceArtifacts.leaseGeneration, input.claim.leaseGeneration),
				eq(evidenceArtifacts.sha256, prepared.sha256),
			),
		});
		if (
			!concurrentlyInserted ||
			concurrentlyInserted.uploadedBy !== uploadedBy ||
			concurrentlyInserted.status !== "staged"
		) {
			throw new EvidenceArtifactStateError("An incompatible evidence artifact already occupies this task slot");
		}
		return redactEvidenceArtifact(concurrentlyInserted);
	});
}

export function isEvidenceByteCapacityAvailable(
	currentBytes: number,
	incomingBytes: number,
	maximumBytes: number,
): boolean {
	return (
		Number.isSafeInteger(currentBytes) &&
		currentBytes >= 0 &&
		Number.isSafeInteger(incomingBytes) &&
		incomingBytes > 0 &&
		Number.isSafeInteger(maximumBytes) &&
		maximumBytes >= 0 &&
		currentBytes <= maximumBytes - incomingBytes
	);
}

export async function listEvidenceArtifactsForClaim(input: {
	brandId: string;
	claim: DeliveryClaimProof;
}): Promise<EvidenceArtifactView[]> {
	return db.transaction(async (tx) => {
		const active = await assertActiveDeliveryClaimInTransaction(tx, input.claim);
		if (active.task.brandId !== input.brandId) {
			throw new EvidenceArtifactStateError("The evidence task does not belong to the requested brand");
		}
		const rows = await tx
			.select()
			.from(evidenceArtifacts)
			.where(
				and(
					eq(evidenceArtifacts.brandId, input.brandId),
					eq(evidenceArtifacts.taskId, input.claim.taskId),
					eq(evidenceArtifacts.leaseGeneration, input.claim.leaseGeneration),
					eq(evidenceArtifacts.uploadedBy, input.claim.claimedBy),
				),
			)
			.orderBy(asc(evidenceArtifacts.createdAt), asc(evidenceArtifacts.id));
		return rows.map(redactEvidenceArtifact);
	});
}

export async function deleteStagedEvidenceArtifact(input: {
	brandId: string;
	artifactId: string;
	claim: DeliveryClaimProof;
}): Promise<EvidenceArtifactView> {
	return db.transaction(async (tx) => {
		const active = await assertActiveDeliveryClaimInTransaction(tx, input.claim);
		if (active.task.brandId !== input.brandId) {
			throw new EvidenceArtifactStateError("The evidence task does not belong to the requested brand");
		}
		const [artifact] = await tx
			.select()
			.from(evidenceArtifacts)
			.where(
				and(
					eq(evidenceArtifacts.id, input.artifactId),
					eq(evidenceArtifacts.brandId, input.brandId),
					eq(evidenceArtifacts.taskId, input.claim.taskId),
					eq(evidenceArtifacts.leaseGeneration, input.claim.leaseGeneration),
					eq(evidenceArtifacts.uploadedBy, input.claim.claimedBy),
					eq(evidenceArtifacts.status, "staged"),
				),
			)
			.limit(1)
			.for("update");
		if (!artifact) throw new EvidenceArtifactNotFoundError(input.artifactId);
		const [deleted] = await tx
			.delete(evidenceArtifacts)
			.where(and(eq(evidenceArtifacts.id, artifact.id), eq(evidenceArtifacts.status, "staged")))
			.returning();
		if (!deleted) throw new EvidenceArtifactStateError(`Evidence artifact ${artifact.id} is no longer staged`);
		return redactEvidenceArtifact(deleted);
	});
}

export async function readEvidenceArtifact(input: {
	brandId: string;
	artifactId: string;
}): Promise<EvidenceArtifactDownload> {
	const artifact = await db.query.evidenceArtifacts.findFirst({
		where: and(eq(evidenceArtifacts.id, input.artifactId), eq(evidenceArtifacts.brandId, input.brandId)),
	});
	if (!artifact) throw new EvidenceArtifactNotFoundError(input.artifactId);
	return { artifact: redactEvidenceArtifact(artifact), content: Buffer.from(artifact.content) };
}

export async function resolveEvidenceArtifactsForSubmission(
	executor: Pick<DeliveryTransaction, "select">,
	input: {
		brandId: string;
		claim: DeliveryClaimProof;
		artifactIds: readonly string[];
		uriForArtifact: (artifactId: string) => string;
	},
): Promise<EvidenceArtifactReference[]> {
	const artifactIds = validateArtifactIds(input.artifactIds);
	const active = await assertActiveDeliveryClaimInTransaction(executor, input.claim);
	if (active.task.brandId !== input.brandId) {
		throw new EvidenceArtifactStateError("The evidence task does not belong to the requested brand");
	}
	const artifacts = await executor
		.select()
		.from(evidenceArtifacts)
		.where(
			and(
				inArray(evidenceArtifacts.id, artifactIds),
				eq(evidenceArtifacts.brandId, input.brandId),
				eq(evidenceArtifacts.taskId, input.claim.taskId),
				eq(evidenceArtifacts.batchId, active.task.batchId),
				eq(evidenceArtifacts.scopeId, active.task.scopeId),
				eq(evidenceArtifacts.leaseGeneration, input.claim.leaseGeneration),
				eq(evidenceArtifacts.uploadedBy, input.claim.claimedBy),
				eq(evidenceArtifacts.status, "staged"),
			),
		)
		.for("update");
	if (artifacts.length !== artifactIds.length) {
		throw new EvidenceArtifactStateError("Every submitted evidence artifact must be staged by the active claim owner");
	}
	const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
	return artifactIds.map((artifactId) => {
		const artifact = artifactById.get(artifactId);
		if (!artifact) throw new EvidenceArtifactStateError(`Evidence artifact ${artifactId} could not be resolved`);
		return buildEvidenceArtifactReference(redactEvidenceArtifact(artifact), input.uriForArtifact);
	});
}

export async function attachEvidenceArtifactsInTransaction(
	executor: Pick<DeliveryTransaction, "select" | "update">,
	input: {
		brandId: string;
		claim: DeliveryClaimProof;
		artifactIds: readonly string[];
		observationAttemptId: string;
		uriForArtifact: (artifactId: string) => string;
	},
): Promise<{ artifacts: EvidenceArtifactView[]; evidenceRefs: EvidenceArtifactReference[] }> {
	const evidenceRefs = await resolveEvidenceArtifactsForSubmission(executor, input);
	const artifactIds = evidenceRefs.map(({ artifactId }) => artifactId);
	const attachedAt = new Date();
	const attached = await executor
		.update(evidenceArtifacts)
		.set({
			status: "attached",
			observationAttemptId: input.observationAttemptId,
			attachedAt,
		})
		.where(
			and(
				inArray(evidenceArtifacts.id, artifactIds),
				eq(evidenceArtifacts.status, "staged"),
				eq(evidenceArtifacts.taskId, input.claim.taskId),
				eq(evidenceArtifacts.leaseGeneration, input.claim.leaseGeneration),
			),
		)
		.returning();
	if (attached.length !== artifactIds.length) {
		throw new EvidenceArtifactStateError("Evidence artifacts changed before they could be attached");
	}
	return { artifacts: attached.map(redactEvidenceArtifact), evidenceRefs };
}

export async function cleanupStaleEvidenceArtifacts(input?: { before?: Date; limit?: number }): Promise<number> {
	const before = input?.before ?? new Date(Date.now() - EVIDENCE_STAGED_TTL_MS);
	if (Number.isNaN(before.getTime())) throw new EvidenceArtifactValidationError("Cleanup cutoff must be a valid date");
	const limit = input?.limit ?? 500;
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
		throw new EvidenceArtifactValidationError("Cleanup limit must be an integer between 1 and 1000");
	}
	const now = new Date();
	const inactiveClaim = or(
		ne(deliveryTasks.status, "claimed"),
		ne(deliveryTasks.leaseGeneration, evidenceArtifacts.leaseGeneration),
		lte(deliveryTasks.leaseExpiresAt, now),
	);
	if (!inactiveClaim) throw new Error("Failed to build stale evidence claim condition");
	const candidates = await db
		.select({ id: evidenceArtifacts.id })
		.from(evidenceArtifacts)
		.innerJoin(deliveryTasks, eq(deliveryTasks.id, evidenceArtifacts.taskId))
		.where(and(eq(evidenceArtifacts.status, "staged"), lt(evidenceArtifacts.createdAt, before), inactiveClaim))
		.orderBy(asc(evidenceArtifacts.createdAt), asc(evidenceArtifacts.id))
		.limit(limit);
	if (candidates.length === 0) return 0;
	const deleted = await db
		.delete(evidenceArtifacts)
		.where(
			and(
				inArray(
					evidenceArtifacts.id,
					candidates.map(({ id }) => id),
				),
				eq(evidenceArtifacts.status, "staged"),
				lt(evidenceArtifacts.createdAt, before),
			),
		)
		.returning({ id: evidenceArtifacts.id });
	return deleted.length;
}

export function prepareEvidenceArtifact(
	content: Uint8Array,
	expectedKind?: EvidenceArtifactKind,
): {
	content: Buffer;
	kind: EvidenceArtifactKind;
	mediaType: "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
	byteSize: number;
	sha256: string;
} {
	const buffer = Buffer.from(content);
	if (buffer.byteLength === 0) throw new EvidenceArtifactValidationError("Evidence artifact must not be empty");
	if (buffer.byteLength > EVIDENCE_ARTIFACT_MAX_BYTES) {
		throw new EvidenceArtifactValidationError(
			`Evidence artifact may not exceed ${EVIDENCE_ARTIFACT_MAX_BYTES} bytes`,
			"too_large",
		);
	}
	const detected = detectEvidenceMedia(buffer);
	if (expectedKind && expectedKind !== detected.kind) {
		throw new EvidenceArtifactValidationError(
			`Evidence artifact content is ${detected.kind}, not the requested ${expectedKind}`,
			"kind_mismatch",
		);
	}
	return {
		content: buffer,
		...detected,
		byteSize: buffer.byteLength,
		sha256: createHash("sha256").update(buffer).digest("hex"),
	};
}

export function buildEvidenceArtifactReference(
	artifact: EvidenceArtifactView,
	uriForArtifact: (artifactId: string) => string,
): EvidenceArtifactReference {
	const uri = uriForArtifact(artifact.id);
	let parsed: URL;
	try {
		parsed = new URL(uri);
	} catch {
		throw new EvidenceArtifactValidationError("Evidence artifact URI builder must return an absolute URL");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		throw new EvidenceArtifactValidationError("Evidence artifact URI must use HTTP or HTTPS");
	}
	return {
		artifactId: artifact.id,
		type: artifact.kind,
		uri: parsed.toString(),
		sha256: artifact.sha256,
		mediaType: artifact.mediaType,
		byteSize: artifact.byteSize,
	};
}

function detectEvidenceMedia(content: Buffer): {
	kind: EvidenceArtifactKind;
	mediaType: "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
} {
	if (
		content.byteLength >= 8 &&
		content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
	) {
		return { kind: "screenshot", mediaType: "image/png" };
	}
	if (
		content.byteLength >= 4 &&
		content[0] === 0xff &&
		content[1] === 0xd8 &&
		content[2] === 0xff &&
		content[content.byteLength - 2] === 0xff &&
		content[content.byteLength - 1] === 0xd9
	) {
		return { kind: "screenshot", mediaType: "image/jpeg" };
	}
	if (
		content.byteLength >= 12 &&
		content.toString("ascii", 0, 4) === "RIFF" &&
		content.toString("ascii", 8, 12) === "WEBP"
	) {
		return { kind: "screenshot", mediaType: "image/webp" };
	}
	if (content.byteLength >= 12 && content.toString("ascii", 0, 5) === "%PDF-") {
		const tail = content.subarray(Math.max(0, content.byteLength - 1_024)).toString("latin1");
		if (tail.includes("%%EOF")) return { kind: "page_snapshot", mediaType: "application/pdf" };
	}
	throw new EvidenceArtifactValidationError(
		"Evidence must be a valid PNG, JPEG, WebP, or PDF file",
		"unsupported_media",
	);
}

function validateArtifactIds(values: readonly string[]): string[] {
	if (values.length < 1 || values.length > EVIDENCE_ARTIFACT_MAX_COUNT) {
		throw new EvidenceArtifactValidationError(
			`Evidence submission must contain between 1 and ${EVIDENCE_ARTIFACT_MAX_COUNT} artifacts`,
		);
	}
	const ids = values.map((value) => value.trim().toLowerCase());
	if (ids.some((value) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))) {
		throw new EvidenceArtifactValidationError("Every evidence artifact ID must be a valid UUID");
	}
	if (new Set(ids).size !== ids.length) {
		throw new EvidenceArtifactValidationError("Evidence artifact IDs must not contain duplicates");
	}
	return ids;
}

function normalizeFilename(value: string | undefined): string | null {
	if (value === undefined) return null;
	const filename = stripFilenameControls(value).split(/[\\/]/).at(-1)?.trim();
	if (!filename) return null;
	if (filename.length > 255)
		throw new EvidenceArtifactValidationError("originalFilename must not exceed 255 characters");
	return filename;
}

function stripFilenameControls(value: string): string {
	return [...value]
		.filter((character) => {
			const code = character.charCodeAt(0);
			return code > 31 && code !== 127;
		})
		.join("");
}

function requiredText(value: string, field: string, maxLength: number): string {
	const normalized = value.trim();
	if (!normalized) throw new EvidenceArtifactValidationError(`${field} must not be empty`);
	if (normalized.length > maxLength) {
		throw new EvidenceArtifactValidationError(`${field} must not exceed ${maxLength} characters`);
	}
	return normalized;
}

function redactEvidenceArtifact(artifact: EvidenceArtifact): EvidenceArtifactView {
	const { content, ...view } = artifact;
	void content;
	return view;
}
