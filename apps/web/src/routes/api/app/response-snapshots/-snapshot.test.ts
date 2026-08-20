import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseSnapshotAccessError } from "@/server/response-snapshots";

const mocks = vi.hoisted(() => ({
	resolveAuthSession: vi.fn(),
	loadAuthorizedResponseSnapshot: vi.fn(),
	recordResponseSnapshotAccess: vi.fn(),
	loadAuthorizedResponseSnapshotScreenshot: vi.fn(),
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
	loadAuthorizedResponseSnapshotScreenshot: mocks.loadAuthorizedResponseSnapshotScreenshot,
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
const screenshotBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const screenshotSha256 = createHash("sha256").update(screenshotBytes).digest("hex");
const promptRunId = "33333333-3333-4333-8333-333333333333";
const manifestBytes = Buffer.from(
	`${JSON.stringify({
		schemaVersion: "response-snapshot-manifest.v2",
		runId: promptRunId,
		artifacts: {},
		visualEvidence: {
			artifactId: "22222222-2222-4222-8222-222222222222",
			mediaType: "image/jpeg",
			sha256: screenshotSha256,
			bytes: screenshotBytes.byteLength,
		},
	})}\n`,
	"utf8",
);
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");

describe("customer response snapshot asset route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("RESPONSE_SNAPSHOT_ROOT", resolve("snapshot-test-root"));
		mocks.resolveAuthSession.mockResolvedValue({ user: { id: "customer-1" } });
		mocks.loadAuthorizedResponseSnapshot.mockResolvedValue({
			id: snapshotId,
			promptRunId,
			brandId: "stepfun",
			schemaVersion: "response-snapshot.v2",
			storageKey: "2026/08/15/stepfun/run-1/r1",
			htmlSha256: sha256,
			jsonSha256: "b".repeat(64),
			manifestSha256,
			actorUserId: "customer-1",
			actorKind: "customer",
		});
		mocks.get.mockImplementation(async (_storageKey: string, asset: string) =>
			asset === "manifest"
				? {
						asset: "manifest",
						body: manifestBytes,
						contentType: "application/json; charset=utf-8",
						contentEncoding: null,
						sha256: manifestSha256,
						bytes: manifestBytes.byteLength,
						storedBytes: manifestBytes.byteLength,
					}
				: {
						asset: "html",
						body: htmlBytes,
						contentType: "text/html; charset=utf-8",
						contentEncoding: null,
						sha256,
						bytes: htmlBytes.byteLength,
						storedBytes: htmlBytes.byteLength,
					},
		);
		mocks.loadAuthorizedResponseSnapshotScreenshot.mockResolvedValue({
			artifactId: "22222222-2222-4222-8222-222222222222",
			mediaType: "image/jpeg",
			sha256: screenshotSha256,
			bytes: screenshotBytes.byteLength,
			content: screenshotBytes,
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

	it("serves authorized v2 visual evidence directly from the attached artifact", async () => {
		const response = await get("asset=screenshot&download=0");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/jpeg");
		expect(response.headers.get("content-security-policy")).toBeNull();
		expect(response.headers.get("x-yonaris-sha256")).toBe(screenshotSha256);
		expect(Buffer.from(await response.arrayBuffer())).toEqual(screenshotBytes);
		expect(mocks.get).toHaveBeenCalledWith("2026/08/15/stepfun/run-1/r1", "manifest");
		expect(mocks.createDownload).not.toHaveBeenCalled();
		expect(mocks.recordResponseSnapshotAccess).toHaveBeenCalledWith({
			snapshotId,
			brandId: "stepfun",
			actorUserId: "customer-1",
			asset: "screenshot",
			download: false,
		});
	});

	it("downloads visual evidence with a safe filename and a distinct audit action", async () => {
		const response = await get("asset=screenshot&download=1");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toContain(`response-snapshot-${snapshotId}.jpg`);
		expect(mocks.recordResponseSnapshotAccess).toHaveBeenCalledWith(
			expect.objectContaining({ asset: "screenshot", download: true }),
		);
	});

	it("returns 404 when a legacy snapshot has no attached visual evidence", async () => {
		mocks.loadAuthorizedResponseSnapshot.mockResolvedValue({
			...(await mocks.loadAuthorizedResponseSnapshot()),
			schemaVersion: "response-snapshot.v1",
		});
		mocks.loadAuthorizedResponseSnapshotScreenshot.mockResolvedValue(null);

		const response = await get("asset=screenshot&download=0");

		expect(response.status).toBe(404);
		expect(mocks.get).not.toHaveBeenCalled();
		expect(mocks.recordResponseSnapshotAccess).not.toHaveBeenCalled();
	});

	it("fails closed when attached visual evidence bytes do not match their digest", async () => {
		mocks.loadAuthorizedResponseSnapshotScreenshot.mockResolvedValue({
			artifactId: "22222222-2222-4222-8222-222222222222",
			mediaType: "image/jpeg",
			sha256: "f".repeat(64),
			bytes: screenshotBytes.byteLength,
			content: screenshotBytes,
		});

		const response = await get("asset=screenshot&download=0");

		expect(response.status).toBe(500);
		expect(mocks.recordResponseSnapshotAccess).not.toHaveBeenCalled();
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
