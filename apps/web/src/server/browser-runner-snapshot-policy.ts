import { statfs as nodeStatfs } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { SnapshotReservation } from "@workspace/lib/db/response-snapshots";
import type { ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import { recordResponseSnapshot } from "@workspace/lib/response-snapshots/service";

const STOP_NEW_CLAIMS_USED_PERCENT = 80;

type StatfsResult = {
	blocks: number | bigint;
	bavail: number | bigint;
	bsize: number | bigint;
};

export class BrowserRunnerSnapshotCapacityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BrowserRunnerSnapshotCapacityError";
	}
}

export async function assertBrowserRunnerSnapshotClaimCapacity(
	input: { enabled: boolean; storageRoot: string | undefined },
	dependencies: { statfs?: (path: string) => Promise<StatfsResult> } = {},
): Promise<{ usedPercent: number } | null> {
	if (!input.enabled) return null;
	const storageRoot = assertAbsoluteStorageRoot(input.storageRoot);
	let stats: StatfsResult;
	try {
		stats = await (dependencies.statfs ?? nodeStatfs)(storageRoot);
	} catch {
		throw new BrowserRunnerSnapshotCapacityError("Response snapshot storage capacity could not be measured");
	}
	const blocks = Number(stats.blocks);
	const available = Number(stats.bavail);
	const blockSize = Number(stats.bsize);
	if (
		!Number.isFinite(blocks) ||
		!Number.isFinite(available) ||
		!Number.isFinite(blockSize) ||
		blocks <= 0 ||
		available < 0 ||
		available > blocks ||
		blockSize <= 0
	) {
		throw new BrowserRunnerSnapshotCapacityError("Response snapshot storage capacity is invalid");
	}
	const usedPercent = ((blocks - available) / blocks) * 100;
	if (usedPercent >= STOP_NEW_CLAIMS_USED_PERCENT) {
		throw new BrowserRunnerSnapshotCapacityError(
			`Response snapshot storage has reached the ${STOP_NEW_CLAIMS_USED_PERCENT}% capacity limit`,
		);
	}
	return { usedPercent };
}

function assertAbsoluteStorageRoot(storageRoot: string | undefined): string {
	if (!storageRoot || !isAbsolute(storageRoot)) {
		throw new BrowserRunnerSnapshotCapacityError(
			"Response snapshot storage root must be an absolute path when snapshot capture is enabled",
		);
	}
	return storageRoot;
}

export function buildBrowserRunnerResponseSnapshotDraft(input: {
	promptRunId: string;
	brandId: string;
	scopeId: string | null;
	promptId: string;
	promptText: string;
	answerText: string;
	answerHtml: string;
	citations: ResponseSnapshotDraft["citations"];
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
}): ResponseSnapshotDraft {
	return {
		runId: input.promptRunId,
		brandId: input.brandId,
		scopeId: input.scopeId,
		promptId: input.promptId,
		promptText: input.promptText,
		answerText: input.answerText,
		answerHtml: input.answerHtml,
		citations: input.citations,
		webQueries: input.webQueries,
		queryAvailability: input.webSearchEnabled
			? input.webQueries.length > 0
				? "available"
				: "unavailable"
			: "not_applicable",
		brandMentioned: input.brandMentioned,
		competitorsMentioned: input.competitorsMentioned,
		channel: input.channel,
		modelVersion: input.modelVersion,
		market: input.market,
		locale: input.locale,
		timezone: input.timezone,
		observedAt: input.observedAt.toISOString(),
		captureMethod: "consumer_web_browser",
		contentSource: "browser_answer_html",
	};
}

export async function archiveBrowserRunnerResponseSnapshotBestEffort(
	input: {
		reservation: SnapshotReservation;
		draft: ResponseSnapshotDraft | (() => ResponseSnapshotDraft);
		storageRoot: string;
	},
	dependencies: { record?: typeof recordResponseSnapshot } = {},
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
