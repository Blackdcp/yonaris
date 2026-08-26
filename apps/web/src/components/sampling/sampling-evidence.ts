import type { SamplingEvidenceArtifactView, SamplingEvidenceKind, SamplingLease, SamplingTaskView } from "./types";

export const MAX_SAMPLING_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_SAMPLING_EVIDENCE_TASK_BYTES = 40 * 1024 * 1024;
export const MAX_SAMPLING_EVIDENCE_ARTIFACTS = 20;
export const SAMPLING_EVIDENCE_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
export const SAMPLING_EVIDENCE_API_PATH = "/api/admin/sampling/evidence";

const MIME_KIND: Readonly<Record<string, SamplingEvidenceKind>> = {
	"application/pdf": "page_snapshot",
	"image/jpeg": "screenshot",
	"image/jpg": "screenshot",
	"image/png": "screenshot",
	"image/webp": "screenshot",
};

const EXTENSION_KIND: Readonly<Record<string, SamplingEvidenceKind>> = {
	jpeg: "screenshot",
	jpg: "screenshot",
	pdf: "page_snapshot",
	png: "screenshot",
	webp: "screenshot",
};

export type SamplingEvidenceTransferState = "uploading" | "failed" | "ready" | "deleting";

export interface SamplingEvidenceFileLike {
	name: string;
	type: string;
	size: number;
}

export interface SamplingEvidenceValidationContext {
	artifactCount: number;
	totalBytes: number;
}

export type SamplingEvidenceValidationCode =
	| "unsupported_type"
	| "invalid_filename"
	| "empty_file"
	| "file_too_large"
	| "too_many_files"
	| "task_total_too_large";

export type SamplingEvidenceValidationResult =
	| { ok: true; kind: SamplingEvidenceKind }
	| { ok: false; code: SamplingEvidenceValidationCode };

export type SamplingEvidenceSubmitBlocker =
	| { code: "recovering" | "recovery_error" | "pending" | "failed" }
	| { code: "minimum"; minimumArtifacts: number };

export interface SamplingEvidenceSubmitState {
	state: SamplingEvidenceTransferState;
}

export interface SamplingEvidenceUploadInput {
	file: File;
	kind: SamplingEvidenceKind;
	task: Pick<SamplingTaskView, "brandId" | "id">;
	lease: Pick<SamplingLease, "leaseToken" | "leaseGeneration">;
	onProgress: (progress: number) => void;
}

export interface SamplingEvidenceUploadHandle {
	promise: Promise<SamplingEvidenceArtifactView>;
	abort: () => void;
}

export function samplingEvidenceClaimHeaders(input: {
	brandId: string;
	taskId: string;
	leaseToken: string;
	leaseGeneration: number;
}): Record<string, string> {
	return {
		"X-Yonaris-Brand-Id": input.brandId,
		"X-Yonaris-Task-Id": input.taskId,
		"X-Yonaris-Lease-Token": input.leaseToken,
		"X-Yonaris-Lease-Generation": String(input.leaseGeneration),
	};
}

export function samplingEvidenceUploadHeaders(input: SamplingEvidenceUploadInput): Record<string, string> {
	return {
		...samplingEvidenceClaimHeaders({
			brandId: input.task.brandId,
			taskId: input.task.id,
			leaseToken: input.lease.leaseToken,
			leaseGeneration: input.lease.leaseGeneration,
		}),
		"Content-Type": input.file.type || "application/octet-stream",
		"X-Yonaris-Evidence-Kind": input.kind,
		"X-Yonaris-Filename": encodeURIComponent(input.file.name),
	};
}

