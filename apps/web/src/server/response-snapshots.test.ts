import { describe, expect, it } from "vitest";
import {
	assertReadableResponseSnapshot,
	ResponseSnapshotAccessError,
	resolveResponseSnapshotActorAccess,
} from "./response-snapshots";

describe("response snapshot customer access", () => {
	it("allows an own-brand customer and a global admin, but denies report operators", () => {
		expect(resolveResponseSnapshotActorAccess({ isAdmin: false, isReportOperator: false, hasBrandAccess: true })).toBe(
			"customer",
		);
		expect(resolveResponseSnapshotActorAccess({ isAdmin: true, isReportOperator: false, hasBrandAccess: false })).toBe(
			"platform_admin",
		);
		expect(() =>
			resolveResponseSnapshotActorAccess({ isAdmin: false, isReportOperator: true, hasBrandAccess: false }),
		).toThrowError(expect.objectContaining({ code: "forbidden" }));
	});

	it("uses a 404-safe boundary for cross-brand access", () => {
		expect(() =>
			resolveResponseSnapshotActorAccess({ isAdmin: false, isReportOperator: false, hasBrandAccess: false }),
		).toThrowError(expect.objectContaining({ code: "not_found" }));
	});

	it("exposes only ready current filesystem snapshots", () => {
		expect(() =>
			assertReadableResponseSnapshot({ status: "pending", isCurrent: true, storageBackend: null, storageKey: null }),
		).toThrowError(expect.objectContaining({ code: "pending" }));
		expect(() =>
			assertReadableResponseSnapshot({ status: "expired", isCurrent: true, storageBackend: null, storageKey: null }),
		).toThrowError(expect.objectContaining({ code: "expired" }));
		expect(() =>
			assertReadableResponseSnapshot({ status: "failed", isCurrent: true, storageBackend: null, storageKey: null }),
		).toThrowError(expect.objectContaining({ code: "not_found" }));
		expect(() =>
			assertReadableResponseSnapshot({
				status: "ready",
				isCurrent: false,
				storageBackend: "filesystem",
				storageKey: "2026/08/15/stepfun/run-1/r1",
			}),
		).toThrowError(expect.objectContaining({ code: "not_found" }));
		expect(
			assertReadableResponseSnapshot({
				status: "ready",
				isCurrent: true,
				storageBackend: "filesystem",
				storageKey: "2026/08/15/stepfun/run-1/r1",
			}),
		).toBe("2026/08/15/stepfun/run-1/r1");
	});

	it("has stable non-sensitive error codes", () => {
		const error = new ResponseSnapshotAccessError("not_found", "Snapshot is unavailable");
		expect(error).toMatchObject({ name: "ResponseSnapshotAccessError", code: "not_found" });
	});
});
