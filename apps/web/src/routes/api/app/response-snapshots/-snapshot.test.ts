import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseSnapshotAccessError } from "@/server/response-snapshots";

const mocks = vi.hoisted(() => ({
	resolveAuthSession: vi.fn(),
	loadAuthorizedResponseSnapshot: vi.fn(),
	recordResponseSnapshotAccess: vi.fn(),
	get: vi.fn(),
	createDownload: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => options,
}));

vi.mock("@/lib/auth/resolve-session", () => ({ resolveAuthSession: mocks.resolveAuthSession }));

vi.mock("@/server/response-snapshots", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/server/response-snapshots")>()),
	loadAuthorizedResponseSnapshot: mocks.loadAuthorizedResponseSnapshot,
	recordResponseSnapshotAccess: mocks.recordResponseSnapshotAccess,
}));

vi.mock("@workspace/lib/response-snapshots/filesystem-storage", () => ({
	FilesystemResponseSnapshotStorage: class {
		get = mocks.get;
		createDownload = mocks.createDownload;
	},
}));

import { Route } from "./$snapshotId";

type GetHandler = (input: { request: Request; params: { snapshotId: string } }) => Promise<Response>;
type MockRoute = { server: { handlers: { GET: GetHandler } } };

const snapshotId = "11111111-1111-4111-8111-111111111111";
const sha256 = "a".repeat(64);

describe("customer response snapshot asset route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("RESPONSE_SNAPSHOT_ROOT", resolve("snapshot-test-root"));
		mocks.resolveAuthSession.mockResolvedValue({ user: { id: "customer-1" } });
		mocks.loadAuthorizedResponseSnapshot.mockResolvedValue({
			id: snapshotId,
			brandId: "stepfun",
			storageKey: "2026/08/15/stepfun/run-1/r1",
			htmlSha256: sha256,
			jsonSha256: "b".repeat(64),
			manifestSha256: "c".repeat(64),
			actorUserId: "customer-1",
			actorKind: "customer",
		});
		mocks.get.mockResolvedValue({
			asset: "html",
			body: new TextEncoder().encode("<section>archived answer</section>"),
			contentType: "text/html; charset=utf-8",
			contentEncoding: null,
			sha256,
			bytes: 34,
			storedBytes: 34,
		});
	});

	afterEach(() => vi.unstubAllEnvs());

	it("serves an own-brand HTML snapshot with sandbox headers and an audit event", async () => {
		const response = await get(`asset=html&download=0`);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<section>archived answer</section>");
		expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
		expect(mocks.recordResponseSnapshotAccess).toHaveBeenCalledWith({
			snapshotId,
			brandId: "stepfun",
			actorUserId: "customer-1",
			asset: "html",
			download: false,
		});
	});

	it("returns 401 without touching storage for an anonymous request", async () => {
		mocks.loadAuthorizedResponseSnapshot.mockRejectedValue(
			new ResponseSnapshotAccessError("unauthorized", "Authentication required"),
		);

		const response = await get("asset=html&download=0");

		expect(response.status).toBe(401);
		expect(mocks.get).not.toHaveBeenCalled();
		expect(mocks.recordResponseSnapshotAccess).not.toHaveBeenCalled();
	});
});

async function get(search: string): Promise<Response> {
	return (Route as unknown as MockRoute).server.handlers.GET({
		request: new Request(`https://portal.example.test/api/app/response-snapshots/${snapshotId}?${search}`),
		params: { snapshotId },
	});
}
