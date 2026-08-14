import { gzipSync } from "node:zlib";
import type { ResponseSnapshotStorage } from "@workspace/lib/response-snapshots/storage";
import { describe, expect, it } from "vitest";
import {
	assertResponseSnapshotExportRows,
	buildResponseSnapshotExportEntryPath,
	createResponseSnapshotExportArchive,
	parseResponseSnapshotExportQuery,
	ResponseSnapshotExportPolicyError,
} from "./response-snapshot-export";

const now = new Date("2026-08-15T04:00:00.000Z");

function readyRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		promptRunId: "22222222-2222-4222-8222-222222222222",
		brandId: "stepfun",
		status: "ready" as const,
		isCurrent: true,
		storageBackend: "filesystem" as const,
		storageKey: "stepfun/2026/08/22222222-2222-4222-8222-222222222222/r1",
		channel: "doubao.consumer_web",
		observedAt: new Date("2026-08-14T16:30:00.000Z"),
		expiresAt: new Date("2026-11-12T16:30:00.000Z"),
		htmlBytes: 100,
		jsonBytes: 200,
		manifestBytes: 300,
		htmlSha256: "a".repeat(64),
		jsonSha256: "b".repeat(64),
		manifestSha256: "c".repeat(64),
		...overrides,
	};
}

describe("response snapshot export policy", () => {
	it("parses an inclusive Beijing-local date range", () => {
		const request = parseResponseSnapshotExportQuery(
			new URL("https://portal.test/export?brandId=stepfun&start=2026-08-01&end=2026-08-15&mode=download"),
			now,
		);

		expect(request).toMatchObject({ brandId: "stepfun", startDate: "2026-08-01", endDate: "2026-08-15" });
		expect(request.startUtc.toISOString()).toBe("2026-07-31T16:00:00.000Z");
		expect(request.endExclusiveUtc.toISOString()).toBe("2026-08-15T16:00:00.000Z");
	});

	it.each([
		"brandId=stepfun&start=2026-07-01&end=2026-08-15&mode=download",
		"brandId=stepfun&start=2026-08-16&end=2026-08-16&mode=download",
		"brandId=stepfun&start=2026-08-15&end=2026-08-01&mode=download",
		"brandId=../stepfun&start=2026-08-01&end=2026-08-15&mode=download",
		"brandId=stepfun&start=2026-08-01&end=2026-08-15&mode=download&path=secret",
	])("rejects an unsafe or out-of-policy query: %s", (search) => {
		expect(() => parseResponseSnapshotExportQuery(new URL(`https://portal.test/export?${search}`), now)).toThrow(
			ResponseSnapshotExportPolicyError,
		);
	});

	it("accepts only current, ready, authorized and unexpired filesystem rows below 2 GiB", () => {
		expect(assertResponseSnapshotExportRows([readyRow()], { brandId: "stepfun", now })).toEqual({
			count: 1,
			uncompressedBytes: 600,
		});

		for (const row of [
			readyRow({ brandId: "other" }),
			readyRow({ status: "expired" }),
			readyRow({ isCurrent: false }),
			readyRow({ storageKey: "../secret" }),
			readyRow({ expiresAt: now }),
			readyRow({ htmlBytes: 2 * 1024 * 1024 * 1024 }),
		]) {
			expect(() => assertResponseSnapshotExportRows([row], { brandId: "stepfun", now })).toThrow(
				ResponseSnapshotExportPolicyError,
			);
		}
	});

	it("builds a fixed path without accepting path-like channel names", () => {
		expect(buildResponseSnapshotExportEntryPath(readyRow(), "html")).toBe(
			"2026-08-15/doubao.consumer_web/22222222-2222-4222-8222-222222222222/snapshot.html",
		);
		expect(() => buildResponseSnapshotExportEntryPath(readyRow({ channel: "../doubao" }), "html")).toThrow(
			ResponseSnapshotExportPolicyError,
		);
	});

	it("streams verified, decompressed assets into a ZIP without staging an archive", async () => {
		const row = readyRow();
		const requestedAssets: string[] = [];
		let archived = false;
		const storage = {
			async get(_storageKey: string, asset: "html" | "json" | "manifest") {
				requestedAssets.push(asset);
				const plain = Buffer.from(
					asset === "html" ? "<p>answer</p>" : asset === "json" ? '{"answer":"answer"}\n' : "{}\n",
				);
				const compressed = asset === "manifest" ? plain : gzipSync(plain);
				return {
					asset,
					body: compressed,
					contentType: "application/octet-stream",
					contentEncoding: asset === "manifest" ? null : ("gzip" as const),
					sha256: {
						html: row.htmlSha256,
						json: row.jsonSha256,
						manifest: row.manifestSha256,
					}[asset] as string,
					bytes: plain.byteLength,
					storedBytes: compressed.byteLength,
				};
			},
		} satisfies Pick<ResponseSnapshotStorage, "get">;
		const archive = createResponseSnapshotExportArchive({
			rows: [row],
			storage,
			onArchived: async () => {
				archived = true;
			},
		});
		const chunks: Buffer[] = [];
		for await (const chunk of archive) chunks.push(Buffer.from(chunk));
		const zip = Buffer.concat(chunks).toString("latin1");

		expect(requestedAssets).toEqual(["html", "json", "manifest"]);
		expect(zip).toContain("2026-08-15/doubao.consumer_web/22222222-2222-4222-8222-222222222222/snapshot.html");
		expect(zip).toContain("2026-08-15/doubao.consumer_web/22222222-2222-4222-8222-222222222222/snapshot.json");
		expect(zip).toContain("2026-08-15/doubao.consumer_web/22222222-2222-4222-8222-222222222222/manifest.json");
		expect(archived).toBe(true);
	});
});
