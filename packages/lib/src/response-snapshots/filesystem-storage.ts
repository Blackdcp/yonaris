import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, readdir, readFile, rename, rmdir, unlink } from "node:fs/promises";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import type { PreparedResponseSnapshotBundle } from "./contract";
import type {
	ResponseSnapshotAsset,
	ResponseSnapshotAssetName,
	ResponseSnapshotDownload,
	ResponseSnapshotStorage,
	StoredResponseSnapshot,
} from "./storage";

const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_COMPRESSED_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_UNCOMPRESSED_ASSET_BYTES = 4 * 1024 * 1024;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,299}$/u;
const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

const ASSET_FILE_NAMES = {
	html: "snapshot.html.gz",
	json: "snapshot.json.gz",
	manifest: "manifest.json",
} as const satisfies Record<ResponseSnapshotAssetName, string>;

type SnapshotManifestArtifact = {
	fileName: "snapshot.html.gz" | "snapshot.json.gz";
	sha256: string;
	bytes: number;
	gzipBytes: number;
};

type SnapshotManifest = {
	schemaVersion: "response-snapshot-manifest.v1";
	runId: string;
	artifacts: {
		html: SnapshotManifestArtifact;
		json: SnapshotManifestArtifact;
	};
};

type ParsedStorageKey = {
	segments: [string, string, string, string, string];
	brandId: string;
	runId: string;
	revision: number;
};

export class ResponseSnapshotStorageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotStorageError";
	}
}

export class ResponseSnapshotStoragePathError extends ResponseSnapshotStorageError {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotStoragePathError";
	}
}

export class ResponseSnapshotStorageConflictError extends ResponseSnapshotStorageError {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotStorageConflictError";
	}
}

export class ResponseSnapshotStorageIntegrityError extends ResponseSnapshotStorageError {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotStorageIntegrityError";
	}
}

export class ResponseSnapshotStorageNotFoundError extends ResponseSnapshotStorageError {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotStorageNotFoundError";
	}
}

export class ResponseSnapshotStorageBusyError extends ResponseSnapshotStorageError {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotStorageBusyError";
	}
}

export class FilesystemResponseSnapshotStorage implements ResponseSnapshotStorage {
	readonly rootDirectory: string;

	constructor(rootDirectory: string) {
		if (!isAbsolute(rootDirectory)) {
			throw new ResponseSnapshotStoragePathError("Snapshot storage root must be an absolute path");
		}
		const resolvedRoot = resolve(rootDirectory);
		if (resolvedRoot === parse(resolvedRoot).root) {
			throw new ResponseSnapshotStoragePathError("Filesystem root cannot be used as snapshot storage");
		}
		this.rootDirectory = resolvedRoot;
	}

	async put(bundle: PreparedResponseSnapshotBundle, revision = 1): Promise<StoredResponseSnapshot> {
		const storageKey = createStorageKey(bundle, revision);
		const parsedKey = parseStorageKey(storageKey);
		await this.assertRoot();
		const revisionDirectory = await this.ensureDirectoryPath(parsedKey.segments);
		const existing = await this.head(storageKey);
		if (existing) return assertIdentical(existing, bundle);

		const lockPath = resolveContained(revisionDirectory, ".write.lock");
		await acquireWriteLock(lockPath);

		const suffix = `${process.pid}-${randomUUID()}`;
		const temporaryPaths = {
			html: resolveContained(revisionDirectory, `.snapshot.html.gz.${suffix}.tmp`),
			json: resolveContained(revisionDirectory, `.snapshot.json.gz.${suffix}.tmp`),
			manifest: resolveContained(revisionDirectory, `.manifest.json.${suffix}.tmp`),
		};
		try {
			const afterLock = await this.head(storageKey);
			if (afterLock) return assertIdentical(afterLock, bundle);
			await cleanIncompleteRevision(revisionDirectory);
			await writeDurableFile(temporaryPaths.html, bundle.htmlGzip);
			await writeDurableFile(temporaryPaths.json, bundle.jsonGzip);
			await writeDurableFile(temporaryPaths.manifest, bundle.manifestJson);
			await rename(temporaryPaths.html, resolveContained(revisionDirectory, ASSET_FILE_NAMES.html));
			await rename(temporaryPaths.json, resolveContained(revisionDirectory, ASSET_FILE_NAMES.json));
			await rename(temporaryPaths.manifest, resolveContained(revisionDirectory, ASSET_FILE_NAMES.manifest));
			await syncDirectory(revisionDirectory);
			const stored = await this.head(storageKey);
			if (!stored) throw new ResponseSnapshotStorageIntegrityError("Snapshot commit did not produce a manifest");
			return assertIdentical(stored, bundle);
		} catch (error) {
			await cleanupOwnAttempt(revisionDirectory, temporaryPaths);
			throw error;
		} finally {
			await unlinkIfExists(lockPath);
		}
	}

