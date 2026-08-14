import { isAbsolute } from "node:path";
import { WEB_QUERIES_UNAVAILABLE } from "@workspace/lib/constants";
import type { SnapshotReservation } from "@workspace/lib/db/response-snapshots";
import type { ScrapeResult } from "@workspace/lib/providers/types";
import type { ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import { recordResponseSnapshot } from "@workspace/lib/response-snapshots/service";

type SnapshotSource = NonNullable<ScrapeResult["snapshotSource"]>;

export function assertPromptSnapshotCaptureConfiguration(input: {
	enabled: boolean;
	provider: string;
	storageRoot: string | undefined;
}): void {
	if (!input.enabled || input.provider !== "brightdata") return;
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
	const queryUnavailable = input.webQueries.includes(WEB_QUERIES_UNAVAILABLE);
	const queryAvailability = input.webSearchEnabled
		? queryUnavailable
			? "unavailable"
			: "available"
		: "not_applicable";

	return {
		runId: input.promptRunId,
		brandId: input.brandId,
		scopeId: input.scopeId,
		promptId: input.promptId,
		promptText: input.promptText,
		answerText: input.answerText,
		...(input.snapshotSource.answerHtml ? { answerHtml: input.snapshotSource.answerHtml } : {}),
		citations: input.citations.map((citation) => ({
			url: citation.url,
			title: citation.title ?? null,
			domain: citation.domain,
			citationIndex: citation.citationIndex,
		})),
		webQueries: input.webQueries.filter((query) => query !== WEB_QUERIES_UNAVAILABLE),
		queryAvailability,
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
