import type { SnapshotReservation } from "@workspace/lib/db/response-snapshots";
import { describe, expect, it, vi } from "vitest";
import {
	archiveBrowserRunnerResponseSnapshotBestEffort,
	buildBrowserRunnerResponseSnapshotDraft,
} from "./browser-runner-snapshot-policy";

describe("Browser extension response snapshots", () => {
	it("archives the current answer HTML without changing its existing metric facts", async () => {
		const draft = buildBrowserRunnerResponseSnapshotDraft({
			promptRunId: "run-1",
			brandId: "stepfun",
			scopeId: "scope-cn",
			promptId: "prompt-1",
			promptText: "Which AI platforms should a team evaluate?",
			answerText: "This valid answer does not mention the monitored brand.",
			answerHtml: "<article><p>This valid answer does not mention the monitored brand.</p></article>",
			citations: [],
			webQueries: [],
			webSearchEnabled: true,
			brandMentioned: false,
			competitorsMentioned: [],
			channel: "deepseek.consumer_web",
			modelVersion: "consumer-web",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			observedAt: new Date("2026-08-17T00:00:00.000Z"),
		});
		const record = vi.fn(async () => ({ status: "ready" as const, snapshotId: "snapshot-1" }));
		const reservation: SnapshotReservation = {
			snapshotId: "11111111-1111-4111-8111-111111111111",
			revision: 1,
			expiresAt: new Date("2026-11-15T00:00:00.000Z"),
		};

		await expect(
			archiveBrowserRunnerResponseSnapshotBestEffort(
				{ reservation, storageRoot: "/var/lib/yonaris/response-snapshots/v1", draft },
				{ record: record as never },
			),
		).resolves.toEqual({ status: "ready", snapshotId: "snapshot-1" });
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({
				draft: expect.objectContaining({
					captureMethod: "consumer_web_browser",
					contentSource: "browser_answer_html",
					brandMentioned: false,
				}),
			}),
		);
	});

	it("keeps the observation accepted when archive storage is unavailable", async () => {
		const reservation: SnapshotReservation = {
			snapshotId: "11111111-1111-4111-8111-111111111111",
			revision: 1,
			expiresAt: new Date("2026-11-15T00:00:00.000Z"),
		};
		await expect(
			archiveBrowserRunnerResponseSnapshotBestEffort(
				{ reservation, storageRoot: "/var/lib/yonaris/response-snapshots/v1", draft: {} as never },
				{ record: vi.fn().mockRejectedValue(new Error("disk unavailable")) },
			),
		).resolves.toEqual({ status: "retry_later", snapshotId: reservation.snapshotId });
	});
});