	async head(storageKey: string): Promise<StoredResponseSnapshot | null> {
		const parsedKey = parseStorageKey(storageKey);
		await this.assertRoot();
		const revisionDirectory = await this.findDirectoryPath(parsedKey.segments);
		if (!revisionDirectory) return null;
		const manifestPath = resolveContained(revisionDirectory, ASSET_FILE_NAMES.manifest);
		const manifestStat = await safeLeafStat(manifestPath);
		if (!manifestStat) return null;
		if (manifestStat.size <= 0 || manifestStat.size > MAX_MANIFEST_BYTES) {
			throw new ResponseSnapshotStorageIntegrityError("Snapshot manifest has an invalid size");
		}
		const manifestJson = await readFile(manifestPath);
		const manifest = parseManifest(manifestJson);
		if (manifest.runId !== parsedKey.runId) {
			throw new ResponseSnapshotStorageIntegrityError("Snapshot manifest run identity does not match its key");
		}
		const htmlGzip = await readVerifiedCompressedAsset(
			resolveContained(revisionDirectory, ASSET_FILE_NAMES.html),
			manifest.artifacts.html,
		);
		const jsonGzip = await readVerifiedCompressedAsset(
			resolveContained(revisionDirectory, ASSET_FILE_NAMES.json),
			manifest.artifacts.json,
		);

		return {
			storageBackend: "filesystem",
			storageKey,
			brandId: parsedKey.brandId,
			runId: parsedKey.runId,
			revision: parsedKey.revision,
			htmlSha256: manifest.artifacts.html.sha256,
			jsonSha256: manifest.artifacts.json.sha256,
			manifestSha256: sha256(manifestJson),
			htmlBytes: manifest.artifacts.html.bytes,
			jsonBytes: manifest.artifacts.json.bytes,
			manifestBytes: manifestJson.byteLength,
			htmlGzipBytes: htmlGzip.byteLength,
			jsonGzipBytes: jsonGzip.byteLength,
		};
	}

	async get(storageKey: string, asset: ResponseSnapshotAssetName): Promise<ResponseSnapshotAsset> {
		const stored = await this.head(storageKey);
		if (!stored) throw new ResponseSnapshotStorageNotFoundError("Snapshot revision is not available");
		const parsedKey = parseStorageKey(storageKey);
		const revisionDirectory = await this.findDirectoryPath(parsedKey.segments);
		if (!revisionDirectory) throw new ResponseSnapshotStorageNotFoundError("Snapshot revision is not available");
		if (asset === "html") {
			const body = await readVerifiedCompressedAsset(resolveContained(revisionDirectory, ASSET_FILE_NAMES.html), {
				fileName: ASSET_FILE_NAMES.html,
				sha256: stored.htmlSha256,
				bytes: stored.htmlBytes,
				gzipBytes: stored.htmlGzipBytes,
			});
			return {
				asset,
				body,
				contentType: "text/html; charset=utf-8",
				contentEncoding: "gzip",
				sha256: stored.htmlSha256,
				bytes: stored.htmlBytes,
				storedBytes: stored.htmlGzipBytes,
			};
		}
		if (asset === "json") {
			const body = await readVerifiedCompressedAsset(resolveContained(revisionDirectory, ASSET_FILE_NAMES.json), {
				fileName: ASSET_FILE_NAMES.json,
				sha256: stored.jsonSha256,
				bytes: stored.jsonBytes,
				gzipBytes: stored.jsonGzipBytes,
			});
			return {
				asset,
				body,
				contentType: "application/json; charset=utf-8",
				contentEncoding: "gzip",
				sha256: stored.jsonSha256,
				bytes: stored.jsonBytes,
				storedBytes: stored.jsonGzipBytes,
			};
		}
		const body = await readFile(resolveContained(revisionDirectory, ASSET_FILE_NAMES.manifest));
		if (body.byteLength !== stored.manifestBytes || sha256(body) !== stored.manifestSha256) {
			throw new ResponseSnapshotStorageIntegrityError("Snapshot manifest changed during read");
		}
		return {
			asset,
			body,
			contentType: "application/json; charset=utf-8",
			contentEncoding: null,
			sha256: stored.manifestSha256,
			bytes: stored.manifestBytes,
			storedBytes: stored.manifestBytes,
		};
	}

