import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, parse } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareResponseSnapshotBundle, type ResponseSnapshotDraft, type ResponseSnapshotDraftV2 } from "./contract";
import {
	FilesystemResponseSnapshotStorage,
	ResponseSnapshotStorageConflictError,
	ResponseSnapshotStoragePathError,
} from "./filesystem-storage";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "response-snapshot-storage-"));
	temporaryRoots.push(root);
	await chmod(root, 0o700);
	return root;
}

function draft(overrides: Partial<ResponseSnapshotDraft> = {}): ResponseSnapshotDraft {
	return {
		runId: "11111111-1111-4111-8111-111111111111",
		brandId: "stepfun",
		scopeId: "22222222-2222-4222-8222-222222222222",
		promptId: "33333333-3333-4333-8333-333333333333",
		promptText: "What is StepFun?",
		answerText: "StepFun builds foundation models.",
		answerHtml: "<p><strong>StepFun</strong> builds foundation models.</p>",
		citations: [],
		webQueries: [],
		queryAvailability: "available",
		brandMentioned: true,
		competitorsMentioned: [],
		channel: "doubao",
		modelVersion: "consumer-web",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		observedAt: "2026-08-15T01:02:03.000Z",
		captureMethod: "consumer_web_browser",
		contentSource: "browser_answer_html",
		...overrides,
	};
}

function v2Draft(): ResponseSnapshotDraftV2 {
	return {
		schemaVersion: "response-snapshot.v2",
		runId: "55555555-5555-4555-8555-555555555555",
		brandId: "ppio",
		scopeId: "22222222-2222-4222-8222-222222222222",
		promptId: "33333333-3333-4333-8333-333333333333",
		promptText: "What is PPIO?",
		answerText: "PPIO provides cloud services.",
		citations: [],
		webQueries: [],
		queryAvailability: "unavailable",
		brandMentioned: true,
		competitorsMentioned: [],
		channel: "doubao",
		modelVersion: "doubao-web-20260819-localpc-v8",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		observedAt: "2026-08-20T01:02:03.000Z",
		captureMethod: "consumer_web_browser",
		contentSource: "rendered_from_structured_response",
		visualEvidence: {
			artifactId: "44444444-4444-4444-8444-444444444444",
			mediaType: "image/jpeg",
			sha256: "b".repeat(64),
			bytes: 42_000,
		},
		adapterVersion: "doubao-web-20260819-localpc-v8",
		captureDiagnostics: { answerCount: 1, queryCount: 0, citationCount: 0, completionCount: 1 },
	};
}

