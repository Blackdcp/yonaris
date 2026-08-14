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
import { loadAuthorizedResponseSnapshot, recordResponseSnapshotAccess } from "@/server/response-snapshots";

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
					const storageRoot = process.env.RESPONSE_SNAPSHOT_ROOT;
					if (!storageRoot || !isAbsolute(storageRoot)) {
						throw new ResponseSnapshotHttpError(503, "Response snapshot storage is unavailable");
					}
					const storage = new FilesystemResponseSnapshotStorage(storageRoot);
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
