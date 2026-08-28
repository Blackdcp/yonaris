import { describe, expect, it } from "vitest";
import {
	attachmentContentDisposition,
	buildResponseSnapshotAssetHeaders,
	parseResponseSnapshotAssetSelector,
} from "./response-snapshot-http";

describe("response snapshot HTTP contract", () => {
	it("accepts only the four fixed assets and binary download flag", () => {
		expect(
			parseResponseSnapshotAssetSelector(new URL("https://portal.example/snapshot?asset=html&download=0")),
		).toEqual({
			asset: "html",
			download: false,
		});
		expect(
			parseResponseSnapshotAssetSelector(new URL("https://portal.example/snapshot?asset=json&download=1")),
		).toEqual({
			asset: "json",
			download: true,
		});
		expect(
			parseResponseSnapshotAssetSelector(new URL("https://portal.example/snapshot?asset=screenshot&download=0")),
		).toEqual({
			asset: "screenshot",
			download: false,
		});
		const artifactId = "22222222-2222-4222-8222-222222222222";
		expect(
			parseResponseSnapshotAssetSelector(
				new URL(`https://portal.example/snapshot?asset=screenshot&download=1&artifactId=${artifactId}`),
			),
		).toEqual({ asset: "screenshot", download: true, artifactId });
		for (const search of ["asset=../../secret", "asset=html&download=yes", "asset=html&extra=1"]) {
			expect(() => parseResponseSnapshotAssetSelector(new URL(`https://portal.example/snapshot?${search}`))).toThrow();
		}
		expect(() =>
			parseResponseSnapshotAssetSelector(
				new URL(
					"https://portal.example/snapshot?asset=html&download=0&artifactId=22222222-2222-4222-8222-222222222222",
				),
			),
		).toThrow();
		expect(() =>
			parseResponseSnapshotAssetSelector(
				new URL("https://portal.example/snapshot?asset=screenshot&download=0&artifactId=not-a-guid"),
			),
		).toThrow();
	});

	it("sandboxes inline HTML and disables caching and MIME sniffing", () => {
		const headers = buildResponseSnapshotAssetHeaders({
			asset: "html",
			download: false,
			contentType: "text/html; charset=utf-8",
			contentEncoding: "gzip",
			sha256: "a".repeat(64),
			storedBytes: 123,
		});

		expect(headers.get("Cache-Control")).toBe("private, no-store");
		expect(headers.get("Content-Security-Policy")).toBe(
			"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
		);
		expect(headers.get("Content-Encoding")).toBe("gzip");
		expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(headers.get("ETag")).toBe(`"${"a".repeat(64)}"`);
	});

	it("uses a safe RFC 5987 attachment disposition", () => {
		expect(attachmentContentDisposition("response-snapshot-run-1-json")).toBe(
			"attachment; filename=\"response-snapshot-run-1-json\"; filename*=UTF-8''response-snapshot-run-1-json",
		);
		expect(() => attachmentContentDisposition("../../secret")).toThrow();
	});
});