describe("FilesystemResponseSnapshotStorage", () => {
	it("round-trips a v2 manifest with an external screenshot reference", async () => {
		const root = await temporaryRoot();
		const storage = new FilesystemResponseSnapshotStorage(root);
		const bundle = prepareResponseSnapshotBundle(v2Draft());

		const stored = await storage.put(bundle, 1);

		expect(stored.storageKey).toBe("ppio/2026/08/55555555-5555-4555-8555-555555555555/r1");
		expect(await storage.head(stored.storageKey)).toEqual(stored);
		expect(await storage.put(bundle, 1)).toEqual(stored);
		const manifest = await storage.createDownload(stored.storageKey, "manifest");
		expect(Buffer.from(manifest.body)).toEqual(Buffer.from(bundle.manifestJson));
		expect(JSON.parse(Buffer.from(manifest.body).toString("utf8")).visualEvidence).toEqual(v2Draft().visualEvidence);
	});

	it("writes a durable three-file revision and reads verified assets", async () => {
		const root = await temporaryRoot();
		const storage = new FilesystemResponseSnapshotStorage(root);
		const bundle = prepareResponseSnapshotBundle(draft());

		const stored = await storage.put(bundle, 1);

		expect(stored.storageKey).toBe("stepfun/2026/08/11111111-1111-4111-8111-111111111111/r1");
		expect(stored).toMatchObject({
			storageBackend: "filesystem",
			htmlSha256: bundle.htmlSha256,
			jsonSha256: bundle.jsonSha256,
			manifestSha256: bundle.manifestSha256,
		});
		expect(await storage.head(stored.storageKey)).toEqual(stored);

		const html = await storage.get(stored.storageKey, "html");
		expect(Buffer.from(html.body)).toEqual(Buffer.from(bundle.htmlGzip));
		expect(html).toMatchObject({ contentType: "text/html; charset=utf-8", contentEncoding: "gzip" });
		const manifest = await storage.createDownload(stored.storageKey, "manifest");
		expect(Buffer.from(manifest.body)).toEqual(Buffer.from(bundle.manifestJson));
		expect(manifest.fileName).toBe("response-snapshot-11111111-1111-4111-8111-111111111111-manifest.json");

		if (process.platform !== "win32") {
			expect((await lstat(root)).mode & 0o777).toBe(0o700);
			expect((await lstat(join(root, stored.storageKey))).mode & 0o777).toBe(0o700);
			expect((await lstat(join(root, stored.storageKey, "manifest.json"))).mode & 0o777).toBe(0o600);
		}
	});

	it("is idempotent for identical bytes and rejects a conflicting revision", async () => {
		const root = await temporaryRoot();
		const storage = new FilesystemResponseSnapshotStorage(root);
		const original = prepareResponseSnapshotBundle(draft());
		const first = await storage.put(original, 1);

		expect(await storage.put(original, 1)).toEqual(first);
		await expect(
			storage.put(
				prepareResponseSnapshotBundle(draft({ answerText: "Different answer", answerHtml: "<p>Different</p>" })),
				1,
			),
		).rejects.toBeInstanceOf(ResponseSnapshotStorageConflictError);
	});

	it("replaces an incomplete revision without deleting a complete sibling revision", async () => {
		const root = await temporaryRoot();
		const storage = new FilesystemResponseSnapshotStorage(root);
		const bundle = prepareResponseSnapshotBundle(draft());
		const sibling = await storage.put(bundle, 2);
		const partialKey = "stepfun/2026/08/11111111-1111-4111-8111-111111111111/r1";
		const partialDirectory = join(root, partialKey);
		await mkdir(partialDirectory, { recursive: true, mode: 0o700 });
		await writeFile(join(partialDirectory, "snapshot.html.gz"), "incomplete", { mode: 0o600 });
		await writeFile(join(partialDirectory, ".snapshot.json.gz.stale.tmp"), "incomplete", { mode: 0o600 });

		const stored = await storage.put(bundle, 1);

		expect(await storage.head(stored.storageKey)).toEqual(stored);
		expect(await storage.head(sibling.storageKey)).toEqual(sibling);
		await expect(readFile(join(partialDirectory, ".snapshot.json.gz.stale.tmp"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("validates hashes on every ready read", async () => {
		const root = await temporaryRoot();
		const storage = new FilesystemResponseSnapshotStorage(root);
		const stored = await storage.put(prepareResponseSnapshotBundle(draft()), 1);
		await writeFile(join(root, stored.storageKey, "snapshot.html.gz"), "corrupt");

		await expect(storage.head(stored.storageKey)).rejects.toThrow(/integrity/i);
		await expect(storage.get(stored.storageKey, "html")).rejects.toThrow(/integrity/i);
	});

	it("rejects impossible uncompressed sizes before inflating artifacts", async () => {
		const root = await temporaryRoot();
		const storage = new FilesystemResponseSnapshotStorage(root);
		const stored = await storage.put(prepareResponseSnapshotBundle(draft()), 1);
		const manifestPath = join(root, stored.storageKey, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest.artifacts.html.bytes = 512 * 1024 * 1024;
		await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

		await expect(storage.head(stored.storageKey)).rejects.toThrow(/metadata/i);
	});

	it("rejects missing or filesystem-root storage roots and unsafe opaque keys", async () => {
		const parent = await temporaryRoot();
		const missing = join(parent, "missing");
		const bundle = prepareResponseSnapshotBundle(draft());

		await expect(new FilesystemResponseSnapshotStorage(missing).put(bundle, 1)).rejects.toBeInstanceOf(
			ResponseSnapshotStoragePathError,
		);
		expect(() => new FilesystemResponseSnapshotStorage(parse(parent).root)).toThrow(ResponseSnapshotStoragePathError);

		const storage = new FilesystemResponseSnapshotStorage(parent);
		await expect(storage.get("../escape", "json")).rejects.toBeInstanceOf(ResponseSnapshotStoragePathError);
		await expect(storage.get(join(parse(parent).root, "absolute"), "json")).rejects.toBeInstanceOf(
			ResponseSnapshotStoragePathError,
		);
	});

	it.skipIf(process.platform === "win32")(
		"rejects symbolic-link roots, intermediate directories and leaves",
		async () => {
			const parent = await temporaryRoot();
			const realRoot = join(parent, "real");
			const linkedRoot = join(parent, "linked");
			const outside = join(parent, "outside");
			await mkdir(realRoot, { mode: 0o700 });
			await mkdir(outside, { mode: 0o700 });
			await symlink(realRoot, linkedRoot, "dir");

			await expect(
				new FilesystemResponseSnapshotStorage(linkedRoot).put(prepareResponseSnapshotBundle(draft()), 1),
			).rejects.toBeInstanceOf(ResponseSnapshotStoragePathError);

			const storage = new FilesystemResponseSnapshotStorage(realRoot);
			await symlink(outside, join(realRoot, "stepfun"), "dir");
			await expect(storage.put(prepareResponseSnapshotBundle(draft()), 1)).rejects.toBeInstanceOf(
				ResponseSnapshotStoragePathError,
			);

			await rm(join(realRoot, "stepfun"));
			const revisionDirectory = join(realRoot, "stepfun/2026/08/11111111-1111-4111-8111-111111111111/r1");
			await mkdir(revisionDirectory, { recursive: true, mode: 0o700 });
			await symlink(join(outside, "manifest.json"), join(revisionDirectory, "manifest.json"), "file");
			await expect(storage.put(prepareResponseSnapshotBundle(draft()), 1)).rejects.toBeInstanceOf(
				ResponseSnapshotStoragePathError,
			);
		},
	);

	it("deletes only the requested revision", async () => {
		const root = await temporaryRoot();
		const storage = new FilesystemResponseSnapshotStorage(root);
		const bundle = prepareResponseSnapshotBundle(draft());
		const first = await storage.put(bundle, 1);
		const second = await storage.put(bundle, 2);

		await storage.delete(first.storageKey);

		expect(await storage.head(first.storageKey)).toBeNull();
		expect(await storage.head(second.storageKey)).toEqual(second);
		expect(dirname(join(root, second.storageKey))).toBe(dirname(join(root, first.storageKey)));
	});
});
