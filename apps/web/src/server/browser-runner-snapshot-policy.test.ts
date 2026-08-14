import type { SnapshotReservation } from "@workspace/lib/db/response-snapshots";
import { describe, expect, it, vi } from "vitest";
import {
	archiveBrowserRunnerResponseSnapshotBestEffort,
	assertBrowserRunnerSnapshotClaimCapacity,
	buildBrowserRunnerResponseSnapshotDraft,
} from "./browser-runner-snapshot-policy";

const reservation: SnapshotReservation = {
	snapshotId: "10000000-0000-4000-8000-000000000001",
	revision: 1,
	expiresAt: new Date("2026-11-13T00:00:00.000Z"),
};

describe("Browser Runner response snapshot policy", () => {
	it("allows new claims below 80% and stops them at 80% before a lease is allocated", async () => {
		await expect(
			assertBrowserRunnerSnapshotClaimCapacity(
				{ enabled: true, storageRoot: "/var/lib/yonaris/response-snapshots/v1" },
				{ statfs: async () => ({ blocks: 100, bavail: 21, bsize: 1 }) },
			),
		).resolves.toMatchObject({ usedPercent: 79 });

		await expect(
			assertBrowserRunnerSnapshotClaimCapacity(
				{ enabled: true, storageRoot: "/var/lib/yonaris/response-snapshots/v1" },
				{ statfs: async () => ({ blocks: 100, bavail: 20, bsize: 1 }) },
			),
		).rejects.toThrow(/80% capacity limit/);
	});

	it("fails closed when enabled storage is invalid or cannot be measured", async () => {
		await expect(
			assertBrowserRunnerSnapshotClaimCapacity(
				{ enabled: true, storageRoot: "relative/path" },
				{ statfs: async () => ({ blocks: 100, bavail: 100, bsize: 1 }) },
			),
		).rejects.toThrow(/absolute path/);
		await expect(
			assertBrowserRunnerSnapshotClaimCapacity(
				{ enabled: true, storageRoot: "/var/lib/yonaris/response-snapshots/v1" },
				{ statfs: async () => Promise.reject(new Error("offline")) },
			),
		).rejects.toThrow(/could not be measured/);
	});

	it("builds the standard domestic answer-container snapshot contract", () => {
		const draft = buildBrowserRunnerResponseSnapshotDraft({
			promptRunId: "run-1",
			brandId: "stepfun",
			scopeId: "scope-cn",
			promptId: "prompt-1",
			promptText: "请推荐一个大模型。",
			answerText: "StepFun 是一个可选方案。",
			answerHtml: '<section data-testid="answer"><p>StepFun 是一个可选方案。</p></section>',
			citations: [{ url: "https://stepfun.com/", title: "StepFun", domain: "stepfun.com", citationIndex: 0 }],
			webQueries: [],
			webSearchEnabled: true,
			brandMentioned: true,
			competitorsMentioned: [],
			channel: "doubao.consumer_web",
			modelVersion: "doubao-consumer-web",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			observedAt: new Date("2026-08-15T00:00:00.000Z"),
		});

		expect(draft).toMatchObject({
			captureMethod: "consumer_web_browser",
			contentSource: "browser_answer_html",
			queryAvailability: "unavailable",
			answerHtml: expect.stringContaining("data-testid"),
		});
	});

	it("keeps the successful observation successful when snapshot archiving fails", async () => {
		const record = vi.fn().mockRejectedValue(new Error("disk unavailable"));
		const result = await archiveBrowserRunnerResponseSnapshotBestEffort(
			{
				reservation,
				storageRoot: "/var/lib/yonaris/response-snapshots/v1",
				draft: {} as never,
			},
			{ record },
		);

		expect(result).toEqual({ status: "retry_later", snapshotId: reservation.snapshotId });
	});
});
