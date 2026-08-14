import { resolve } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	resolveAuthSession: vi.fn(),
	parse: vi.fn(),
	authorize: vi.fn(),
	acquireLock: vi.fn(),
	loadRows: vi.fn(),
	assertRows: vi.fn(),
	createArchive: vi.fn(),
	recordAccess: vi.fn(),
	release: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/auth/resolve-session", () => ({ resolveAuthSession: mocks.resolveAuthSession }));
vi.mock("@workspace/lib/response-snapshots/filesystem-storage", () => ({
	FilesystemResponseSnapshotStorage: class {},
}));
vi.mock("@/server/response-snapshot-export", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/server/response-snapshot-export")>();
	return {
		...actual,
		acquireResponseSnapshotExportLock: mocks.acquireLock,
		assertResponseSnapshotExportRows: mocks.assertRows,
		authorizeResponseSnapshotExport: mocks.authorize,
		createResponseSnapshotExportArchive: mocks.createArchive,
		loadResponseSnapshotExportRows: mocks.loadRows,
		parseResponseSnapshotExportQuery: mocks.parse,
		recordResponseSnapshotExportAccess: mocks.recordAccess,
	};
});

import { ResponseSnapshotExportPolicyError } from "@/server/response-snapshot-export";
import { Route } from "./export";

type GetHandler = (input: { request: Request }) => Promise<Response>;
type MockRoute = { server: { handlers: { GET: GetHandler } } };

describe("customer response snapshot export route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("RESPONSE_SNAPSHOT_ROOT", resolve("snapshot-test-root"));
		mocks.resolveAuthSession.mockResolvedValue({ user: { id: "customer-1" } });
		mocks.parse.mockReturnValue({
			brandId: "stepfun",
			startDate: "2026-08-01",
			endDate: "2026-08-15",
			startUtc: new Date("2026-07-31T16:00:00Z"),
			endExclusiveUtc: new Date("2026-08-15T16:00:00Z"),
			mode: "estimate",
		});
		mocks.authorize.mockResolvedValue({ actorUserId: "customer-1", actorKind: "customer" });
		mocks.loadRows.mockResolvedValue([{ id: "snapshot-1" }]);
		mocks.assertRows.mockReturnValue({ count: 1, uncompressedBytes: 1234 });
		mocks.acquireLock.mockResolvedValue({ release: mocks.release });
		mocks.createArchive.mockReturnValue(Readable.from([Buffer.from("ZIP")]));
	});

	afterEach(() => vi.unstubAllEnvs());

	it("estimates without acquiring the duplicate-export lock", async () => {
		const response = await get();

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ count: 1, uncompressedBytes: 1234 });
		expect(mocks.acquireLock).not.toHaveBeenCalled();
	});

	it("streams a bounded download and releases its actor lock", async () => {
		mocks.parse.mockReturnValue({ ...mocks.parse(), mode: "download" });

		const response = await get();
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/zip");
		expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("ZIP");
		await vi.waitFor(() => expect(mocks.release).toHaveBeenCalledOnce());
	});

	it("returns 409 when the same actor already has an active export", async () => {
		mocks.parse.mockReturnValue({ ...mocks.parse(), mode: "download" });
		mocks.acquireLock.mockRejectedValue(new ResponseSnapshotExportPolicyError("Already running", 409));

		const response = await get();
		expect(response.status).toBe(409);
		expect(mocks.loadRows).not.toHaveBeenCalled();
	});
});

async function get(): Promise<Response> {
	return (Route as unknown as MockRoute).server.handlers.GET({
		request: new Request(
			"https://portal.test/api/app/response-snapshots/export?brandId=stepfun&start=2026-08-01&end=2026-08-15&mode=estimate",
		),
	});
}
