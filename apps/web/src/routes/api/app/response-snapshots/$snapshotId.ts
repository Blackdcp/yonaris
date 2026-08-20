import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { gunzipSync } from "node:zlib";
import { createFileRoute } from "@tanstack/react-router";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import type { ResponseSnapshotAsset } from "@workspace/lib/response-snapshots/storage";
import { z } from "zod";
import { resolveAuthSession } from "@/lib/auth/resolve-session";
import {
	buildResponseSnapshotAssetHeaders,
	parseResponseSnapshotAssetSelector,
	ResponseSnapshotHttpError,
	responseSnapshotErrorResponse,
} from "@/server/response-snapshot-http";
import {
	loadAuthorizedResponseSnapshot,
	loadAuthorizedResponseSnapshotScreenshot,
	parseResponseSnapshotVisualEvidenceManifest,
	recordResponseSnapshotAccess,
} from "@/server/response-snapshots";

const snapshotIdSchema = z.guid();

export const Route = createFileRoute("/api/app/response-snapshots/$snapshotId")({
	server: {
		handlers: {
			GET: async ({ request, params }: { request: Request; params: { snapshotId: string } }) => {
				try {
					const snapshotId = snapshotIdSchema.safeParse(params.snapshotId);
					if (!snapshotId.success) throw new ResponseSnapshotHttpError(400, "snapshotId must be a GUID");
					const selector = parseResponseSnapshotAssetSelector(new URL(request.url));
					const session = await resolveAuthSession(request.headers);
					const snapshot = await loadAuthorizedResponseSnapshot(snapshotId.data, session);
					if (selector.asset === "screenshot" && snapshot.schemaVersion !== "response-snapshot.v2") {
						throw new ResponseSnapshotHttpError(404, "Response snapshot visual evidence was not found");
					}
					const storageRoot = process.env.RESPONSE_SNAPSHOT_ROOT;
					if (!storageRoot || !isAbsolute(storageRoot)) {
						throw new ResponseSnapshotHttpError(503, "Response snapshot storage is unavailable");
					}
					const storage = new FilesystemResponseSnapshotStorage(storageRoot);
					if (selector.asset === "screenshot") {
						return await serveResponseSnapshotScreenshot(snapshot, selector.download, storage);
					}
					let asset: ResponseSnapshotAsset;
					let fileName: string | undefined;
					if (selector.download) {
						const download = await storage.createDownload(snapshot.storageKey, selector.asset);
						asset = download;
						fileName = download.fileName;
					} else {
						asset = await storage.get(snapshot.storageKey, selector.asset);
					}
					const expectedSha256 = {
						html: snapshot.htmlSha256,
						json: snapshot.jsonSha256,
						manifest: snapshot.manifestSha256,
					}[selector.asset];
					if (asset.sha256 !== expectedSha256) {
						throw new ResponseSnapshotHttpError(500, "Response snapshot integrity check failed");
					}
					const responseBody = decodeResponseSnapshotAsset(asset);
					await recordResponseSnapshotAccess({
						snapshotId: snapshot.id,
						brandId: snapshot.brandId,
						actorUserId: snapshot.actorUserId,
						...selector,
					});
					return new Response(new Uint8Array(responseBody), {
						headers: buildResponseSnapshotAssetHeaders({
							...selector,
							contentType: asset.contentType,
							contentEncoding: null,
							sha256: asset.sha256,
							storedBytes: responseBody.byteLength,
							...(fileName ? { fileName } : {}),
						}),
					});
				} catch (error) {
					return responseSnapshotErrorResponse(error);
				}
			},
		},
	},
});

async function serveResponseSnapshotScreenshot(
	snapshot: Awaited<ReturnType<typeof loadAuthorizedResponseSnapshot>>,
	download: boolean,
	storage: FilesystemResponseSnapshotStorage,
): Promise<Response> {
	const manifest = await storage.get(snapshot.storageKey, "manifest");
	if (manifest.sha256 !== snapshot.manifestSha256) {
		throw new ResponseSnapshotHttpError(500, "Response snapshot integrity check failed");
	}
	const expected = parseResponseSnapshotVisualEvidenceManifest(manifest.body, snapshot.promptRunId);
	const artifact = await loadAuthorizedResponseSnapshotScreenshot(snapshot, expected);
	if (!artifact) throw new ResponseSnapshotHttpError(404, "Response snapshot visual evidence was not found");
	const content = new Uint8Array(artifact.content);
	if (
		artifact.bytes < 4 ||
		artifact.bytes > 2 * 1024 * 1024 ||
		content.byteLength !== artifact.bytes ||
		content[0] !== 0xff ||
		content[1] !== 0xd8 ||
		content[2] !== 0xff ||
		createHash("sha256").update(content).digest("hex") !== artifact.sha256
	) {
		throw new ResponseSnapshotHttpError(500, "Response snapshot integrity check failed");
	}
	await recordResponseSnapshotAccess({
		snapshotId: snapshot.id,
		brandId: snapshot.brandId,
		actorUserId: snapshot.actorUserId,
		asset: "screenshot",
		download,
	});
	return new Response(content, {
		headers: buildResponseSnapshotAssetHeaders({
			asset: "screenshot",
			download,
			contentType: artifact.mediaType,
			contentEncoding: null,
			sha256: artifact.sha256,
			storedBytes: artifact.bytes,
			...(download ? { fileName: `response-snapshot-${snapshot.id}.jpg` } : {}),
		}),
	});
}

function decodeResponseSnapshotAsset(asset: ResponseSnapshotAsset): Uint8Array {
	let body: Uint8Array;
	try {
		body = asset.contentEncoding === "gzip" ? gunzipSync(asset.body, { maxOutputLength: asset.bytes }) : asset.body;
	} catch {
		throw new ResponseSnapshotHttpError(500, "Response snapshot integrity check failed");
	}
	if (body.byteLength !== asset.bytes || createHash("sha256").update(body).digest("hex") !== asset.sha256) {
		throw new ResponseSnapshotHttpError(500, "Response snapshot integrity check failed");
	}
	return body;
}