	async createDownload(storageKey: string, asset: ResponseSnapshotAssetName): Promise<ResponseSnapshotDownload> {
		const parsedKey = parseStorageKey(storageKey);
		const value = await this.get(storageKey, asset);
		const suffix = asset === "manifest" ? "manifest.json" : asset;
		return { ...value, fileName: `response-snapshot-${parsedKey.runId}-${suffix}` };
	}

	async delete(storageKey: string): Promise<void> {
		const parsedKey = parseStorageKey(storageKey);
		await this.assertRoot();
		const revisionDirectory = await this.findDirectoryPath(parsedKey.segments);
		if (!revisionDirectory) return;
		const entries = await readdir(revisionDirectory);
		if (entries.includes(".write.lock")) {
			throw new ResponseSnapshotStorageBusyError("Snapshot revision is being written");
		}
		for (const entry of entries) {
			if (!isOwnedSnapshotFile(entry)) {
				throw new ResponseSnapshotStoragePathError("Snapshot revision contains an unrecognized entry");
			}
			const entryPath = resolveContained(revisionDirectory, entry);
			const entryStat = await safeLeafStat(entryPath);
			if (entryStat) await unlink(entryPath);
		}
		await rmdir(revisionDirectory);
		await syncDirectory(resolve(revisionDirectory, ".."));
	}

	private async assertRoot(): Promise<void> {
		let rootStat: Awaited<ReturnType<typeof lstat>>;
		try {
			rootStat = await lstat(this.rootDirectory);
		} catch (error) {
			if (isNodeError(error, "ENOENT")) {
				throw new ResponseSnapshotStoragePathError("Snapshot storage root does not exist");
			}
			throw error;
		}
		if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
			throw new ResponseSnapshotStoragePathError("Snapshot storage root must be a real directory");
		}
	}

	private async ensureDirectoryPath(segments: readonly string[]): Promise<string> {
		let current = this.rootDirectory;
		for (const segment of segments) {
			current = resolveContained(current, segment);
			let currentStat = await lstatOrNull(current);
			if (!currentStat) {
				try {
					await mkdir(current, { mode: DIRECTORY_MODE });
				} catch (error) {
					if (!isNodeError(error, "EEXIST")) throw error;
				}
				currentStat = await lstatOrNull(current);
			}
			assertDirectory(currentStat, current);
		}
		return current;
	}

	private async findDirectoryPath(segments: readonly string[]): Promise<string | null> {
		let current = this.rootDirectory;
		for (const segment of segments) {
			current = resolveContained(current, segment);
			const currentStat = await lstatOrNull(current);
			if (!currentStat) return null;
			assertDirectory(currentStat, current);
		}
		return current;
	}
}

function createStorageKey(bundle: PreparedResponseSnapshotBundle, revision: number): string {
	if (!SAFE_IDENTIFIER.test(bundle.brandId) || bundle.brandId === "." || bundle.brandId === "..") {
		throw new ResponseSnapshotStoragePathError("brandId cannot be represented in a snapshot storage key");
	}
	if (!SAFE_RUN_ID.test(bundle.runId)) {
		throw new ResponseSnapshotStoragePathError("runId cannot be represented in a snapshot storage key");
	}
	if (!Number.isInteger(revision) || revision < 1 || revision > 32_767) {
		throw new ResponseSnapshotStoragePathError("revision must be an integer between 1 and 32767");
	}
	const observedAt = new Date(bundle.observedAt);
	if (Number.isNaN(observedAt.getTime())) throw new ResponseSnapshotStoragePathError("observedAt is invalid");
	const year = String(observedAt.getUTCFullYear()).padStart(4, "0");
	const month = String(observedAt.getUTCMonth() + 1).padStart(2, "0");
	return `${bundle.brandId}/${year}/${month}/${bundle.runId}/r${revision}`;
}

