import { isAbsolute } from "node:path";
import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import { resolveAuthSession } from "@/lib/auth/resolve-session";
import {
	acquireResponseSnapshotExportLock,
	assertResponseSnapshotExportRows,
	authorizeResponseSnapshotExport,
	createResponseSnapshotExportArchive,
	loadResponseSnapshotExportRows,
	parseResponseSnapshotExportQuery,
	ResponseSnapshotExportPolicyError,
	recordResponseSnapshotExportAccess,
} from "@/server/response-snapshot-export";
import { ResponseSnapshotHttpError, responseSnapshotErrorResponse } from "@/server/response-snapshot-http";

export const Route = createFileRoute("/api/app/response-snapshots/export")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				let exportLock: Awaited<ReturnType<typeof acquireResponseSnapshotExportLock>> | null = null;
				try {
					const now = new Date();
					const selection = parseResponseSnapshotExportQuery(new URL(request.url), now);
					const session = await resolveAuthSession(request.headers);
					const actor = await authorizeResponseSnapshotExport(selection.brandId, session);
					if (selection.mode === "download") {
						exportLock = await acquireResponseSnapshotExportLock(actor.actorUserId);
					}

					const rows = await loadResponseSnapshotExportRows(selection, now);
					const estimate = assertResponseSnapshotExportRows(rows, { brandId: selection.brandId, now });
					if (selection.mode === "estimate") {
						return Response.json(
							{ ...estimate, startDate: selection.startDate, endDate: selection.endDate },
							{ headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
						);
					}

					const storageRoot = process.env.RESPONSE_SNAPSHOT_ROOT;
					if (!storageRoot || !isAbsolute(storageRoot)) {
						throw new ResponseSnapshotHttpError(503, "Response snapshot storage is unavailable");
					}
					const archive = createResponseSnapshotExportArchive({
						rows,
						storage: new FilesystemResponseSnapshotStorage(storageRoot),
						onArchived: () =>
							recordResponseSnapshotExportAccess({
								rows,
								brandId: selection.brandId,
								actorUserId: actor.actorUserId,
								startDate: selection.startDate,
								endDate: selection.endDate,
								uncompressedBytes: estimate.uncompressedBytes,
							}),
					});
					const activeLock = exportLock;
					exportLock = null;
					let released = false;
					const release = async () => {
						if (released) return;
						released = true;
						await activeLock?.release();
					};
					archive.once("end", () => void release());
					archive.once("close", () => void release());
					archive.once("error", () => void release());
					request.signal.addEventListener(
						"abort",
						() => {
							archive.abort();
							void release();
						},
						{ once: true },
					);

					return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
						headers: {
							"Cache-Control": "private, no-store",
							"Content-Disposition": `attachment; filename="response-snapshots-${selection.brandId}-${selection.startDate}-${selection.endDate}.zip"`,
							"Content-Type": "application/zip",
							"X-Content-Type-Options": "nosniff",
						},
					});
				} catch (error) {
					await exportLock?.release();
					if (error instanceof ResponseSnapshotExportPolicyError) {
						return Response.json(
							{ error: "ResponseSnapshotExportError", message: error.message },
							{
								status: error.status,
								headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
							},
						);
					}
					return responseSnapshotErrorResponse(error);
				}
			},
		},
	},
});
