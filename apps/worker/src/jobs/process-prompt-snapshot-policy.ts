import { isAbsolute } from "node:path";
import type { SnapshotReservation } from "@workspace/lib/db/response-snapshots";
import type { ScrapeResult } from "@workspace/lib/providers/types";
import {
	isResponseSnapshotBundleSizeError,
	prepareResponseSnapshotBundle,
	type ResponseSnapshotDraft,
} from "@workspace/lib/response-snapshots/contract";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import { recordResponseSnapshot } from "@workspace/lib/response-snapshots/service";
import { normalizeResponseSnapshotCitations } from "../response-snapshot-citation-policy";
import { normalizeResponseSnapshotQueryEvidence } from "../response-snapshot-query-policy";

type SnapshotSource = NonNullable<ScrapeResult["snapshotSource"]>;
export type PromptResponseSnapshotStatus = "ready" | "already_ready" | "retry_later" | "failed";
const SNAPSHOT_CAPABLE_PROVIDERS = new Set(["brightdata", "dataforseo"]);

export function isPromptSnapshotCapableProvider(provider: string): boolean {
	return SNAPSHOT_CAPABLE_PROVIDERS.has(provider);
}

export function buildPromptObservationSearchEvidence(result: Pick<ScrapeResult, "webQueries" | "webSearchObserved">): {
	webQueries: string[];
	webSearchObserved: boolean | null;
} {
	return {
		webQueries: result.webQueries,
		webSearchObserved: result.webSearchObserved ?? null,
	};
}

export function assertPromptSnapshotCaptureConfiguration(input: {
	enabled: boolean;
	provider: string;
	storageRoot: string | undefined;
	required?: boolean;
}): void {
	const capable = isPromptSnapshotCapableProvider(input.provider);
	if (input.required && !input.enabled) {
		throw new Error("Response snapshot capture is required for overseas Run now");
	}
	if (input.required && !capable) {
		throw new Error(`Provider ${input.provider} cannot produce the response snapshot required for overseas Run now`);
	}
	if (!input.enabled || !capable) return;
	assertAbsoluteStorageRoot(input.storageRoot);
}

export function resolvePromptSnapshotCapturePolicy(input: {
	enabled: boolean;
	storageRoot: string | undefined;
	snapshotSource: SnapshotSource | undefined;
}): { storageRoot: string } | null {
	if (!input.enabled || !input.snapshotSource) return null;
	return { storageRoot: assertAbsoluteStorageRoot(input.storageRoot) };
}

function assertAbsoluteStorageRoot(storageRoot: string | undefined): string {
	if (!storageRoot || !isAbsolute(storageRoot)) {
		throw new Error("Snapshot storage root must be an absolute path when response snapshot capture is enabled");
	}
	return storageRoot;
}

export function buildPromptResponseSnapshotDraft(input: {
	promptRunId: string;
	brandId: string;
	scopeId: string | null;
	promptId: string;
	promptText: string;
	answerText: string;
	citations: ScrapeResult["citations"];
	webQueries: string[];
	webSearchEnabled: boolean;
	webSearchObserved?: boolean | null;
	brandMentioned: boolean;
	competitorsMentioned: string[];
	channel: string;
	modelVersion: string;
	market: string;
	locale: string;
	timezone: string;
	observedAt: Date;
	snapshotSource: SnapshotSource;
}): ResponseSnapshotDraft {
	const queryEvidence = normalizeResponseSnapshotQueryEvidence(input);

	const draft: ResponseSnapshotDraft = {
		runId: input.promptRunId,
		brandId: input.brandId,
		scopeId: input.scopeId,
		promptId: input.promptId,
		promptText: input.promptText,
		answerText: input.answerText,
		...(input.snapshotSource.answerHtml ? { answerHtml: input.snapshotSource.answerHtml } : {}),
		citations: normalizeResponseSnapshotCitations(input.citations),
		...queryEvidence,
		brandMentioned: input.brandMentioned,
		competitorsMentioned: input.competitorsMentioned,
		channel: input.channel,
		modelVersion: input.modelVersion,
		market: input.market,
		locale: input.locale,
		timezone: input.timezone,
		observedAt: input.observedAt.toISOString(),
		captureMethod: input.snapshotSource.captureMethod,
		contentSource: input.snapshotSource.contentSource,
		sourcePayloadSha256: input.snapshotSource.sourcePayloadSha256,
	};
	if (draft.contentSource !== "native_answer_html") return draft;
	try {
		prepareResponseSnapshotBundle(draft);
		return draft;
	} catch (error) {
		if (!isResponseSnapshotBundleSizeError(error)) throw error;
		const structuredDraft: ResponseSnapshotDraft = {
			...draft,
			answerHtml: undefined,
			contentSource: "rendered_from_structured_response",
		};
		prepareResponseSnapshotBundle(structuredDraft);
		return structuredDraft;
	}
}

export async function archivePromptResponseSnapshotBestEffort(
	input: {
		reservation: SnapshotReservation;
		draft: ResponseSnapshotDraft | (() => ResponseSnapshotDraft);
		storageRoot: string;
	},
	dependencies: {
		record?: typeof recordResponseSnapshot;
	} = {},
): Promise<{ status: "ready" | "already_ready" | "retry_later" | "failed"; snapshotId: string }> {
	try {
		const storage = new FilesystemResponseSnapshotStorage(input.storageRoot);
		const draft = typeof input.draft === "function" ? input.draft() : input.draft;
		const result = await (dependencies.record ?? recordResponseSnapshot)({
			reservation: input.reservation,
			draft,
			storage,
		});
		return { status: result.status, snapshotId: result.snapshotId };
	} catch {
		return { status: "retry_later", snapshotId: input.reservation.snapshotId };
	}
}