function parseStorageKey(storageKey: string): ParsedStorageKey {
	if (!storageKey || storageKey.includes("\\") || storageKey.startsWith("/") || storageKey.endsWith("/")) {
		throw new ResponseSnapshotStoragePathError("Invalid snapshot storage key");
	}
	const parts = storageKey.split("/");
	if (parts.length !== 5) throw new ResponseSnapshotStoragePathError("Invalid snapshot storage key");
	const [brandId, year, month, runId, revisionPart] = parts;
	if (
		!brandId ||
		!year ||
		!month ||
		!runId ||
		!revisionPart ||
		!SAFE_IDENTIFIER.test(brandId) ||
		!SAFE_RUN_ID.test(runId) ||
		!/^\d{4}$/u.test(year) ||
		!/^(0[1-9]|1[0-2])$/u.test(month) ||
		!/^r[1-9]\d{0,4}$/u.test(revisionPart)
	) {
		throw new ResponseSnapshotStoragePathError("Invalid snapshot storage key");
	}
	const revision = Number(revisionPart.slice(1));
	if (revision > 32_767) throw new ResponseSnapshotStoragePathError("Invalid snapshot storage revision");
	return { segments: [brandId, year, month, runId, revisionPart], brandId, runId, revision };
}

function resolveContained(parent: string, child: string): string {
	const candidate = resolve(parent, child);
	const pathFromParent = relative(parent, candidate);
	if (
		!pathFromParent ||
		pathFromParent === ".." ||
		pathFromParent.startsWith(`..${sep}`) ||
		isAbsolute(pathFromParent)
	) {
		throw new ResponseSnapshotStoragePathError("Snapshot path escapes its expected parent");
	}
	return candidate;
}

async function cleanIncompleteRevision(revisionDirectory: string): Promise<void> {
	for (const entry of await readdir(revisionDirectory)) {
		if (entry === ".write.lock") continue;
		if (!isOwnedSnapshotFile(entry)) {
			throw new ResponseSnapshotStoragePathError("Snapshot revision contains an unrecognized entry");
		}
		const entryPath = resolveContained(revisionDirectory, entry);
		const entryStat = await safeLeafStat(entryPath);
		if (entryStat) await unlink(entryPath);
	}
}

function isOwnedSnapshotFile(entry: string): boolean {
	return (
		Object.values(ASSET_FILE_NAMES).includes(entry as (typeof ASSET_FILE_NAMES)[keyof typeof ASSET_FILE_NAMES]) ||
		/^\.(snapshot\.(html|json)\.gz|manifest\.json)\.[A-Za-z0-9-]+\.tmp$/u.test(entry)
	);
}

async function cleanupOwnAttempt(
	revisionDirectory: string,
	paths: { html: string; json: string; manifest: string },
): Promise<void> {
	await Promise.all(Object.values(paths).map(unlinkIfExists));
	const manifestPath = resolveContained(revisionDirectory, ASSET_FILE_NAMES.manifest);
	if (await lstatOrNull(manifestPath)) return;
	await Promise.all([
		unlinkIfExists(resolveContained(revisionDirectory, ASSET_FILE_NAMES.html)),
		unlinkIfExists(resolveContained(revisionDirectory, ASSET_FILE_NAMES.json)),
	]);
}

async function writeDurableFile(filePath: string, value: Uint8Array): Promise<void> {
	const handle = await open(filePath, "wx", FILE_MODE);
	try {
		await handle.writeFile(value);
		await handle.sync();
	} finally {
		await handle.close();
	}
	if (process.platform !== "win32") await chmod(filePath, FILE_MODE);
}

async function acquireWriteLock(lockPath: string): Promise<void> {
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(lockPath, "wx", FILE_MODE);
		await handle.writeFile(`${process.pid}\n`, "utf8");
		await handle.sync();
		await handle.close();
		handle = null;
	} catch (error) {
		if (handle) await handle.close().catch(() => undefined);
		if (!isNodeError(error, "EEXIST")) await unlinkIfExists(lockPath);
		if (isNodeError(error, "EEXIST")) {
			throw new ResponseSnapshotStorageBusyError("Snapshot revision is being written");
		}
		throw error;
	}
}

async function syncDirectory(directory: string): Promise<void> {
	if (process.platform === "win32") return;
	const handle = await open(directory, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function readVerifiedCompressedAsset(filePath: string, expected: SnapshotManifestArtifact): Promise<Buffer> {
	const fileStat = await safeLeafStat(filePath);
	if (!fileStat || fileStat.size <= 0 || fileStat.size > MAX_COMPRESSED_ASSET_BYTES) {
		throw new ResponseSnapshotStorageIntegrityError("Snapshot artifact is missing or oversized");
	}
	const compressed = await readFile(filePath);
	if (compressed.byteLength !== expected.gzipBytes) {
		throw new ResponseSnapshotStorageIntegrityError("Snapshot artifact stored size failed integrity validation");
	}
	let uncompressed: Buffer;
	try {
		uncompressed = gunzipSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_ASSET_BYTES });
	} catch {
		throw new ResponseSnapshotStorageIntegrityError("Snapshot artifact compression failed integrity validation");
	}
	if (uncompressed.byteLength !== expected.bytes || sha256(uncompressed) !== expected.sha256) {
		throw new ResponseSnapshotStorageIntegrityError("Snapshot artifact content failed integrity validation");
	}
	return compressed;
}