function extensionOf(fileName: string): string {
	const index = fileName.lastIndexOf(".");
	return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

export function evidenceKindForFile(file: SamplingEvidenceFileLike): SamplingEvidenceKind | null {
	const mimeType = file.type.trim().toLowerCase();
	if (MIME_KIND[mimeType]) return MIME_KIND[mimeType];
	// Some browsers omit MIME metadata for local files. The server still verifies
	// magic bytes, so the extension fallback is only a client-side convenience.
	if (!mimeType) return EXTENSION_KIND[extensionOf(file.name)] ?? null;
	return null;
}

export function validateSamplingEvidenceFile(
	file: SamplingEvidenceFileLike,
	context: SamplingEvidenceValidationContext,
): SamplingEvidenceValidationResult {
	const kind = evidenceKindForFile(file);
	if (!kind) {
		return { ok: false, code: "unsupported_type" };
	}
	if (!file.name.trim() || file.name.length > 255 || encodeURIComponent(file.name).length > 1_000) {
		return { ok: false, code: "invalid_filename" };
	}
	if (!Number.isSafeInteger(file.size) || file.size <= 0) {
		return { ok: false, code: "empty_file" };
	}
	if (file.size > MAX_SAMPLING_EVIDENCE_FILE_BYTES) {
		return { ok: false, code: "file_too_large" };
	}
	if (context.artifactCount >= MAX_SAMPLING_EVIDENCE_ARTIFACTS) {
		return { ok: false, code: "too_many_files" };
	}
	if (context.totalBytes + file.size > MAX_SAMPLING_EVIDENCE_TASK_BYTES) {
		return { ok: false, code: "task_total_too_large" };
	}
	return { ok: true, kind };
}

export function samplingEvidenceSubmitBlocker(input: {
	states: SamplingEvidenceSubmitState[];
	minimumArtifacts: number;
	recovering: boolean;
	recoveryError: string | true | null;
}): SamplingEvidenceSubmitBlocker | null {
	if (input.recovering) return { code: "recovering" };
	if (input.recoveryError) return { code: "recovery_error" };
	if (input.states.some(({ state }) => state === "uploading" || state === "deleting")) {
		return { code: "pending" };
	}
	if (input.states.some(({ state }) => state === "failed")) {
		return { code: "failed" };
	}
	const readyCount = input.states.filter(({ state }) => state === "ready").length;
	if (readyCount < input.minimumArtifacts) {
		return { code: "minimum", minimumArtifacts: input.minimumArtifacts };
	}
	return null;
}

export function formatEvidenceBytes(value: number): string {
	if (value < 1024) return `${value} B`;
	if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
	return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function responsePayload(xhr: XMLHttpRequest): unknown {
	if (xhr.response && typeof xhr.response === "object") return xhr.response;
	try {
		if (!xhr.responseText) return null;
		return JSON.parse(xhr.responseText);
	} catch {
		return null;
	}
}

function responseError(xhr: XMLHttpRequest): string {
	const payload = responsePayload(xhr);
	if (payload && typeof payload === "object") {
		const value = payload as { message?: unknown; error?: unknown };
		if (typeof value.message === "string" && value.message.trim()) return value.message;
		if (typeof value.error === "string" && value.error.trim()) return value.error;
	}
	return xhr.status ? `Evidence upload failed with status ${xhr.status}.` : "Evidence upload failed.";
}

function parseArtifact(payload: unknown): SamplingEvidenceArtifactView {
	const artifact = payload && typeof payload === "object" ? (payload as { artifact?: unknown }).artifact : null;
	if (!artifact || typeof artifact !== "object") throw new Error("The evidence service returned an invalid artifact.");
	const value = artifact as Partial<SamplingEvidenceArtifactView>;
	if (
		typeof value.id !== "string" ||
		(value.kind !== "screenshot" && value.kind !== "page_snapshot") ||
		typeof value.fileName !== "string" ||
		typeof value.mimeType !== "string" ||
		typeof value.sizeBytes !== "number" ||
		!Number.isSafeInteger(value.sizeBytes) ||
		value.sizeBytes <= 0 ||
		typeof value.sha256 !== "string" ||
		!/^[a-fA-F0-9]{64}$/.test(value.sha256) ||
		value.status !== "staged" ||
		typeof value.createdAt !== "string" ||
		typeof value.downloadUrl !== "string" ||
		!value.downloadUrl
	) {
		throw new Error("The evidence service returned incomplete artifact metadata.");
	}
	return {
		id: value.id,
		kind: value.kind,
		fileName: value.fileName,
		mimeType: value.mimeType,
		sizeBytes: value.sizeBytes,
		sha256: value.sha256.toLowerCase(),
		status: value.status,
		createdAt: value.createdAt,
		downloadUrl: value.downloadUrl,
	};
}

export function uploadSamplingEvidence(input: SamplingEvidenceUploadInput): SamplingEvidenceUploadHandle {
	const xhr = new XMLHttpRequest();
	const promise = new Promise<SamplingEvidenceArtifactView>((resolve, reject) => {
		xhr.open("POST", SAMPLING_EVIDENCE_API_PATH);
		xhr.withCredentials = true;
		xhr.timeout = 120_000;
		xhr.responseType = "json";
		for (const [name, value] of Object.entries(samplingEvidenceUploadHeaders(input))) {
			xhr.setRequestHeader(name, value);
		}
		xhr.upload.addEventListener("progress", (event) => {
			if (!event.lengthComputable || event.total <= 0) return;
			input.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
		});
		xhr.addEventListener("load", () => {
			if (xhr.status < 200 || xhr.status >= 300) {
				reject(new Error(responseError(xhr)));
				return;
			}
			try {
				resolve(parseArtifact(responsePayload(xhr)));
			} catch (error) {
				reject(error);
			}
		});
		xhr.addEventListener("error", () => reject(new Error("The evidence upload could not reach the server.")));
		xhr.addEventListener("timeout", () => reject(new Error("The evidence upload timed out. Try again.")));
		xhr.addEventListener("abort", () => {
			const error = new Error("Evidence upload cancelled.");
			error.name = "AbortError";
			reject(error);
		});
		xhr.send(input.file);
	});
	return { promise, abort: () => xhr.abort() };
}

export async function deleteSamplingEvidence(input: {
	artifactId: string;
	brandId: string;
	taskId: string;
	leaseToken: string;
	leaseGeneration: number;
}): Promise<void> {
	const response = await fetch(
		`${SAMPLING_EVIDENCE_API_PATH}/${encodeURIComponent(input.artifactId)}?brandId=${encodeURIComponent(input.brandId)}`,
		{
			method: "DELETE",
			credentials: "same-origin",
			headers: samplingEvidenceClaimHeaders(input),
		},
	);
	if (!response.ok) {
		let message = `Could not delete staged evidence (status ${response.status}).`;
		try {
			const payload = (await response.json()) as { message?: unknown; error?: unknown };
			if (typeof payload.message === "string" && payload.message.trim()) message = payload.message;
			else if (typeof payload.error === "string" && payload.error.trim()) message = payload.error;
		} catch {
			// Keep the status-based error when the response has no JSON body.
		}
		throw new Error(message);
	}
}
