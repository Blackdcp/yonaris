import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
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
const htmlBody = "<section>archived answer</section>";
const htmlBytes = Buffer.from(htmlBody, "utf8");
const sha256 = createHash("sha256").update(htmlBytes).digest("hex");

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
			body: htmlBytes,
			contentType: "text/html; charset=utf-8",
			contentEncoding: null,
			sha256,
			bytes: htmlBytes.byteLength,
			storedBytes: htmlBytes.byteLength,
		});
	});

	afterEach(() => vi.unstubAllEnvs());

	it("serves an own-brand HTML snapshot with sandbox headers and an audit event", async () => {
		const response = await get(`asset=html&download=0`);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe(htmlBody);
		expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
		expect(mocks.recordResponseSnapshotAccess).toHaveBeenCalledWith({
			snapshotId,
			brandId: "stepfun",
			actorUserId: "customer-1",
			asset: "html",
			download: false,
		});
	});

	it("decodes stored gzip bytes before sending an HTML preview", async () => {
		const body = Buffer.from("<section>compressed archived answer</section>", "utf8");
		const compressed = gzipSync(body);
		const bodySha256 = createHash("sha256").update(body).digest("hex");
		mocks.loadAuthorizedResponseSnapshot.mockResolvedValue({
			id: snapshotId,
			brandId: "stepfun",
			storageKey: "2026/08/15/stepfun/run-1/r1",
			htmlSha256: bodySha256,
			jsonSha256: "b".repeat(64),
			manifestSha256: "c".repeat(64),
			actorUserId: "customer-1",
			actorKind: "customer",
		});
		mocks.get.mockResolvedValue({
			asset: "html",
			body: compressed,
			contentType: "text/html; charset=utf-8",
			contentEncoding: "gzip",
			sha256: bodySha256,
			bytes: body.byteLength,
			storedBytes: compressed.byteLength,
		});

		const response = await get("asset=html&download=0");

		expect(response.headers.get("content-encoding")).toBeNull();
		expect(response.headers.get("content-length")).toBe(String(body.byteLength));
		expect(Buffer.from(await response.arrayBuffer())).toEqual(body);
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