function parseManifest(value: Uint8Array): SnapshotManifest {
	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(value).toString("utf8"));
	} catch {
		throw new ResponseSnapshotStorageIntegrityError("Snapshot manifest is not valid JSON");
	}
	if (
		!isRecord(parsed) ||
		parsed.schemaVersion !== "response-snapshot-manifest.v1" ||
		typeof parsed.runId !== "string"
	) {
		throw new ResponseSnapshotStorageIntegrityError("Snapshot manifest contract is invalid");
	}
	const artifacts = parsed.artifacts;
	if (!isRecord(artifacts)) throw new ResponseSnapshotStorageIntegrityError("Snapshot manifest artifacts are invalid");
	const html = parseManifestArtifact(artifacts.html, ASSET_FILE_NAMES.html);
	const json = parseManifestArtifact(artifacts.json, ASSET_FILE_NAMES.json);
	return { schemaVersion: parsed.schemaVersion, runId: parsed.runId, artifacts: { html, json } };
}

function parseManifestArtifact(
	value: unknown,
	fileName: "snapshot.html.gz" | "snapshot.json.gz",
): SnapshotManifestArtifact {
	if (
		!isRecord(value) ||
		value.fileName !== fileName ||
		typeof value.sha256 !== "string" ||
		!SHA256_PATTERN.test(value.sha256) ||
		!Number.isInteger(value.bytes) ||
		Number(value.bytes) <= 0 ||
		Number(value.bytes) > MAX_UNCOMPRESSED_ASSET_BYTES ||
		!Number.isInteger(value.gzipBytes) ||
		Number(value.gzipBytes) <= 0 ||
		Number(value.gzipBytes) > MAX_COMPRESSED_ASSET_BYTES
	) {
		throw new ResponseSnapshotStorageIntegrityError("Snapshot manifest artifact metadata is invalid");
	}
	return {
		fileName,
		sha256: value.sha256,
		bytes: Number(value.bytes),
		gzipBytes: Number(value.gzipBytes),
	};
}

async function safeLeafStat(filePath: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
	const value = await lstatOrNull(filePath);
	if (!value) return null;
	if (value.isSymbolicLink() || !value.isFile()) {
		throw new ResponseSnapshotStoragePathError("Snapshot artifact must be a regular file");
	}
	return value;
}

function assertDirectory(value: Awaited<ReturnType<typeof lstat>> | null, directory: string): void {
	if (!value || value.isSymbolicLink() || !value.isDirectory()) {
		throw new ResponseSnapshotStoragePathError(`Snapshot directory is unsafe: ${directory}`);
	}
}

async function lstatOrNull(filePath: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
	try {
		return await lstat(filePath);
	} catch (error) {
		if (isNodeError(error, "ENOENT")) return null;
		throw error;
	}
}

async function unlinkIfExists(filePath: string): Promise<void> {
	try {
		await unlink(filePath);
	} catch (error) {
		if (!isNodeError(error, "ENOENT")) throw error;
	}
}

function assertIdentical(
	stored: StoredResponseSnapshot,
	bundle: PreparedResponseSnapshotBundle,
): StoredResponseSnapshot {
	if (
		stored.brandId !== bundle.brandId ||
		stored.runId !== bundle.runId ||
		stored.htmlSha256 !== bundle.htmlSha256 ||
		stored.jsonSha256 !== bundle.jsonSha256 ||
		stored.manifestSha256 !== bundle.manifestSha256 ||
		stored.htmlBytes !== bundle.htmlBytes ||
		stored.jsonBytes !== bundle.jsonBytes ||
		stored.manifestBytes !== bundle.manifestBytes ||
		stored.htmlGzipBytes !== bundle.htmlGzipBytes ||
		stored.jsonGzipBytes !== bundle.jsonGzipBytes
	) {
		throw new ResponseSnapshotStorageConflictError("Snapshot revision already contains different content");
	}
	return stored;
}

function sha256(value: Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error && error.code === code;
}
